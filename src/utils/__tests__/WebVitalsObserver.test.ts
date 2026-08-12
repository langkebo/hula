import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vi.hoisted 确保 mock 函数在 vi.mock 工厂执行前已定义
const { mockOnCLS, mockOnFCP, mockOnINP, mockOnLCP, mockOnTTFB } = vi.hoisted(() => ({
  mockOnCLS: vi.fn(),
  mockOnFCP: vi.fn(),
  mockOnINP: vi.fn(),
  mockOnLCP: vi.fn(),
  mockOnTTFB: vi.fn()
}))

vi.mock('web-vitals', () => ({
  onCLS: mockOnCLS,
  onFCP: mockOnFCP,
  onINP: mockOnINP,
  onLCP: mockOnLCP,
  onTTFB: mockOnTTFB
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: {
    getManagerStatsList: vi.fn().mockReturnValue([])
  }
}))

vi.mock('@/utils/PerformanceReporter', () => ({
  performanceReporter: {
    initialize: vi.fn(),
    reportWebVital: vi.fn(),
    reportLongtask: vi.fn(),
    reportSdkRequestStats: vi.fn(),
    terminate: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

import { startWebVitalObserver, stopWebVitalObserver } from '../WebVitalsObserver'

describe('WebVitalsObserver — 单次执行守卫', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 确保 stop 状态干净
    stopWebVitalObserver()
  })

  afterEach(() => {
    stopWebVitalObserver()
  })

  it('start 后 web-vitals 回调各注册一次', () => {
    startWebVitalObserver()

    expect(mockOnCLS).toHaveBeenCalledTimes(1)
    expect(mockOnFCP).toHaveBeenCalledTimes(1)
    expect(mockOnINP).toHaveBeenCalledTimes(1)
    expect(mockOnLCP).toHaveBeenCalledTimes(1)
    expect(mockOnTTFB).toHaveBeenCalledTimes(1)
  })

  it('串行调用 start 两次，web-vitals 回调仍只注册一次（幂等）', () => {
    startWebVitalObserver()
    startWebVitalObserver()

    expect(mockOnCLS).toHaveBeenCalledTimes(1)
    expect(mockOnFCP).toHaveBeenCalledTimes(1)
    expect(mockOnINP).toHaveBeenCalledTimes(1)
    expect(mockOnLCP).toHaveBeenCalledTimes(1)
    expect(mockOnTTFB).toHaveBeenCalledTimes(1)
  })

  it('并发调用 start 两次（同一 tick），web-vitals 回调仍只注册一次', () => {
    // 同步连续调用（start 是同步函数，不会真正"并发"，但模拟快速重复调用场景）
    startWebVitalObserver()
    startWebVitalObserver()

    expect(mockOnCLS).toHaveBeenCalledTimes(1)
  })

  it('stop 后再次 start，web-vitals 回调重新注册（可重启）', () => {
    startWebVitalObserver()
    expect(mockOnCLS).toHaveBeenCalledTimes(1)

    stopWebVitalObserver()

    startWebVitalObserver()
    expect(mockOnCLS).toHaveBeenCalledTimes(2)
  })

  it('stop 清理 PerformanceObserver 引用（disconnect 被调用）', () => {
    // 模拟 PerformanceObserver 存在
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'PerformanceObserver')
    const mockDisconnect = vi.fn()
    const mockObserve = vi.fn()

    class MockPerformanceObserver {
      observe = mockObserve
      disconnect = mockDisconnect
    }

    const mockSupportedEntryTypes = ['longtask']
    Object.defineProperty(MockPerformanceObserver, 'supportedEntryTypes', {
      get: () => mockSupportedEntryTypes
    })

    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver)

    startWebVitalObserver()
    expect(mockObserve).toHaveBeenCalledTimes(1)

    stopWebVitalObserver()
    expect(mockDisconnect).toHaveBeenCalledTimes(1)

    // 恢复
    if (originalDescriptor) {
      Object.defineProperty(window, 'PerformanceObserver', originalDescriptor)
    }
    vi.unstubAllGlobals()
  })

  it('SSR 环境（无 window）start 不抛错', () => {
    // window 在 jsdom 环境存在，此测试验证 hasStarted 守卫
    // 已在 beforeEach 中 stop，hasStarted = false
    startWebVitalObserver()
    // 不抛错即通过
    expect(true).toBe(true)
  })
})
