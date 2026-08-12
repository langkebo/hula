/**
 * @deprecated 此文件已废弃，将迁移到 Matrix Location API
 * 请使用 matrix-js-sdk 的位置功能或第三方地图 SDK
 * 迁移完成后此文件将被删除
 */

import { matrixExtensionEndpoints } from '@/services/backend'
import { matrixHttpClient } from '@/services/matrix/MatrixHttpClient'
import { wgs84ToGcj02 } from '@/utils/CoordinateTransform'

type TransformedCoordinate = {
  lat: number
  lng: number
}

type AddressComponent = {
  province: string
  city: string
  district: string
  street: string
  street_number: string
}

type ReverseGeocodeResult = {
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
// 使用后端代理，不再需要 JSONP

// 坐标系转换（WGS84 -> GCJ-02）
const _transformCoordinates = async (lat: number, lng: number): Promise<TransformedCoordinate> => {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error('坐标范围无效')
  try {
    const data = await matrixHttpClient.requestResult<{ lat: number; lng: number }>({
      url: matrixExtensionEndpoints.MAP_COORD_TRANSLATE,
      params: { lat, lng }
    })
    if (data.ok && data.data) {
      return { lat: data.data.lat, lng: data.data.lng }
    }
    return wgs84ToGcj02(lat, lng)
  } catch {
    return wgs84ToGcj02(lat, lng)
  }
}

// 逆地理编码（获取地址信息）
export const reverseGeocode = async (lat: number, lng: number): Promise<ReverseGeocodeResult | null> => {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error('坐标范围无效')
  try {
    const data = await matrixHttpClient.requestResult<ReverseGeocodeResult>({
      url: matrixExtensionEndpoints.MAP_REVERSE_GEOCODE,
      params: { lat, lng }
    })
    return data.ok && data.data ? data.data : null
  } catch {
    return null
  }
}

export const getStaticMap = async (lat: number, lng: number, width = 600, height = 400, zoom = 18): Promise<string> => {
  const data = await matrixHttpClient.requestResult<{ dataUrl: string }>({
    url: matrixExtensionEndpoints.MAP_STATIC,
    params: { lat, lng, width, height, zoom }
  })
  return data.ok && data.data ? data.data.dataUrl || '' : ''
}
