import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGeolocation } from '@/composables/common/useGeolocation'

const { wgs84ToGcj02Mock, getCurrentPositionMock } = vi.hoisted(() => ({
  wgs84ToGcj02Mock: vi.fn((lat: number, lng: number) => ({ lat: lat + 0.001, lng: lng + 0.001 })),
  getCurrentPositionMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/utils/CoordinateTransform', () => ({
  wgs84ToGcj02: wgs84ToGcj02Mock
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

vi.stubGlobal('navigator', {
  geolocation: {
    getCurrentPosition: getCurrentPositionMock
  }
})

describe('useGeolocation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default state', () => {
    const { isLoading, error } = useGeolocation()
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('should have clearError method', () => {
    const hook = useGeolocation()
    expect(hook).toHaveProperty('clearError')
    expect(hook).toHaveProperty('getCurrentPosition')
    expect(hook).toHaveProperty('getLocationWithTransform')
  })

  it('should have computed properties', () => {
    const { isSupported, hasPermission, isLoading, error, currentPosition } = useGeolocation()
    expect(isSupported).toBeDefined()
    expect(hasPermission).toBeDefined()
    expect(isLoading).toBeDefined()
    expect(error).toBeDefined()
    expect(currentPosition).toBeDefined()
  })

  it('getLocationWithTransform returns original WGS-84 (for geo URI) and transformed GCJ-02 (for display)', async () => {
    const wgs = { lat: 39.9042, lng: 116.4074 }
    getCurrentPositionMock.mockImplementation((success: (position: GeolocationPosition) => void) => {
      success({ coords: { latitude: wgs.lat, longitude: wgs.lng } } as GeolocationPosition)
    })

    const { getLocationWithTransform } = useGeolocation()
    const result = await getLocationWithTransform()

    // 发送/存储用 WGS-84 原始坐标
    expect(result.original).toEqual({ lat: wgs.lat, lng: wgs.lng })
    // 显示/逆地理编码用 GCJ-02（此处用 mock 断言转换被正确应用）
    expect(result.transformed).toEqual({ lat: wgs.lat + 0.001, lng: wgs.lng + 0.001 })
    expect(result.transformed).not.toEqual(result.original)
    expect(wgs84ToGcj02Mock).toHaveBeenCalledWith(wgs.lat, wgs.lng)
  })
})
