/**
 * 地理位置 URI 解析工具
 *
 * 用于解析 Matrix MSC3488/MSC1767 位置与信标事件中的 geo URI，
 * 并统一读取各版本键名（稳定键 `m.location`、不稳定键 `org.matrix.msc3488.location`、旧版 `geo_uri`）。
 */

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
