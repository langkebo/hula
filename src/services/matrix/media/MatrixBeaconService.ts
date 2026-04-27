/**
 * Beacon 服务 (MSC3489)
 * 位置信标功能
 */
import { matrixClientService } from '../MatrixClientService'

type BeaconInfoContent = {
  description?: string
  timeout?: number
  live?: boolean
}

type BeaconLocationContent = {
  uri?: string
  description?: string
  ts?: number
  timestamp?: number
  accuracy?: number
  altitude?: number
  speed?: number
  bearing?: number
}

type BeaconEventContent = {
  beacon_info?: BeaconInfoContent
  beacon?: {
    event_id?: string
    timestamp?: number
    location?: BeaconLocationContent
  }
  location?: BeaconLocationContent
  'm.relates_to'?: { event_id?: string }
  [key: string]: unknown
}

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

    const response = await this.client.sendEvent(roomId, 'm.beacon_info', content)
    if (!response) {
      throw new Error('Failed to send beacon event')
    }

    const userId = this.client.getUserId()
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
      const event = await this.client.getRoomEvent(roomId, eventId)
      const content = event.getContent() as BeaconEventContent

      if (!content || !content.beacon_info) return null

      return {
        event_id: eventId,
        room_id: roomId,
        user_id: event.sender?.userId || '',
        description: content.beacon_info.description,
        timeout: content.beacon_info.timeout,
        is_live: content.beacon_info.live ?? false,
        last_updated: event.getTs() || Date.now()
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

      // MatrixClient.search return structure
      const results = result?.search_categories?.room_events?.results || []
      for (const item of results) {
        const event = item.result
        const content = event.content as BeaconEventContent
        if (content?.beacon_info?.live) {
          beacons.push({
            event_id: event.event_id,
            room_id: roomId,
            user_id: event.sender,
            description: content.beacon_info.description,
            timeout: content.beacon_info.timeout,
            is_live: true,
            last_updated: event.origin_server_ts || Date.now()
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

    const response = await this.client.sendEvent(roomId, 'm.beacon', content)

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

      const results = result?.search_categories?.room_events?.results || []
      for (const item of results) {
        const event = item.result
        const content = event.content as BeaconEventContent
        if (content?.beacon?.location) {
          const geo = content.beacon.location
          const geoMatch = (geo.uri as string | undefined)?.match(/geo:([-\d.]+),([-\d.]+)/)

          if (geoMatch) {
            locations.push({
              event_id: event.event_id,
              beacon_info_id: beaconInfoEventId,
              timestamp: geo.timestamp || event.origin_server_ts || Date.now(),
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
      const content = event.getContent() as BeaconEventContent

      if (!content || !content.beacon_info) return false

      content.beacon_info.live = false

      await this.client.sendEvent(roomId, 'm.beacon_info', content)
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
      await this.client.redactEvent(roomId, eventId, undefined, { reason: 'Beacon deleted' })
      return true
    } catch {
      return false
    }
  }
}

export const matrixBeaconService = new MatrixBeaconService()
