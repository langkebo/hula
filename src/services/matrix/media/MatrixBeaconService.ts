/**
 * Beacon 服务 (MSC3489)
 * 位置信标功能
 */

import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '../MatrixClientService'
import type { MBeaconEventContent } from '../sdk'
import { ContentHelpers, M_BEACON } from '../sdk'

const logger = createLogger('MatrixBeaconService')

interface BeaconInfo {
  event_id: string
  room_id: string
  user_id: string
  description?: string
  timeout?: number
  is_live: boolean
  last_updated: number
}

interface BeaconLocation {
  event_id: string
  beacon_info_id: string
  timestamp: number
  latitude: number
  longitude: number
  uncertainty?: number
  altitude?: number
  speed?: number
  bearing?: number
}

interface CreateBeaconParams {
  roomId: string
  description?: string
  timeout?: number
}

interface UpdateBeaconLocationParams {
  roomId: string
  beaconInfoEventId: string
  latitude: number
  longitude: number
  uncertainty?: number
  altitude?: number
  speed?: number
  bearing?: number
}

class MatrixBeaconService {
  private getClient() {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('Matrix client not initialized, beacon service unavailable.')
      return null
    }
    return client
  }

  /**
   * 创建信标 (发送 m.beacon_info state event，符合 MSC3489 规范)
   * 迁移 2026-08-11: 从 client.sendEvent (timeline event) 改为 SDK BeaconManager.createLiveBeacon (state event)
   */
  async createBeacon(params: CreateBeaconParams): Promise<BeaconInfo> {
    const { roomId, description, timeout = 3600000 } = params
    const client = this.getClient()
    if (!client) throw new Error('Matrix client not initialized')

    // SDK BeaconManager.createLiveBeacon 内部调用 sendStateEvent，
    // 使用 M_BEACON_INFO 类型 + state_key = userId，符合 MSC3489 规范。
    // 前端之前用 sendEvent (timeline event) 不符合规范。
    const beaconInfoContent = {
      description,
      timeout,
      live: true,
      'm.ts': Date.now(),
      'm.asset': { type: 'm.self' }
    } as Parameters<ReturnType<typeof client.getBeaconManager>['createLiveBeacon']>[1]

    const response = await client.getBeaconManager().createLiveBeacon(roomId, beaconInfoContent)
    if (!response) {
      throw new Error('Failed to send beacon event')
    }

    const userId = client.getUserId()
    if (!userId) {
      throw new Error('User not logged in')
    }

    return {
      event_id: response.event_id,
      room_id: roomId,
      user_id: userId,
      description,
      timeout,
      is_live: true,
      last_updated: Date.now()
    }
  }

  /**
   * 获取信标信息
   */
  async getBeaconInfo(roomId: string, eventId: string): Promise<BeaconInfo | null> {
    try {
      const client = this.getClient()
      if (!client) return null
      const event = await client.getRoomEvent(roomId, eventId)
      const content = event.getContent() as { description?: string; timeout?: number; live?: boolean }

      if (content.timeout === undefined) return null

      return {
        event_id: eventId,
        room_id: roomId,
        user_id: event.sender?.userId || '',
        description: content.description,
        timeout: content.timeout,
        is_live: content.live ?? false,
        last_updated: event.getTs() || Date.now()
      }
    } catch (err) {
      logger.warn('getBeaconInfo failed:', err)
      return null
    }
  }

  /**
   * 获取房间内所有活跃信标
   * 迁移 2026-08-16: 从 client.search 裸调改为 BeaconManager.getBeaconsForRoom 本地读取，
   * 不再发 /search 请求。isLive 由 SDK 按 beacon_info live 标记 + timeout 时效窗口计算。
   */
  async getActiveBeacons(roomId: string): Promise<BeaconInfo[]> {
    try {
      const client = this.getClient()
      if (!client) return []
      const beacons = client.getBeaconManager().getBeaconsForRoom(roomId)

      return beacons
        .filter((beacon) => beacon.isLive)
        .map((beacon) => ({
          event_id: beacon.beaconInfoId,
          room_id: roomId,
          user_id: beacon.beaconInfoOwner,
          description: beacon.beaconInfo.description,
          timeout: beacon.beaconInfo.timeout,
          is_live: beacon.isLive,
          last_updated: beacon.beaconInfo.timestamp ?? Date.now()
        }))
    } catch (err) {
      logger.warn('getActiveBeacons failed:', err)
      return []
    }
  }

  /**
   * 更新信标位置 (发送 m.beacon 事件)
   */
  async updateBeaconLocation(params: UpdateBeaconLocationParams): Promise<BeaconLocation> {
    const { roomId, beaconInfoEventId, latitude, longitude, uncertainty, altitude, speed, bearing } = params
    const client = this.getClient()
    if (!client) throw new Error('Matrix client not initialized')

    const content = ContentHelpers.makeBeaconContent(`geo:${latitude},${longitude}`, Date.now(), beaconInfoEventId)

    const response = await client.sendEvent(roomId, M_BEACON.name, content)
    if (!response) {
      throw new Error('Failed to send beacon location event')
    }

    return {
      event_id: response.event_id,
      beacon_info_id: beaconInfoEventId,
      timestamp: Date.now(),
      latitude,
      longitude,
      uncertainty,
      altitude,
      speed,
      bearing
    }
  }

  /**
   * 获取信标位置历史
   *
   * 注意：SDK Beacon 模型只跟踪「当前/最新」位置（latestLocationState），不保留
   * 历史位置列表，BeaconManager 无等价能力，因此保留 client.search 裸调实现
   * （不发 /search 无法获取历史轨迹，勿做有损迁移）。待 SDK 提供历史 API 后替换。
   */
  async getBeaconLocationHistory(
    roomId: string,
    beaconInfoEventId: string,
    limit: number = 50
  ): Promise<BeaconLocation[]> {
    try {
      const client = this.getClient()
      if (!client) return []
      const result = await client.search({
        room_ids: [roomId],
        filter: {
          types: M_BEACON.names
        },
        limit
      })

      const locations: BeaconLocation[] = []

      const results = result?.search_categories?.room_events?.results || []
      for (const item of results) {
        const event = item.result
        const parsed = ContentHelpers.parseBeaconContent(event.content as MBeaconEventContent)
        const geoMatch = parsed.uri?.match(/geo:([-\d.]+),([-\d.]+)/)

        if (geoMatch) {
          locations.push({
            event_id: event.event_id,
            beacon_info_id: beaconInfoEventId,
            timestamp: parsed.timestamp || event.origin_server_ts || Date.now(),
            latitude: parseFloat(geoMatch[1]),
            longitude: parseFloat(geoMatch[2])
          })
        }
      }

      return locations.sort((a, b) => a.timestamp - b.timestamp)
    } catch (err) {
      logger.warn('getBeaconLocationHistory failed:', err)
      return []
    }
  }

  /**
   * 停止信标
   */
  async stopBeacon(roomId: string, beaconInfoEventId: string): Promise<boolean> {
    try {
      const client = this.getClient()
      if (!client) return false

      // 读取现有 beacon_info 以保留 timeout/description
      const event = await client.getRoomEvent(roomId, beaconInfoEventId)
      const content = event.getContent() as { description?: string; timeout?: number }

      // 本 fork 的 BeaconManager.stopBeacon(roomId, beaconId) 仅本地调用 beacon.destroy()，
      // 不会向服务端发送 state event；改用 setLiveBeacon(live:false) 发送 m.beacon_info
      // state event（state_key = 发送者 mxid），与 element-web 线上行为一致。
      await client
        .getBeaconManager()
        .setLiveBeacon(
          roomId,
          ContentHelpers.makeBeaconInfoContent(content.timeout ?? 3600000, false, content.description)
        )

      return true
    } catch (err) {
      logger.warn('stopBeacon failed:', err)
      return false
    }
  }

  /**
   * 删除信标
   */
  async deleteBeacon(roomId: string, eventId: string): Promise<boolean> {
    try {
      const client = this.getClient()
      if (!client) return false
      await client.redactEvent(roomId, eventId, undefined, { reason: 'Beacon deleted' })
      return true
    } catch (err) {
      logger.warn('deleteBeacon failed:', err)
      return false
    }
  }
}

export const matrixBeaconService = new MatrixBeaconService()
