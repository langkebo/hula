import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { isLandscapeOrientation, useLandscape } from '../useLandscape'

describe('isLandscapeOrientation', () => {
  it('横屏且宽度 >= 768 时返回 true', () => {
    expect(isLandscapeOrientation(1024, 768)).toBe(true)
  })

  it('竖屏时返回 false', () => {
    expect(isLandscapeOrientation(768, 1024)).toBe(false)
  })

  it('宽度 < 768 时返回 false（即使横屏）', () => {
    expect(isLandscapeOrientation(600, 400)).toBe(false)
  })

  it('宽度 = 768 且横屏时返回 true', () => {
    expect(isLandscapeOrientation(768, 500)).toBe(true)
  })

  it('宽高相等时返回 false', () => {
    expect(isLandscapeOrientation(800, 800)).toBe(false)
  })
})

describe('useLandscape', () => {
  let matchMediaSpy: ReturnType<typeof vi.fn>
  const originalInnerWidth = window.innerWidth
  const originalInnerHeight = window.innerHeight

  function createMediaQueryList(): MediaQueryList {
    const listeners = new Set<(e: MediaQueryListEvent) => void>()
    return {
      matches: false,
      media: '(orientation: landscape)',
      onchange: null,
      addEventListener: vi.fn((_, listener: (e: MediaQueryListEvent) => void) => {
        listeners.add(listener)
      }),
      removeEventListener: vi.fn((_, listener: (e: MediaQueryListEvent) => void) => {
        listeners.delete(listener)
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true)
    } as unknown as MediaQueryList
  }

  function setViewport(width: number, height: number) {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: width
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: height
    })
  }

  beforeEach(() => {
    matchMediaSpy = vi.fn().mockReturnValue(createMediaQueryList())
    vi.stubGlobal('matchMedia', matchMediaSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setViewport(originalInnerWidth, originalInnerHeight)
  })

  function mountComposable() {
    let api!: ReturnType<typeof useLandscape>
    const Comp = defineComponent({
      setup() {
        api = useLandscape()
        return () => null
      }
    })
    const wrapper = mount(Comp)
    return { api, wrapper }
  }

  it('返回 isLandscape ref', () => {
    const { api } = mountComposable()
    expect(api).toHaveProperty('isLandscape')
    expect(typeof api.isLandscape.value).toBe('boolean')
  })

  it('横屏（宽 >= 768 且宽 > 高）时 isLandscape 为 true', () => {
    setViewport(1024, 768)
    const { api } = mountComposable()
    expect(api.isLandscape.value).toBe(true)
  })

  it('竖屏时 isLandscape 为 false', () => {
    setViewport(375, 812)
    const { api } = mountComposable()
    expect(api.isLandscape.value).toBe(false)
  })

  it('宽度 < 768 时即使横屏也返回 false', () => {
    setViewport(600, 400)
    const { api } = mountComposable()
    expect(api.isLandscape.value).toBe(false)
  })

  it('resize 事件触发后更新 isLandscape', async () => {
    setViewport(375, 812)
    const { api } = mountComposable()
    expect(api.isLandscape.value).toBe(false)

    setViewport(1024, 768)
    window.dispatchEvent(new Event('resize'))
    await vi.dynamicImportSettled()

    expect(api.isLandscape.value).toBe(true)
  })

  it('使用 matchMedia 监听 orientation 变化', () => {
    mountComposable()
    expect(matchMediaSpy).toHaveBeenCalledWith('(orientation: landscape)')
  })

  it('组件卸载时移除事件监听', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const { wrapper } = mountComposable()
    const spyCallsBeforeUnmount = removeEventListenerSpy.mock.calls.length
    wrapper.unmount()
    const spyCallsAfterUnmount = removeEventListenerSpy.mock.calls.length
    expect(spyCallsAfterUnmount).toBeGreaterThan(spyCallsBeforeUnmount)
  })
})
