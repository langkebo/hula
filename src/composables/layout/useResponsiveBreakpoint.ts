import { useWindowSize } from '@vueuse/core'
import { type ComputedRef, computed } from 'vue'

/**
 * 响应式断点模式
 * - wide: 窗口 ≥ 1200px，四栏，中间栏 280px
 * - normal: 窗口 992-1199px，轻四栏，中间栏 240px
 * - shrink: 窗口 768-991px，双栏 + 抽屉，中间栏 64px 仅图标
 * - single: 窗口 < 768px，单栏，中间栏 64px 仅图标
 */
export type BreakpointMode = 'wide' | 'normal' | 'shrink' | 'single'

export interface BreakpointConfig {
  /** wide 模式最小宽度（含） */
  wide: number
  /** normal 模式最小宽度（含） */
  normal: number
  /** shrink 模式最小宽度（含）；低于该值进入 single 单栏 */
  shrink: number
}

export interface UseResponsiveBreakpointOptions {
  /** 断点配置，默认 { wide: 1200, normal: 992, shrink: 768 } */
  breakpoints?: Partial<BreakpointConfig>
}

export interface UseResponsiveBreakpointReturn {
  /** 当前断点模式 */
  mode: ComputedRef<BreakpointMode>
  /** 中间栏宽度（wide=280, normal=240, shrink/single=64） */
  centerWidth: ComputedRef<number>
  /** 右侧栏是否全屏（shrink / single 窄屏模式） */
  isRightPaneFullscreen: ComputedRef<boolean>
  /** 是否为窄屏模式（便于旧代码兼容） */
  isShrink: ComputedRef<boolean>
}

/**
 * 唯一断点源：与需求 8.2 的 768 / 992 / 1200 对齐。
 * `responsive.scss` 的 `$breakpoints`（md / lg / xl）必须与这三个数值一致，
 * 由 `src/styles/__tests__/design-baseline.test.ts` 断言守护。
 */
export const DEFAULT_BREAKPOINTS: BreakpointConfig = {
  wide: 1200,
  normal: 992,
  shrink: 768
}

/** 各模式对应的中间栏宽度 */
const CENTER_WIDTH_MAP: Record<BreakpointMode, number> = {
  wide: 280,
  normal: 240,
  shrink: 64,
  single: 64
}

/**
 * 响应式断点 composable
 *
 * 监听窗口宽度，派生断点模式与中间栏宽度。
 */
export function useResponsiveBreakpoint(options: UseResponsiveBreakpointOptions = {}): UseResponsiveBreakpointReturn {
  const breakpoints = { ...DEFAULT_BREAKPOINTS, ...options.breakpoints }
  const { width } = useWindowSize()

  const mode = computed<BreakpointMode>(() => {
    const w = width.value
    if (w >= breakpoints.wide) return 'wide'
    if (w >= breakpoints.normal) return 'normal'
    if (w >= breakpoints.shrink) return 'shrink'
    return 'single'
  })

  const centerWidth = computed(() => CENTER_WIDTH_MAP[mode.value])
  const isNarrow = computed(() => mode.value === 'shrink' || mode.value === 'single')
  const isRightPaneFullscreen = isNarrow
  const isShrink = isNarrow

  return {
    mode,
    centerWidth,
    isRightPaneFullscreen,
    isShrink
  }
}
