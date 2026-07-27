import { useWindowSize } from '@vueuse/core'
import { type ComputedRef, computed } from 'vue'

/**
 * 响应式断点模式
 * - wide: 窗口 ≥ 1440px，中间栏 280px
 * - normal: 窗口 1024-1439px，中间栏 240px
 * - shrink: 窗口 < 1024px，中间栏 64px 仅图标，右侧栏全屏
 */
export type BreakpointMode = 'wide' | 'normal' | 'shrink'

export interface BreakpointConfig {
  /** wide 模式最小宽度（含），默认 1440 */
  wide: number
  /** normal 模式最小宽度（含），默认 1024 */
  normal: number
}

export interface UseResponsiveBreakpointOptions {
  /** 断点配置，默认 { wide: 1440, normal: 1024 } */
  breakpoints?: Partial<BreakpointConfig>
}

export interface UseResponsiveBreakpointReturn {
  /** 当前断点模式 */
  mode: ComputedRef<BreakpointMode>
  /** 中间栏宽度（wide=280, normal=240, shrink=64） */
  centerWidth: ComputedRef<number>
  /** 右侧栏是否全屏（shrink 模式） */
  isRightPaneFullscreen: ComputedRef<boolean>
  /** 是否为 shrink 模式（便于旧代码兼容） */
  isShrink: ComputedRef<boolean>
}

const DEFAULT_BREAKPOINTS: BreakpointConfig = {
  wide: 1440,
  normal: 1024
}

/** 各模式对应的中间栏宽度 */
const CENTER_WIDTH_MAP: Record<BreakpointMode, number> = {
  wide: 280,
  normal: 240,
  shrink: 64
}

/**
 * 响应式断点 composable
 *
 * 监听窗口宽度，派生断点模式与中间栏宽度。
 * 需求文档 §3.3.4：三档响应式断点。
 */
export function useResponsiveBreakpoint(options: UseResponsiveBreakpointOptions = {}): UseResponsiveBreakpointReturn {
  const breakpoints = { ...DEFAULT_BREAKPOINTS, ...options.breakpoints }
  const { width } = useWindowSize()

  const mode = computed<BreakpointMode>(() => {
    const w = width.value
    if (w >= breakpoints.wide) return 'wide'
    if (w >= breakpoints.normal) return 'normal'
    return 'shrink'
  })

  const centerWidth = computed(() => CENTER_WIDTH_MAP[mode.value])
  const isRightPaneFullscreen = computed(() => mode.value === 'shrink')
  const isShrink = computed(() => mode.value === 'shrink')

  return {
    mode,
    centerWidth,
    isRightPaneFullscreen,
    isShrink
  }
}
