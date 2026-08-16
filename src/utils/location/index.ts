/**
 * 地理位置 URI 解析工具
 *
 * 用于解析 Matrix MSC3488/MSC1767 位置与信标事件中的 geo URI，
 * 并统一读取各版本键名（稳定键 `m.location`、不稳定键 `org.matrix.msc3488.location`、旧版 `geo_uri`）。
 */

import type { LocationBody } from '@/services/types'
import { wgs84ToGcj02 } from '@/utils/CoordinateTransform'

export interface GeoUriResult {
  /** 纬度 */
  latitude: number
  /** 经度 */
  longitude: number
  /** 定位精度（米），来自 geo URI 的 `;u=` 参数 */
  uncertainty?: number
}

const GEO_URI_PATTERN = /^geo:([-+]?\d+(?:\.\d+)?),([-+]?\d+(?:\.\d+)?)(?:;u=(\d+(?:\.\d+)?))?/i

/**
 * 解析 geo URI（如 `geo:39.9042,116.4074;u=10`）
 * @param uri geo URI 字符串
 * @returns 经纬度与可选精度；无法解析时返回 null
 */
export function parseGeoUri(uri: string | null | undefined): GeoUriResult | null {
  if (!uri) return null
  const match = GEO_URI_PATTERN.exec(uri)
  if (!match) return null
  return {
    latitude: Number.parseFloat(match[1]),
    longitude: Number.parseFloat(match[2]),
    uncertainty: match[3] !== undefined ? Number.parseFloat(match[3]) : undefined
  }
}

/**
 * 从 Matrix 位置/信标事件 content 中读取 geo URI。
 * 兼容稳定键 `m.location`、不稳定键 `org.matrix.msc3488.location` 以及旧版 `geo_uri`。
 * @param content 事件 content
 * @returns geo URI；找不到时返回 undefined
 */
export function locationEventGeoUri(content: Record<string, unknown>): string | undefined {
  for (const key of ['m.location', 'org.matrix.msc3488.location']) {
    const location = content[key]
    if (location && typeof location === 'object') {
      const uri = (location as Record<string, unknown>).uri
      if (typeof uri === 'string') return uri
    }
  }
  return typeof content.geo_uri === 'string' ? content.geo_uri : undefined
}

/**
 * `StaticProxyMap`（腾讯静态图）显示所需的数据结构：经纬度已转换为 GCJ-02。
 */
export interface Gcj02LocationData {
  latitude: number
  longitude: number
  address?: string
  timestamp: number
}

/**
 * 将收到的位置消息体（geo URI 存 WGS-84）转换为腾讯地图显示用的 GCJ-02 坐标。
 * 境外坐标 `wgs84ToGcj02` 不转换、原样返回；仅中国境内坐标会被偏移。
 * @param body 位置消息体
 * @returns 可交给 `StaticProxyMap` 的数据；经纬度非法时返回 null
 */
export function toGcj02LocationData(body: LocationBody | undefined): Gcj02LocationData | null {
  const latitude = Number(body?.latitude)
  const longitude = Number(body?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const gcj = wgs84ToGcj02(latitude, longitude)
  return {
    latitude: gcj.lat,
    longitude: gcj.lng,
    address: body?.address,
    timestamp: Number(body?.timestamp) || Date.now()
  }
}
