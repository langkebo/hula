import { describe, expect, it } from 'vitest'
import { locationEventGeoUri, parseGeoUri } from '@/utils/location'

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
