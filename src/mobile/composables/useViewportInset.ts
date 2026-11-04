import { onMounted, onUnmounted, type Ref, ref } from 'vue'

export function computeKeyboardInset(layoutHeight: number, viewportHeight: number, offsetTop: number): number {
  return Math.max(0, Math.round(layoutHeight - viewportHeight - offsetTop))
}

/**
 * 键盘遮挡高度。Android 在 enableEdgeToEdge 下窗口不随 IME 缩放，
 * iOS 由原生 set_keyboard_adjustment 缩放 WebView，此时 inset 自然为 0。
 */
export function useViewportInset(): { keyboardInset: Ref<number> } {
  const keyboardInset = ref(0)

  const update = () => {
    const viewport = window.visualViewport
    if (!viewport) {
      keyboardInset.value = 0
      return
    }
    keyboardInset.value = computeKeyboardInset(window.innerHeight, viewport.height, viewport.offsetTop)
  }

  onMounted(() => {
    update()
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    window.addEventListener('orientationchange', update)
  })

  onUnmounted(() => {
    window.visualViewport?.removeEventListener('resize', update)
    window.visualViewport?.removeEventListener('scroll', update)
    window.removeEventListener('orientationchange', update)
  })

  return { keyboardInset }
}
