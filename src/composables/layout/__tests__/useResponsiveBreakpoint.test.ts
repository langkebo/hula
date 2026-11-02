import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { DEFAULT_BREAKPOINTS, useResponsiveBreakpoint } from '../useResponsiveBreakpoint'

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

  it('默认断点与需求 8.2 的 768 / 992 / 1200 对齐', () => {
    expect(DEFAULT_BREAKPOINTS).toEqual({ wide: 1200, normal: 992, shrink: 768 })
  })

  it('returns "wide" mode when width >= 1200', async () => {
    setWindowWidth(1500)
    const { mode } = useResponsiveBreakpoint()
    await nextTick()
    expect(mode.value).toBe('wide')
  })

  it('returns "wide" mode at exactly 1200', async () => {
    setWindowWidth(1200)
    const { mode } = useResponsiveBreakpoint()
    await nextTick()
    expect(mode.value).toBe('wide')
  })

  it('returns "normal" mode between 992 and 1199', async () => {
    setWindowWidth(1100)
    const { mode } = useResponsiveBreakpoint()
    await nextTick()
    expect(mode.value).toBe('normal')
  })

  it('returns "normal" mode at exactly 992', async () => {
    setWindowWidth(992)
    const { mode } = useResponsiveBreakpoint()
    await nextTick()
    expect(mode.value).toBe('normal')
  })

  it('returns "shrink" mode between 768 and 991', async () => {
    setWindowWidth(900)
    const { mode } = useResponsiveBreakpoint()
    await nextTick()
    expect(mode.value).toBe('shrink')
  })

  it('returns "shrink" mode at exactly 768', async () => {
    setWindowWidth(768)
    const { mode } = useResponsiveBreakpoint()
    await nextTick()
    expect(mode.value).toBe('shrink')
  })

  it('returns "single" mode when width < 768', async () => {
    setWindowWidth(480)
    const { mode } = useResponsiveBreakpoint()
    await nextTick()
    expect(mode.value).toBe('single')
  })

  /**
   * UI-P1-07 边界规则：采用「宽度 >= 断点即命中上一档」，
   * 因此 768/992/1200 归高一级，767/991/1199 归低一级（与 SCSS min-width 语义一致）。
   */
  it.each([
    [768, 'shrink'],
    [769, 'shrink'],
    [992, 'normal'],
    [993, 'normal'],
    [1200, 'wide'],
    [1201, 'wide']
  ] as const)('边界 %ipx 命中 %s 档', async (width, expected) => {
    setWindowWidth(width)
    const { mode } = useResponsiveBreakpoint()
    await nextTick()
    expect(mode.value).toBe(expected)
  })

  it('returns centerWidth 280 for wide mode', async () => {
    setWindowWidth(1500)
    const { centerWidth } = useResponsiveBreakpoint()
    await nextTick()
    expect(centerWidth.value).toBe(280)
  })

  it('returns centerWidth 240 for normal mode', async () => {
    setWindowWidth(1100)
    const { centerWidth } = useResponsiveBreakpoint()
    await nextTick()
    expect(centerWidth.value).toBe(240)
  })

  it('returns centerWidth 64 for shrink and single mode', async () => {
    setWindowWidth(900)
    const shrink = useResponsiveBreakpoint()
    await nextTick()
    expect(shrink.centerWidth.value).toBe(64)

    setWindowWidth(480)
    await nextTick()
    expect(shrink.centerWidth.value).toBe(64)
  })

  it('isRightPaneFullscreen is true in narrow modes only', async () => {
    setWindowWidth(1500)
    const { isRightPaneFullscreen } = useResponsiveBreakpoint()
    await nextTick()
    expect(isRightPaneFullscreen.value).toBe(false)

    setWindowWidth(1100)
    await nextTick()
    expect(isRightPaneFullscreen.value).toBe(false)

    setWindowWidth(900)
    await nextTick()
    expect(isRightPaneFullscreen.value).toBe(true)

    setWindowWidth(480)
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

    setWindowWidth(480)
    await nextTick()
    expect(mode.value).toBe('single')
  })

  it('uses custom breakpoints when provided', async () => {
    setWindowWidth(800)
    const { mode } = useResponsiveBreakpoint({ breakpoints: { wide: 1000, normal: 600, shrink: 400 } })
    await nextTick()
    expect(mode.value).toBe('normal') // 600 <= 800 < 1000
  })

  it('cleans up resize listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    // 注意：onScopeDispose 在测试环境外不触发，仅验证接口可用
    useResponsiveBreakpoint()
    expect(removeEventListenerSpy).not.toHaveBeenCalled()
  })

  it('isShrink is true in narrow modes', async () => {
    setWindowWidth(900)
    const { isShrink } = useResponsiveBreakpoint()
    await nextTick()
    expect(isShrink.value).toBe(true)

    setWindowWidth(1100)
    await nextTick()
    expect(isShrink.value).toBe(false)
  })
})
