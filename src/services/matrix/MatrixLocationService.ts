/* eslint-disable @typescript-eslint/no-explicit-any */
import type { MatrixEvent } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'

export interface LocationData {
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number
  description?: string
  timestamp: number
}

export interface ParsedLocation {
  latitude: number
  longitude: number
  uncertainty?: number
  altitude?: number
  description?: string
  timestamp: number
  assetType: string
  geoUri: string
}

class MatrixLocationService extends BaseManager {
  private locationManager: any = null
  private initialized = false

  initialize(): void {
    if (this.initialized) return

    const client = matrixClientService.getClient()
    if (!client) {
      return
    }

    try {
      this.locationManager = (client as any).getLocationManager?.() ?? null
      if (this.locationManager) {
        this.initialized = true
        info('[Location] 服务初始化成功 (SDK LocationManager)')
      } else {
        this.initialized = true
        info('[Location] LocationManager 不可用，使用 fallback 模式')
      }
    } catch (_err) {
      // handleError: [Location] 服务初始化失败: ${err}`)
    }
  }

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
            altitude: position.coords.altitude ?? undefined,
            timestamp: position.timestamp
          })
        },
        (err) => {
          // handleError: [Location] 获取位置失败: ${err.message}`)
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
    if (this.locationManager) {
      try {
        const result = await this.locationManager.sendLocation(roomId, {
          latitude: location.latitude,
          longitude: location.longitude,
          uncertainty: location.accuracy,
          altitude: location.altitude,
          description: location.description,
          timestamp: location.timestamp
        })
        info(`[Location] 发送位置成功 (SDK): ${roomId}`)
        return result.event_id
      } catch (_err) {
        // handleError: [Location] SDK 发送位置失败，尝试 fallback: ${err}`)
      }
    }

    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Location] 客户端未初始化')
    }
    const geoUri = this.buildGeoUri(location)

    const content: any = {
      msgtype: 'm.location',
      body: location.description || geoUri,
      geo_uri: geoUri,
      'm.location': {
        uri: geoUri,
        description: location.description
      },
      'org.matrix.msc3488.location': {
        uri: geoUri,
        description: location.description
      },
      'm.asset': { type: 'm.self' },
      'org.matrix.msc3488.asset': { type: 'm.self' },
      'm.ts': location.timestamp,
      'org.matrix.msc3488.ts': location.timestamp
    }

    const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
    info(`[Location] 发送位置成功 (fallback): ${roomId}`)
    return response.event_id
  }

  parseLocationEvent(event: MatrixEvent): ParsedLocation | null {
    if (this.locationManager) {
      try {
        const parsed = this.locationManager.parseLocationEvent(event)
        if (parsed) {
          return {
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            uncertainty: parsed.uncertainty,
            altitude: parsed.altitude,
            description: parsed.description,
            timestamp: parsed.timestamp,
            assetType: parsed.assetType,
            geoUri: parsed.geoUri
          }
        }
      } catch {
        // fallback to manual parsing
      }
    }

    try {
      const content = event.getContent() as any
      if (content.msgtype !== 'm.location') return null

      const locationContent = content['m.location'] ?? content['org.matrix.msc3488.location']
      const geoUri = content.geo_uri || locationContent?.uri || ''
      const match = geoUri.match(/geo:([-\d.]+),([-\d.]+)(?:;u=([-\d.]+))?(?:;h=([-\d.]+))?/)

      if (!match) return null

      const assetContent = content['m.asset'] ?? content['org.matrix.msc3488.asset']
      const assetType = assetContent?.type ?? 'm.self'

      return {
        latitude: parseFloat(match[1]),
        longitude: parseFloat(match[2]),
        uncertainty: match[3] ? parseFloat(match[3]) : undefined,
        altitude: match[4] ? parseFloat(match[4]) : undefined,
        description: locationContent?.description || content.body,
        timestamp: content['m.ts'] ?? content['org.matrix.msc3488.ts'] ?? event.getTs(),
        assetType,
        geoUri
      }
    } catch (_err) {
      return null
    }
  }

  buildGeoUri(location: LocationData): string {
    let uri = `geo:${location.latitude},${location.longitude}`
    const params: string[] = []

    if (location.accuracy !== undefined) {
      params.push(`u=${location.accuracy}`)
    }
    if (location.altitude !== undefined) {
      params.push(`h=${location.altitude}`)
    }

    if (params.length > 0) {
      uri += `;${params.join(';')}`
    }

    return uri
  }

  getGoogleMapsUrl(location: LocationData): string {
    if (this.locationManager) {
      return this.locationManager.getGoogleMapsUrl(location)
    }
    return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
  }

  getOpenStreetMapUrl(location: LocationData): string {
    if (this.locationManager) {
      return this.locationManager.getOpenStreetMapUrl(location)
    }
    return `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=15/${location.latitude}/${location.longitude}`
  }

  formatCoordinate(value: number, type: 'lat' | 'lon'): string {
    if (this.locationManager) {
      return this.locationManager.formatCoordinate(value, type)
    }

    const absolute = Math.abs(value)
    const degrees = Math.floor(absolute)
    const minutes = Math.floor((absolute - degrees) * 60)
    const seconds = ((absolute - degrees - minutes / 60) * 3600).toFixed(2)
    const direction = type === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'
    return `${degrees}°${minutes}'${seconds}"${direction}`
  }
}

export const matrixLocationService = new MatrixLocationService()
export default matrixLocationService
