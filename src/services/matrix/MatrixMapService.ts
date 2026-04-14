import { Method } from 'matrix-js-sdk'
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info, error as logError } from '@tauri-apps/plugin-log'
import { wgs84ToGcj02 } from '@/utils/CoordinateTransform'

export interface TransformedCoordinate {
  lat: number
  lng: number
}

export interface AddressComponent {
  province: string
  city: string
  district: string
  street: string
  street_number: string
}

export interface ReverseGeocodeResult {
  address: string
  formatted_addresses: {
    recommend: string
    rough: string
  }
  address_component: AddressComponent
  ad_info: {
    nation_code: string
    adcode: string
    city_code: string
  }
}

class MatrixMapService extends BaseManager {
  private get client() {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('Matrix client not initialized')
    return client
  }

  private httpRequest<T>(
    method: Method,
    path: string,
    queryParams?: Record<string, unknown>,
    body?: Record<string, unknown>
  ): Promise<T> {
    return (this.client.http as any).authedRequest(method, path, queryParams ?? {}, body ?? {})
  }

  async transformCoordinates(lat: number, lng: number): Promise<TransformedCoordinate> {
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error('坐标范围无效')
    try {
      const data = await this.httpRequest<{ lat: number; lng: number }>(
        Method.Get,
        '/_matrix/client/v1/location/coord_transform',
        { lat, lng }
      )
      info(`[MatrixMap] 坐标转换成功`)
      return { lat: data.lat, lng: data.lng }
    } catch (err) {
      logError(`[MatrixMap] 坐标转换失败: ${err}`)
      return wgs84ToGcj02(lat, lng)
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error('坐标范围无效')
    try {
      const data = await this.httpRequest<ReverseGeocodeResult>(
        Method.Get,
        '/_matrix/client/v1/location/reverse_geocode',
        { lat, lng }
      )
      info(`[MatrixMap] 逆地理编码成功`)
      return data
    } catch (err) {
      logError(`[MatrixMap] 逆地理编码失败: ${err}`)
      return null
    }
  }

  async getStaticMap(lat: number, lng: number, width = 600, height = 400, zoom = 18): Promise<string> {
    try {
      const data = await this.httpRequest<{ dataUrl: string }>(Method.Get, '/_matrix/client/v1/location/static_map', {
        lat,
        lng,
        width,
        height,
        zoom
      })
      info(`[MatrixMap] 获取静态地图成功`)
      return data.dataUrl || ''
    } catch (err) {
      logError(`[MatrixMap] 获取静态地图失败: ${err}`)
      return ''
    }
  }
}

export const matrixMapService = new MatrixMapService()
