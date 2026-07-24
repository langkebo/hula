import { onMounted, onUnmounted, ref } from 'vue'

/**
 * 判断给定宽高是否为横屏 orientation（宽度 >= 768 且宽 > 高）。
 */
export function isLandscapeOrientation(width: number, height: number): boolean {
  return width >= 768 && width > height
}

/**
 * 响应式横屏检测 composable。
 * 基于 matchMedia('(orientation: landscape)') + resize 事件，
 * 结合宽度阈值 768px 判断是否应切换为双栏布局。
 */
export function useLandscape() {
  const isLandscape = ref(false)
  let mediaQuery: MediaQueryList | null = null

  const update = () => {
    if (typeof window === 'undefined') return
    isLandscape.value = isLandscapeOrientation(window.innerWidth, window.innerHeight)
  }

  onMounted(() => {
    if (typeof window === 'undefined') return
    update()
    mediaQuery = window.matchMedia('(orientation: landscape)')
    mediaQuery.addEventListener('change', update)
    window.addEventListener('resize', update)
  })

  onUnmounted(() => {
    mediaQuery?.removeEventListener('change', update)
    window.removeEventListener('resize', update)
  })

  return { isLandscape }
}
