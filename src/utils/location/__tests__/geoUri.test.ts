import { describe, expect, it } from 'vitest'
import { locationEventGeoUri, parseGeoUri, toGcj02LocationData } from '@/utils/location'

describe('parseGeoUri', () => {
  it('parses latitude and longitude from a geo uri', () => {
    expect(parseGeoUri('geo:39.9042,116.4074')).toEqual({
      latitude: 39.9042,
      longitude: 116.4074,
      uncertainty: undefined
    })
  })

  it('parses the uncertainty parameter', () => {
    expect(parseGeoUri('geo:39.9,116.4;u=10')).toEqual({
      latitude: 39.9,
      longitude: 116.4,
      uncertainty: 10
    })
  })

  it('parses negative coordinates', () => {
    expect(parseGeoUri('geo:-33.87,151.21')).toEqual({
      latitude: -33.87,
      longitude: 151.21,
      uncertainty: undefined
    })
  })

  it('returns null for empty or invalid input', () => {
    expect(parseGeoUri('')).toBeNull()
    expect(parseGeoUri(undefined)).toBeNull()
    expect(parseGeoUri(null)).toBeNull()
    expect(parseGeoUri('not-a-geo-uri')).toBeNull()
  })
})

describe('locationEventGeoUri', () => {
  it('reads uri from the stable m.location key', () => {
    expect(locationEventGeoUri({ 'm.location': { uri: 'geo:1,2' } })).toBe('geo:1,2')
  })

  it('reads uri from the unstable org.matrix.msc3488.location key', () => {
    expect(locationEventGeoUri({ 'org.matrix.msc3488.location': { uri: 'geo:3,4' } })).toBe('geo:3,4')
  })

  it('falls back to legacy geo_uri', () => {
    expect(locationEventGeoUri({ geo_uri: 'geo:5,6' })).toBe('geo:5,6')
  })

  it('prefers m.location over geo_uri', () => {
    expect(locationEventGeoUri({ 'm.location': { uri: 'geo:7,8' }, geo_uri: 'geo:5,6' })).toBe('geo:7,8')
  })

  it('returns undefined when no uri is present', () => {
    expect(locationEventGeoUri({})).toBeUndefined()
    expect(locationEventGeoUri({ 'm.location': {} })).toBeUndefined()
  })
})

describe('toGcj02LocationData', () => {
  it('将 WGS-84 位置消息体转换为 GCJ-02 地图数据', () => {
    const result = toGcj02LocationData({
      latitude: '39.9042',
      longitude: '116.4074',
      address: '北京',
      precision: '高精度',
      timestamp: '1700000000000'
    })

    expect(result).not.toBeNull()
    // 中国境内坐标会被偏移（GCJ-02 偏移量约 0.001~0.006 度），结果仍在原坐标附近
    expect(result!.latitude).toBeCloseTo(39.9042, 1)
    expect(result!.longitude).toBeCloseTo(116.4074, 1)
    expect(result!.address).toBe('北京')
    expect(result!.timestamp).toBe(1700000000000)
  })

  it('经纬度非法时返回 null', () => {
    expect(toGcj02LocationData(undefined)).toBeNull()
    expect(
      toGcj02LocationData({ latitude: 'invalid', longitude: '116.4074', address: '', precision: '', timestamp: '0' })
    ).toBeNull()
  })
})
