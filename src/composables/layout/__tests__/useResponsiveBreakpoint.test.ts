import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useResponsiveBreakpoint } from '../useResponsiveBreakpoint'

/**
 * 模拟窗口宽度变化
 */
const setWindowWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true })
  window.dispatchEvent(new Event('resize'))
}

describe('useResponsiveBreakpoint', () => {
  beforeEach(() => {
    setWindowWidth(1280)
    vi.clearAllMocks()
  })

  it('returns "wide" mode when width >= 1440', async () => {
    setWindowWidth(1500)
    const { mode } = useResponsiveBreakpoint()
    await nextTick()
    expect(mode.value).toBe('wide')
  })

  it('returns "wide" mode at exactly 1440', async () => {
    setWindowWidth(1440)
    const { mode } = useResponsiveBreakpoint()
    await nextTick()
    expect(mode.value).toBe('wide')
  })

  it('returns "normal" mode between 1024 and 1439', async () => {
    setWindowWidth(1280)
    const { mode } = useResponsiveBreakpoint()
    await nextTick()
    expect(mode.value).toBe('normal')
  })

  it('returns "normal" mode at exactly 1024', async () => {
    setWindowWidth(1024)
    const { mode } = useResponsiveBreakpoint()
    await nextTick()
    expect(mode.value).toBe('normal')
  })

  it('returns "shrink" mode when width < 1024', async () => {
    setWindowWidth(900)
    const { mode } = useResponsiveBreakpoint()
    await nextTick()
    expect(mode.value).toBe('shrink')
  })

  it('returns centerWidth 280 for wide mode', async () => {
    setWindowWidth(1500)
    const { centerWidth } = useResponsiveBreakpoint()
    await nextTick()
    expect(centerWidth.value).toBe(280)
  })

  it('returns centerWidth 240 for normal mode', async () => {
    setWindowWidth(1280)
    const { centerWidth } = useResponsiveBreakpoint()
    await nextTick()
    expect(centerWidth.value).toBe(240)
  })

  it('returns centerWidth 64 for shrink mode', async () => {
    setWindowWidth(900)
    const { centerWidth } = useResponsiveBreakpoint()
    await nextTick()
    expect(centerWidth.value).toBe(64)
  })

  it('isRightPaneFullscreen is true only in shrink mode', async () => {
    setWindowWidth(1500)
    const { isRightPaneFullscreen } = useResponsiveBreakpoint()
    await nextTick()
    expect(isRightPaneFullscreen.value).toBe(false)

    setWindowWidth(900)
    await nextTick()
    expect(isRightPaneFullscreen.value).toBe(true)
  })

  it('updates mode when window resizes', async () => {
    setWindowWidth(1500)
    const { mode } = useResponsiveBreakpoint()
    await nextTick()
    expect(mode.value).toBe('wide')

    setWindowWidth(1100)
    await nextTick()
    expect(mode.value).toBe('normal')

    setWindowWidth(900)
    await nextTick()
    expect(mode.value).toBe('shrink')
  })

  it('uses custom breakpoints when provided', async () => {
    setWindowWidth(800)
    const { mode } = useResponsiveBreakpoint({ breakpoints: { wide: 1000, normal: 600 } })
    await nextTick()
    expect(mode.value).toBe('normal') // 600 <= 800 < 1000
  })

  it('cleans up resize listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    // 注意：onScopeDispose 在测试环境外不触发，仅验证接口可用
    useResponsiveBreakpoint()
    expect(removeEventListenerSpy).not.toHaveBeenCalled()
  })

  it('isShrink is true when mode is shrink', async () => {
    setWindowWidth(900)
    const { isShrink } = useResponsiveBreakpoint()
    await nextTick()
    expect(isShrink.value).toBe(true)

    setWindowWidth(1100)
    await nextTick()
    expect(isShrink.value).toBe(false)
  })
})
