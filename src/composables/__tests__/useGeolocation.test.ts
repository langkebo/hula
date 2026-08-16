import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGeolocation } from '@/composables/common/useGeolocation'

const { wgs84ToGcj02Mock, getCurrentPositionMock, watchPositionMock, clearWatchMock } = vi.hoisted(() => ({
  wgs84ToGcj02Mock: vi.fn((lat: number, lng: number) => ({ lat: lat + 0.001, lng: lng + 0.001 })),
  getCurrentPositionMock: vi.fn(),
  watchPositionMock: vi.fn(),
  clearWatchMock: vi.fn()
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

/** 构造一个带有 code 与标准常量的 mock GeolocationPositionError */
const makeGeolocationError = (code: number): GeolocationPositionError =>
  ({
    code,
    message: 'mock geolocation error',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3
  }) as GeolocationPositionError

describe('useGeolocation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
        watchPosition: watchPositionMock,
        clearWatch: clearWatchMock
      }
    })
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

  it('watchPosition calls onUpdate on position change and returns a clear function calling clearWatch', () => {
    const watchId = 42
    const position = { coords: { latitude: 1.23, longitude: 4.56 } } as GeolocationPosition
    watchPositionMock.mockImplementation((success: (p: GeolocationPosition) => void) => {
      success(position)
      return watchId
    })

    const { watchPosition } = useGeolocation()
    const onUpdate = vi.fn()
    const onError = vi.fn()

    const clear = watchPosition(onUpdate, onError)

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith(position)
    expect(watchPositionMock).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()

    clear()
    expect(clearWatchMock).toHaveBeenCalledTimes(1)
    expect(clearWatchMock).toHaveBeenCalledWith(watchId)
  })

  it('watchPosition updates internal state on position change', () => {
    const position = { coords: { latitude: 10, longitude: 20 } } as GeolocationPosition
    watchPositionMock.mockImplementation((success: (p: GeolocationPosition) => void) => success(position))

    const { watchPosition, currentPosition } = useGeolocation()
    watchPosition(vi.fn(), vi.fn())

    // state 经过 Vue ref 深度代理，直接 toBe 引用会失败，改为断言坐标值
    expect(currentPosition.value?.coords.latitude).toBe(10)
    expect(currentPosition.value?.coords.longitude).toBe(20)
  })

  it.each([
    [1, 'message.location.hook.permission_denied'],
    [2, 'message.location.hook.position_unavailable'],
    [3, 'message.location.hook.timeout']
  ])('watchPosition maps error code %i to %s', (code, expectedMessage) => {
    watchPositionMock.mockImplementation((_success: unknown, error: (e: GeolocationPositionError) => void) => {
      error(makeGeolocationError(code))
      return 1
    })

    const { watchPosition } = useGeolocation()
    const onError = vi.fn()

    watchPosition(vi.fn(), onError)

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(new Error(expectedMessage))
  })

  it('watchPosition calls onError when geolocation is unsupported and returns a no-op clear', () => {
    vi.stubGlobal('navigator', {})

    const { watchPosition } = useGeolocation()
    const onError = vi.fn()

    const clear = watchPosition(vi.fn(), onError)

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(new Error('message.location.hook.unsupported'))
    expect(watchPositionMock).not.toHaveBeenCalled()
    expect(typeof clear).toBe('function')
  })
})
