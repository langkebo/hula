import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'

export type MobileBreakpoint = 'compact' | 'medium' | 'expanded'

export const MOBILE_BREAKPOINT_COMPACT_MAX = 600
export const MOBILE_BREAKPOINT_MEDIUM_MAX = 1024

export function resolveMobileBreakpoint(width: number): MobileBreakpoint {
  if (width < MOBILE_BREAKPOINT_COMPACT_MAX) return 'compact'
  if (width <= MOBILE_BREAKPOINT_MEDIUM_MAX) return 'medium'
  return 'expanded'
}

export function useMobileBreakpoint() {
  const { width } = useWindowSize()
  const breakpoint = computed(() => resolveMobileBreakpoint(width.value || 0))
  const isExpanded = computed(() => breakpoint.value === 'expanded')
  return { width, breakpoint, isExpanded }
}
