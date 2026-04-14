import { ref, onUnmounted } from 'vue'

export function useLongPress(callback: (event: TouchEvent) => void, delay = 500) {
  const timer = ref<number | null>(null)

  function onTouchStart(event: TouchEvent) {
    timer.value = window.setTimeout(() => {
      callback(event)
    }, delay)
  }

  function onTouchEnd() {
    if (timer.value !== null) {
      clearTimeout(timer.value)
      timer.value = null
    }
  }

  onUnmounted(() => {
    if (timer.value !== null) {
      clearTimeout(timer.value)
    }
  })

  return {
    onTouchStart,
    onTouchEnd
  }
}
