import { nextTick, type Ref } from 'vue'
import { isMac } from '@/utils/PlatformConstants'
import { drawRectangle } from '../canvasUtils'
import type { ScreenConfig } from '../types'

interface MaskSelectionOptions {
  screenConfig: Ref<ScreenConfig>
  maskCanvas: Ref<HTMLCanvasElement | null>
  maskCtx: Ref<CanvasRenderingContext2D | null>
  borderRadius: Ref<number>
  selectionBorderColor: string
  overlayMaskColor: string
  showButtonGroup: Ref<boolean>
  /** 放大镜跟随鼠标移动 */
  onMagnifierMouseMove: (event: MouseEvent) => void
  /** 隐藏放大镜 */
  hideMagnifier: () => void
  /** 选区完成（显示按钮组并更新其位置） */
  onSelectionComplete: () => void
}

/**
 * 蒙版框选：mousedown/mousemove/mouseup 拖出截图选区。
 * 负责蒙版填充、选区镂空、圆角描边与 macOS 菜单栏区域的节流补偿。
 */
export const useMaskSelection = (options: MaskSelectionOptions) => {
  const {
    screenConfig,
    maskCanvas,
    maskCtx,
    borderRadius,
    selectionBorderColor,
    overlayMaskColor,
    showButtonGroup,
    onMagnifierMouseMove,
    hideMagnifier,
    onSelectionComplete
  } = options

  let mouseMoveThrottleId: number | null = null
  const mouseMoveThrottleDelay = 16

  const drawMask = () => {
    if (maskCtx.value && maskCanvas.value) {
      maskCtx.value.fillStyle = overlayMaskColor || 'black'
      maskCtx.value.fillRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
    }
  }

  /** 重绘蒙版 + 当前选区镂空（拖拽/缩放选区时调用） */
  const redrawSelection = () => {
    if (!maskCtx.value || !maskCanvas.value) return

    const { startX, startY, endX, endY } = screenConfig.value
    const x = Math.min(startX, endX)
    const y = Math.min(startY, endY)
    const width = Math.abs(endX - startX)
    const height = Math.abs(endY - startY)

    maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
    drawMask()
    maskCtx.value.clearRect(x, y, width, height)
  }

  /** 框选进行中的实时绘制（蒙版 + 镂空 + 圆角描边） */
  const drawActiveSelection = (event: MouseEvent) => {
    if (!screenConfig.value.isDrawing || !maskCtx.value || !maskCanvas.value) return

    const offsetEvent = event as MouseEvent & { offsetX: number; offsetY: number }
    const mouseX = offsetEvent.offsetX * screenConfig.value.scaleX
    const mouseY = offsetEvent.offsetY * screenConfig.value.scaleY
    const width = mouseX - screenConfig.value.startX
    const height = mouseY - screenConfig.value.startY

    maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
    drawMask()
    maskCtx.value.clearRect(screenConfig.value.startX, screenConfig.value.startY, width, height)
    drawRectangle(maskCtx.value, screenConfig.value.startX, screenConfig.value.startY, width, height, {
      borderColor: selectionBorderColor,
      borderRadius: borderRadius.value,
      scaleX: screenConfig.value.scaleX
    })
  }

  const handleMaskMouseDown = (event: MouseEvent) => {
    if (showButtonGroup.value) return

    const offsetEvent = event as MouseEvent & { offsetX: number; offsetY: number }
    screenConfig.value.startX = offsetEvent.offsetX * screenConfig.value.scaleX
    screenConfig.value.startY = offsetEvent.offsetY * screenConfig.value.scaleY
    screenConfig.value.isDrawing = true
  }

  const handleMaskMouseMove = (event: MouseEvent) => {
    onMagnifierMouseMove(event)

    if (!screenConfig.value.isDrawing || !maskCtx.value || !maskCanvas.value) return

    if (isMac()) {
      const offsetEvent = event as MouseEvent & { offsetX: number; offsetY: number }
      const currentY = offsetEvent.offsetY * screenConfig.value.scaleY
      const isInMenuBar = currentY < 30
      const throttleDelay = isInMenuBar ? 32 : mouseMoveThrottleDelay

      if (mouseMoveThrottleId) return

      mouseMoveThrottleId = window.setTimeout(() => {
        mouseMoveThrottleId = null
        drawActiveSelection(event)
      }, throttleDelay)
    } else {
      drawActiveSelection(event)
    }
  }

  const handleMaskMouseUp = (event: MouseEvent) => {
    if (!screenConfig.value.isDrawing) return

    screenConfig.value.isDrawing = false

    const offsetEvent = event as MouseEvent & { offsetX: number; offsetY: number }
    screenConfig.value.endX = offsetEvent.offsetX * screenConfig.value.scaleX
    screenConfig.value.endY = offsetEvent.offsetY * screenConfig.value.scaleY

    screenConfig.value.width = Math.abs(screenConfig.value.endX - screenConfig.value.startX)
    screenConfig.value.height = Math.abs(screenConfig.value.endY - screenConfig.value.startY)

    if (screenConfig.value.width > 5 && screenConfig.value.height > 5) {
      hideMagnifier()
      redrawSelection()
      showButtonGroup.value = true
      nextTick(onSelectionComplete)
    }
  }

  /** 清理 macOS 节流的 pending timeout（reset/卸载时调用） */
  const clearMouseMoveThrottle = () => {
    if (isMac() && mouseMoveThrottleId) {
      clearTimeout(mouseMoveThrottleId)
      mouseMoveThrottleId = null
    }
  }

  return {
    drawMask,
    redrawSelection,
    handleMaskMouseDown,
    handleMaskMouseMove,
    handleMaskMouseUp,
    clearMouseMoveThrottle
  }
}
