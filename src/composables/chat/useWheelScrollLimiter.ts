import { useEventListener } from '@vueuse/core'
import type { Ref, ShallowRef } from 'vue'

const MAX_WHEEL_DELTA = 130
const DOM_DELTA_LINE = 1
const DOM_DELTA_PAGE = 2

const clampWheelDelta = (delta: number): number => {
  if (Math.abs(delta) <= MAX_WHEEL_DELTA) {
    return delta
  }
  return Math.sign(delta) * MAX_WHEEL_DELTA
}

const normalizeWheelDelta = (event: WheelEvent, target: HTMLElement): number => {
  switch (event.deltaMode) {
    case DOM_DELTA_LINE:
      return event.deltaY * 16
    case DOM_DELTA_PAGE:
      return event.deltaY * target.clientHeight
    default:
      return event.deltaY
  }
}

/**
 * Limits wheel scroll speed on a container element.
 * Returns a cleanup function to remove the listener.
 */
export const useWheelScrollLimiter = (
  containerRef: Ref<HTMLElement | null> | ShallowRef<HTMLElement | null> | Readonly<ShallowRef<HTMLElement | null>>
) => {
  const handleWheel = (event: WheelEvent) => {
    const container = containerRef.value
    if (!container) return

    // Skip trackpad pinch-zoom or horizontal scroll
    if (event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
      return
    }

    const normalizedDelta = normalizeWheelDelta(event, container)
    if (Math.abs(normalizedDelta) < 0.5) {
      return
    }

    event.preventDefault()
    const limitedDelta = clampWheelDelta(normalizedDelta)
    if (Math.abs(limitedDelta) < 0.5) {
      return
    }
    container.scrollTop += limitedDelta
  }

  const stop = useEventListener(containerRef, 'wheel', handleWheel, { passive: false })

  return { stop }
}
