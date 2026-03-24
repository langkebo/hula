/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Beacon 服务 (MSC3489)
 * 位置信标功能
 */
import { matrixClientService } from './MatrixClientService'

export interface BeaconInfo {
  event_id: string
  room_id: string
  user_id: string
  description?: string
  timeout?: number
  is_live: boolean
  last_updated: number
}

export interface BeaconLocation {
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

export interface CreateBeaconParams {
  roomId: string
  description?: string
  timeout?: number
}

export interface UpdateBeaconLocationParams {
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
  private get client() {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }
    return client
  }

  /**
   * 创建信标 (发送 m.beacon_info 事件)
   */
  async createBeacon(params: CreateBeaconParams): Promise<BeaconInfo> {
    const { roomId, description, timeout = 3600000 } = params

    const content = {
      msgtype: 'm.beacon_info',
      beacon_info: {
        description,
        timeout,
        live: true
      }
    }

    const event: any = await this.client.sendEvent(roomId, 'm.beacon_info', content)
    if (!event) {
      throw new Error('Failed to send beacon event')
    }

    const userId = this.client.getUserId() as string
    if (!userId) {
      throw new Error('User not logged in')
    }

    return {
      event_id: (event as any).event_id ?? '',
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
      const event = await this.client.getRoomEvent(roomId, eventId)
      const content: any = event.getContent()

      if (!content || !content.beacon_info) return null

      return {
        event_id: eventId,
        room_id: roomId,
        user_id: event.sender?.userId || '',
        description: content.beacon_info.description,
        timeout: content.beacon_info.timeout,
        is_live: content.beacon_info.live,
        last_updated: event.originServerTs || Date.now()
      }
    } catch {
      return null
    }
  }

  /**
   * 获取房间内所有活跃信标
   */
  async getActiveBeacons(roomId: string): Promise<BeaconInfo[]> {
    try {
      const result = await this.client.search({
        room_ids: [roomId],
        filter: {
          types: ['m.beacon_info']
        },
        limit: 50
      })

      const beacons: BeaconInfo[] = []

      const events = result?.events || []
      for (const event of events) {
        const content = event.getContent ? event.getContent() : event.content
        if (content?.beacon_info?.live) {
          beacons.push({
            event_id: event.eventId || '',
            room_id: roomId,
            user_id: event.sender?.userId || '',
            description: content.beacon_info.description,
            timeout: content.beacon_info.timeout,
            is_live: true,
            last_updated: event.originServerTs || Date.now()
          })
        }
      }

      return beacons
    } catch {
      return []
    }
  }

  /**
   * 更新信标位置 (发送 m.beacon 事件)
   */
  async updateBeaconLocation(params: UpdateBeaconLocationParams): Promise<BeaconLocation> {
    const { roomId, beaconInfoEventId, latitude, longitude, uncertainty, altitude, speed, bearing } = params

    const content = {
      msgtype: 'm.beacon',
      beacon: {
        event_id: beaconInfoEventId,
        timestamp: Date.now(),
        location: {
          uri: `geo:${latitude},${longitude}`,
          timestamp: Date.now(),
          accuracy: uncertainty,
          altitude,
          speed,
          bearing,
          description: ''
        }
      }
    }

    const event = await this.client.sendEvent(roomId, 'm.beacon', content)

    return {
      event_id: event.event_id,
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
   */
  async getBeaconLocationHistory(
    roomId: string,
    beaconInfoEventId: string,
    limit: number = 50
  ): Promise<BeaconLocation[]> {
    try {
      const result = await this.client.search({
        room_ids: [roomId],
        filter: {
          types: ['m.beacon']
        },
        limit
      })

      const locations: BeaconLocation[] = []

      const events = result?.events || []
      for (const event of events) {
        const content = event.getContent ? event.getContent() : event.content
        if (content?.beacon?.location) {
          const geo = content.beacon.location
          const geoMatch = geo.uri?.match(/geo:([-\d.]+),([-\d.]+)/)

          if (geoMatch) {
            locations.push({
              event_id: event.eventId || '',
              beacon_info_id: beaconInfoEventId,
              timestamp: geo.timestamp || event.originServerTs || Date.now(),
              latitude: parseFloat(geoMatch[1]),
              longitude: parseFloat(geoMatch[2]),
              uncertainty: geo.accuracy,
              altitude: geo.altitude,
              speed: geo.speed,
              bearing: geo.bearing
            })
          }
        }
      }

      return locations.sort((a, b) => a.timestamp - b.timestamp)
    } catch {
      return []
    }
  }

  /**
   * 停止信标 (更新 beacon_info live 为 false)
   */
  async stopBeacon(roomId: string, eventId: string): Promise<boolean> {
    try {
      const event = await this.client.getRoomEvent(roomId, eventId)
      const content = event.getContent()

      if (!content) return false

      content.beacon_info.live = false

      await this.client.sendEvent(roomId, 'm.beacon_info', content, eventId)
      return true
    } catch {
      return false
    }
  }

  /**
   * 删除信标
   */
  async deleteBeacon(roomId: string, eventId: string): Promise<boolean> {
    try {
      await (this.client as any).redactEvent(roomId, eventId, undefined, { reason: 'Beacon deleted' })
      return true
    } catch {
      return false
    }
  }
}

export const matrixBeaconService = new MatrixBeaconService()
