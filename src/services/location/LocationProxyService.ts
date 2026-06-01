import { matrixHttpClient } from '@/services/matrix/MatrixHttpClient'
import { MATRIX_PATHS } from '@/services/matrix/paths'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('LocationProxyService')

export type ProxyCoordinate = {
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

export type ReverseGeocodeResult = {
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

function assertCoordinateInRange(lat: number, lng: number): void {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('坐标范围无效')
  }
}

export async function transformCoordinates(lat: number, lng: number): Promise<ProxyCoordinate> {
  assertCoordinateInRange(lat, lng)

  try {
    const result = await matrixHttpClient.requestAppResult<ProxyCoordinate>(
      'GET',
      MATRIX_PATHS.EXTENSIONS.MAP_COORD_TRANSLATE,
      {
        queryParams: { lat, lng }
      }
    )

    if (result.isOk()) {
      return result.value
    }
    throw result.error
  } catch (err) {
    logger.warn(`[LocationProxy] 坐标转换失败: ${err}`)
    return { lat, lng }
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  assertCoordinateInRange(lat, lng)

  try {
    const result = await matrixHttpClient.requestAppResult<{ address: string }>(
      'GET',
      MATRIX_PATHS.EXTENSIONS.MAP_REVERSE_GEOCODE,
      {
        queryParams: { lat, lng }
      }
    )

    if (result.isOk()) {
      return result.value.address
    }
    return ''
  } catch (err) {
    logger.warn(`[LocationProxy] 逆地理编码失败: ${err}`)
    return ''
  }
}

export function getStaticMapUrl(lat: number, lng: number, zoom = 15): string {
  const hsUrl = matrixHttpClient.getHomeserverUrl() || ''
  return `${hsUrl}${MATRIX_PATHS.EXTENSIONS.MAP_STATIC}?lat=${lat}&lng=${lng}&zoom=${zoom}`
}

export async function getStaticMapImage(lat: number, lng: number, zoom = 15): Promise<string> {
  const hsUrl = matrixHttpClient.getHomeserverUrl() || ''
  const token = matrixHttpClient.getAccessToken() || ''
  const url = `${hsUrl}${MATRIX_PATHS.EXTENSIONS.MAP_STATIC}?lat=${lat}&lng=${lng}&zoom=${zoom}`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!response.ok) {
    throw new Error(`获取静态地图失败: ${response.status}`)
  }
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

export const locationProxyService = {
  transformCoordinates,
  reverseGeocode,
  getStaticMapUrl,
  getStaticMapImage
}
