import { computed, type Ref, ref } from 'vue'

type GestureMode = 'none' | 'pinch' | 'pan' | 'swipe'

interface ViewportSize {
  width: number
  height: number
}

interface GestureState {
  mode: GestureMode
  startDistance: number
  startScale: number
  startClientX: number
  startClientY: number
  lastClientX: number
  lastClientY: number
  startTranslateX: number
  startTranslateY: number
  /** -1 表示该手势不再参与轻触判定（例如双指抬指后重建的 pan） */
  startedAt: number
}

export interface UsePreviewGesturesOptions {
  /** 预览容器的可用视口尺寸（用于计算放大后的平移边界） */
  viewportSize: Ref<ViewportSize>
  /** 请求关闭预览；幂等由调用方保证 */
  close: () => void
  /** 判定「已放大」的缩放阈值 */
  zoomEpsilon?: number
  /** 双击放大倍数 */
  doubleTapScale?: number
  /** 下滑关闭阈值（px） */
  closeDragPx?: number
}

const MIN_SCALE = 0.1
const MAX_SCALE = 3
const DOUBLE_TAP_MS = 300
const TAP_MOVE_PX = 10
const TAP_MAX_MS = 250

/**
 * 移动端图片预览手势状态机：双指缩放、单指平移、双击切换、下滑关闭与轻触关闭。
 * 只维护手势相关状态，业务动作（下载/转发/关闭事件派发）由调用方通过 close 回调完成。
 */
export const usePreviewGestures = ({
  viewportSize,
  close,
  zoomEpsilon = 1.01,
  doubleTapScale = 2.5,
  closeDragPx = 80
}: UsePreviewGesturesOptions) => {
  const scale = ref(1)
  const translate = ref({ x: 0, y: 0 })
  const dragOffsetY = ref(0)
  const lastTapAt = ref<number | null>(null)
  const suppressClickUntil = ref(0)
  let closeTimer: ReturnType<typeof setTimeout> | null = null
  const gesture = ref<GestureState>({
    mode: 'none',
    startDistance: 0,
    startScale: 1,
    startClientX: 0,
    startClientY: 0,
    lastClientX: 0,
    lastClientY: 0,
    startTranslateX: 0,
    startTranslateY: 0,
    startedAt: -1
  })

  const isZoomed = () => scale.value > zoomEpsilon

  const clearCloseTimer = () => {
    if (closeTimer === null) return
    clearTimeout(closeTimer)
    closeTimer = null
  }

  /** 放大后的平移边界：以视口长边的一半作为可移动半径上限 */
  const clampOffset = (value: number, currentScale: number) => {
    const limit = (Math.max(currentScale, 1) - 1) * 0.5 * Math.max(viewportSize.value.width, viewportSize.value.height)
    return Math.min(Math.max(value, -limit), limit)
  }

  const resetTransform = () => {
    clearCloseTimer()
    scale.value = 1
    translate.value = { x: 0, y: 0 }
    dragOffsetY.value = 0
    gesture.value.mode = 'none'
  }

  /** 重置缩放/平移并清空双击序列 */
  const resetGesture = () => {
    resetTransform()
    lastTapAt.value = null
  }

  const clampScale = (value: number) => Math.min(Math.max(value, MIN_SCALE), MAX_SCALE)

  const getTouchesDistance = (event: TouchEvent) => {
    if (event.touches.length < 2) return 0
    const [touch1, touch2] = [event.touches[0], event.touches[1]]
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.hypot(dx, dy)
  }

  const handleBackdropClick = () => {
    // 轻触后浏览器补发的合成 click 交给轻触逻辑处理，避免第一下就关闭
    if (Date.now() < suppressClickUntil.value) return
    // 放大状态下轻触不关闭，避免看细节时误退
    if (isZoomed()) return
    clearCloseTimer()
    close()
  }

  const scheduleClose = () => {
    clearCloseTimer()
    closeTimer = setTimeout(() => {
      closeTimer = null
      if (gesture.value.mode !== 'none' || isZoomed()) return
      close()
    }, DOUBLE_TAP_MS)
  }

  const handleTap = () => {
    const now = Date.now()
    suppressClickUntil.value = now + DOUBLE_TAP_MS
    dragOffsetY.value = 0
    gesture.value.mode = 'none'

    // 双击命中：取消单击的延迟关闭，并在放大与还原之间切换
    if (lastTapAt.value !== null && now - lastTapAt.value < DOUBLE_TAP_MS) {
      lastTapAt.value = null
      clearCloseTimer()
      scale.value = isZoomed() ? 1 : doubleTapScale
      translate.value = { x: 0, y: 0 }
      return
    }

    lastTapAt.value = now
    // 单击时清除拖动残留偏移（gesture.mode 已复位，过渡生效）
    translate.value = { x: 0, y: 0 }
    // 放大态单击只作为双击序列的第一下，不关闭；未放大态延迟关闭给第二下留窗口
    if (!isZoomed()) scheduleClose()
  }

  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length >= 2) {
      clearCloseTimer()
      dragOffsetY.value = 0
      // 双指接管前清掉单指拖动残留，避免缩放时画面偏移
      if (!isZoomed()) translate.value = { x: 0, y: 0 }
      gesture.value = {
        mode: 'pinch',
        startDistance: getTouchesDistance(event),
        startScale: scale.value,
        startClientX: 0,
        startClientY: 0,
        lastClientX: 0,
        lastClientY: 0,
        startTranslateX: translate.value.x,
        startTranslateY: translate.value.y,
        startedAt: -1
      }
      return
    }

    const touch = event.touches[0]
    if (!touch) return
    gesture.value = {
      mode: isZoomed() ? 'pan' : 'swipe',
      startDistance: 0,
      startScale: scale.value,
      startClientX: touch.clientX,
      startClientY: touch.clientY,
      lastClientX: touch.clientX,
      lastClientY: touch.clientY,
      startTranslateX: translate.value.x,
      startTranslateY: translate.value.y,
      startedAt: Date.now()
    }
  }

  const handleTouchMove = (event: TouchEvent) => {
    if (gesture.value.mode === 'pinch') {
      if (event.touches.length < 2 || gesture.value.startDistance <= 0) return
      const distance = getTouchesDistance(event)
      if (distance <= 0) return
      scale.value = clampScale((distance / gesture.value.startDistance) * gesture.value.startScale)
      translate.value = {
        x: clampOffset(translate.value.x, scale.value),
        y: clampOffset(translate.value.y, scale.value)
      }
      return
    }

    const touch = event.touches[0]
    if (!touch) return
    gesture.value.lastClientX = touch.clientX
    gesture.value.lastClientY = touch.clientY

    const dx = touch.clientX - gesture.value.startClientX
    const dy = touch.clientY - gesture.value.startClientY

    if (gesture.value.mode === 'pan') {
      translate.value = {
        x: clampOffset(gesture.value.startTranslateX + dx, scale.value),
        y: clampOffset(gesture.value.startTranslateY + dy, scale.value)
      }
      return
    }

    // 未放大时仅响应纵向拖动作为关闭手势；mode 非 swipe 时（如工具栏触摸）不移动画面
    if (gesture.value.mode !== 'swipe') return
    if (Math.abs(dy) > Math.abs(dx)) {
      dragOffsetY.value = dy
      translate.value = { x: 0, y: dy }
    }
  }

  const handleTouchEnd = (event: TouchEvent) => {
    const mode = gesture.value.mode

    if (mode === 'pinch') {
      const touch = event.touches[0]
      dragOffsetY.value = 0
      // 双指变单指：以剩余触点重建 pan 起点，避免落回 swipe 造成跳变
      if (touch) {
        gesture.value = {
          ...gesture.value,
          mode: 'pan',
          startClientX: touch.clientX,
          startClientY: touch.clientY,
          lastClientX: touch.clientX,
          lastClientY: touch.clientY,
          startTranslateX: translate.value.x,
          startTranslateY: translate.value.y,
          startedAt: -1
        }
        return
      }
      if (!isZoomed()) translate.value = { x: 0, y: 0 }
      gesture.value.mode = 'none'
      return
    }

    if (event.touches.length >= 1) return

    const duration = Date.now() - gesture.value.startedAt
    const moved = Math.hypot(
      gesture.value.lastClientX - gesture.value.startClientX,
      gesture.value.lastClientY - gesture.value.startClientY
    )
    const dy = dragOffsetY.value

    if (mode === 'swipe' && dy > closeDragPx) {
      resetTransform()
      close()
      return
    }

    // 短按且几乎无位移视为轻触；放大态（pan）同样参与双击判定
    const isTap =
      gesture.value.startedAt >= 0 && duration < TAP_MAX_MS && moved < TAP_MOVE_PX && Math.abs(dy) < TAP_MOVE_PX
    if ((mode === 'swipe' || mode === 'pan') && isTap) {
      handleTap()
      return
    }

    dragOffsetY.value = 0
    if (!isZoomed()) translate.value = { x: 0, y: 0 }
    gesture.value.mode = 'none'
  }

  const handleTouchCancel = () => {
    dragOffsetY.value = 0
    if (!isZoomed()) translate.value = { x: 0, y: 0 }
    gesture.value.mode = 'none'
  }

  const gestureMode = computed(() => gesture.value.mode)

  return {
    scale,
    translate,
    gestureMode,
    handleBackdropClick,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    resetGesture,
    clearCloseTimer
  }
}
