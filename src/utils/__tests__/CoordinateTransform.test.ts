import { describe, expect, it } from 'vitest'
import {
  bd09ToGcj02,
  bd09ToWgs84,
  calculateDistance,
  gcj02ToBd09,
  gcj02ToWgs84,
  transformCoordinate,
  wgs84ToBd09,
  wgs84ToGcj02
} from '../CoordinateTransform'

const isClose = (a: number, b: number, eps = 0.0005) => Math.abs(a - b) < eps

describe('CoordinateTransform', () => {
  describe('wgs84ToGcj02 / gcj02ToWgs84', () => {
    it('returns the original coordinate outside China', () => {
      const result = wgs84ToGcj02(40.7128, -74.006)
      expect(result).toEqual({ lat: 40.7128, lng: -74.006 })
    })

    it('shifts coordinates inside China', () => {
      const beijingWgs = { lat: 39.9042, lng: 116.4074 }
      const gcj = wgs84ToGcj02(beijingWgs.lat, beijingWgs.lng)
      expect(gcj.lat).not.toBe(beijingWgs.lat)
      expect(gcj.lng).not.toBe(beijingWgs.lng)
    })

    it('round trips approximately back to the original (within ~10m)', () => {
      const orig = { lat: 31.2304, lng: 121.4737 } // Shanghai
      const gcj = wgs84ToGcj02(orig.lat, orig.lng)
      const back = gcj02ToWgs84(gcj.lat, gcj.lng)
      expect(isClose(back.lat, orig.lat, 0.001)).toBe(true)
      expect(isClose(back.lng, orig.lng, 0.001)).toBe(true)
    })

    it('gcj02ToWgs84 also short-circuits outside China', () => {
      expect(gcj02ToWgs84(0, 0)).toEqual({ lat: 0, lng: 0 })
    })
  })

  describe('gcj02ToBd09 / bd09ToGcj02', () => {
    it('round trips approximately', () => {
      const gcj = { lat: 39.9042, lng: 116.4074 }
      const bd = gcj02ToBd09(gcj.lat, gcj.lng)
      const back = bd09ToGcj02(bd.lat, bd.lng)
      expect(isClose(back.lat, gcj.lat)).toBe(true)
      expect(isClose(back.lng, gcj.lng)).toBe(true)
    })

    it('gcj02 → bd09 shifts north-east per the algorithm', () => {
      const bd = gcj02ToBd09(39.9042, 116.4074)
      expect(bd.lat).toBeGreaterThan(39.9042)
      expect(bd.lng).toBeGreaterThan(116.4074)
    })
  })

  describe('wgs84ToBd09 / bd09ToWgs84', () => {
    it('chains the conversions and round trips', () => {
      const wgs = { lat: 31.2304, lng: 121.4737 }
      const bd = wgs84ToBd09(wgs.lat, wgs.lng)
      const back = bd09ToWgs84(bd.lat, bd.lng)
      expect(isClose(back.lat, wgs.lat, 0.001)).toBe(true)
      expect(isClose(back.lng, wgs.lng, 0.001)).toBe(true)
    })
  })

  describe('calculateDistance', () => {
    it('returns 0 for identical points', () => {
      expect(calculateDistance(0, 0, 0, 0)).toBe(0)
    })

    it('computes ~111km per degree of latitude at the equator', () => {
      const distance = calculateDistance(0, 0, 1, 0)
      expect(distance).toBeGreaterThan(110_000)
      expect(distance).toBeLessThan(112_000)
    })

    it('is symmetric', () => {
      const d1 = calculateDistance(31.23, 121.47, 39.9, 116.4)
      const d2 = calculateDistance(39.9, 116.4, 31.23, 121.47)
      expect(isClose(d1, d2, 1)).toBe(true)
    })
  })

  describe('transformCoordinate', () => {
    it('returns original when fromType === toType', () => {
      const result = transformCoordinate(1, 2, 'WGS84', 'WGS84')
      expect(result).toEqual({ lat: 1, lng: 2 })
    })

    it('dispatches to the correct converter (WGS84 → GCJ02)', () => {
      const direct = wgs84ToGcj02(39.9042, 116.4074)
      const dispatched = transformCoordinate(39.9042, 116.4074, 'WGS84', 'GCJ02')
      expect(dispatched).toEqual(direct)
    })

    it('dispatches to BD09 → WGS84', () => {
      const direct = bd09ToWgs84(39.9042, 116.4074)
      const dispatched = transformCoordinate(39.9042, 116.4074, 'BD09', 'WGS84')
      expect(dispatched).toEqual(direct)
    })

    it('returns original on unsupported pair (logs warning)', () => {
      const result = transformCoordinate(1, 2, 'WGS84' as any, 'UNKNOWN' as any)
      expect(result).toEqual({ lat: 1, lng: 2 })
    })
  })
})
