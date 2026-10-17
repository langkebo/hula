import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'
import type { EventType, IContent, MatrixEvent } from '../sdk'
import { ContentHelpers, LocationAssetType } from '../sdk'

const logger = createLogger('MatrixLocationService')

export interface LocationData {
  latitude: number
  longitude: number
  accuracy?: number | undefined
  description?: string | undefined
  timestamp: number
}

interface LocationContent extends IContent {
  msgtype?: string
  body: string
  geo_uri: string
  'm.location'?: {
    uri: string
    description?: string
  }
  'org.matrix.msc3488.asset'?: {
    type: string
  }
  'org.matrix.msc3488.ts'?: number
  expires_at?: number
  'm.relates_to'?: {
    rel_type: string
    event_id?: string
  }
}

class MatrixLocationService {
  /**
   * 获取设备当前位置（高精度，10s 超时，60s 缓存）。
   * 浏览器不支持或获取失败时 reject。
   */
  async getCurrentPosition(): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('[Location] 浏览器不支持地理位置'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          })
        },
        (err) => {
          logger.error(`[Location] 获取位置失败: ${err.message}`)
          reject(err)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      )
    })
  }

  /**
   * 向房间发送位置事件（m.location）。
   * 客户端未初始化时抛出异常；成功返回事件 ID。
   */
  async sendLocation(roomId: string, location: LocationData): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Location] 客户端未初始化')
    }

    try {
      const geoUri = `geo:${location.latitude},${location.longitude}${location.accuracy ? `;u=${location.accuracy}` : ''}`

      const content = ContentHelpers.makeLocationContent(
        undefined,
        geoUri,
        location.timestamp,
        location.description,
        LocationAssetType.Pin
      )

      const response = await client.sendEvent(roomId, 'm.room.message' as EventType, content)
      logger.info(`[Location] 发送位置成功: ${roomId}`)
      return response.event_id
    } catch (err) {
      logger.error(`[Location] 发送位置失败: ${err}`)
      throw err
    }
  }

  /**
   * 从 Matrix 事件解析位置数据。
   * 非 m.location 或解析失败时返回 null。
   */
  parseLocationEvent(event: MatrixEvent): LocationData | null {
    try {
      const content = event.getContent() as LocationContent
      if (content.msgtype !== 'm.location') return null

      const geoUri = content.geo_uri || ''
      const match = geoUri.match(/geo:([0-9.-]+),([0-9.-]+)(?:;u=([0-9.]+))?/)

      if (!match) return null

      return {
        latitude: parseFloat(match[1]),
        longitude: parseFloat(match[2]),
        accuracy: match[3] ? parseFloat(match[3]) : undefined,
        description: content.body || content['m.location']?.description,
        timestamp: event.getTs()
      }
    } catch (err) {
      // R-19: log silent catch in parseLocationEvent
      logger.warn('parseLocation failed:', err)
      return null
    }
  }

  /**
   * 生成该位置的 Google Maps 链接。
   */
  getGoogleMapsUrl(location: LocationData): string {
    return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
  }

  /**
   * 生成该位置的 OpenStreetMap 链接。
   */
  getOpenStreetMapUrl(location: LocationData): string {
    return `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=15/${location.latitude}/${location.longitude}`
  }
}

export const matrixLocationService = new MatrixLocationService()
