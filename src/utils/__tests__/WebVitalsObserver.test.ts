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

import { createWebVitalsObserver, startWebVitalObserver, stopWebVitalObserver } from '../WebVitalsObserver'

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

  it('无 window（SSR）环境下 start 直接返回且不注册回调', () => {
    vi.stubGlobal('window', undefined)
    const observer = createWebVitalsObserver()

    expect(() => observer.start()).not.toThrow()
    // start 在无 window 时提前返回，不应注册任何 web-vitals 回调
    expect(mockOnCLS).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('createWebVitalsObserver 两次调用互相隔离（各自独立注册与停止）', () => {
    const observerA = createWebVitalsObserver()
    const observerB = createWebVitalsObserver()

    observerA.start()
    expect(mockOnCLS).toHaveBeenCalledTimes(1)

    // B 是独立实例，不受 A 已启动的影响
    observerB.start()
    expect(mockOnCLS).toHaveBeenCalledTimes(2)

    // A 停止只影响自身，B 仍可再次启动（B 的 hasStarted 保持 false 后重置）
    observerA.stop()
    observerA.start()
    expect(mockOnCLS).toHaveBeenCalledTimes(3)

    observerB.stop()
  })

  it('两个实例的 SDK 请求统计定时器互相隔离', () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

    const observerA = createWebVitalsObserver()
    const observerB = createWebVitalsObserver()

    observerA.start({ prometheusEndpoint: 'http://localhost:9090' })
    observerB.start({ prometheusEndpoint: 'http://localhost:9090' })

    // 每个实例各自创建一个轮询定时器
    expect(setIntervalSpy).toHaveBeenCalledTimes(2)

    observerA.stop()
    observerB.stop()

    setIntervalSpy.mockRestore()
    vi.useRealTimers()
  })
})
