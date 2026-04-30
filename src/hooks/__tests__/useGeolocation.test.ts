import { describe, expect, it, vi } from 'vitest'
import { useGeolocation } from '../useGeolocation'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/utils/CoordinateTransform', () => ({
  wgs84ToGcj02: vi.fn((lat, lng) => ({ lat: lat + 0.001, lng: lng + 0.001 }))
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => ({
    warn: vi.fn()
  }))
}))

describe('useGeolocation', () => {
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
})
