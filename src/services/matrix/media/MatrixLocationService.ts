import type { EventType, IContent, MatrixEvent } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'

const logger = createLogger('MatrixLocationService')

export interface LocationData {
  latitude: number
  longitude: number
  accuracy?: number
  description?: string
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

  async sendLocation(roomId: string, location: LocationData): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Location] 客户端未初始化')
    }

    try {
      const geoUri = `geo:${location.latitude},${location.longitude}${location.accuracy ? `;u=${location.accuracy}` : ''}`

      const content: LocationContent = {
        msgtype: 'm.location',
        body: location.description || geoUri,
        geo_uri: geoUri,
        'm.location': {
          uri: geoUri,
          description: location.description
        }
      }

      const response = await client.sendEvent(roomId, 'm.room.message' as EventType, content)
      logger.info(`[Location] 发送位置成功: ${roomId}`)
      return response.event_id
    } catch (err) {
      logger.error(`[Location] 发送位置失败: ${err}`)
      throw err
    }
  }

  async startLiveLocationShare(roomId: string, duration: number = 3600000): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Location] 客户端未初始化')
    }

    try {
      const location = await this.getCurrentPosition()
      const geoUri = `geo:${location.latitude},${location.longitude}`

      const content: LocationContent = {
        msgtype: 'm.location',
        body: 'Live location',
        geo_uri: geoUri,
        'm.location': {
          uri: geoUri,
          description: 'Live location share'
        },
        'org.matrix.msc3488.asset': {
          type: 'm.self'
        },
        'org.matrix.msc3488.ts': Date.now(),
        expires_at: Date.now() + duration
      }

      const response = await client.sendEvent(roomId, 'm.room.message' as EventType, content)
      logger.info(`[Location] 开始实时位置分享: ${roomId}`)
      return response.event_id
    } catch (err) {
      logger.error(`[Location] 开始实时位置分享失败: ${err}`)
      throw err
    }
  }

  async updateLiveLocation(roomId: string, eventId: string, location: LocationData): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Location] 客户端未初始化')
    }

    try {
      const geoUri = `geo:${location.latitude},${location.longitude}`

      const content: LocationContent = {
        msgtype: 'm.location',
        body: 'Live location update',
        geo_uri: geoUri,
        'm.location': {
          uri: geoUri,
          description: 'Live location update'
        },
        'org.matrix.msc3488.asset': {
          type: 'm.self'
        },
        'org.matrix.msc3488.ts': Date.now(),
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: eventId
        }
      }

      await client.sendEvent(roomId, 'm.room.message' as EventType, content)
      logger.info(`[Location] 更新实时位置: ${roomId}`)
    } catch (err) {
      logger.error(`[Location] 更新实时位置失败: ${err}`)
      throw err
    }
  }

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

  getGoogleMapsUrl(location: LocationData): string {
    return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
  }

  getOpenStreetMapUrl(location: LocationData): string {
    return `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=15/${location.latitude}/${location.longitude}`
  }
}

export const matrixLocationService = new MatrixLocationService()
