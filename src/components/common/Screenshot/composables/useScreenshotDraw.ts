import { ref, watch, type Ref } from 'vue'
import { useCanvasTool } from '@/hooks/useCanvasTool'
import { createLogger } from '@/utils/Logger'
import type { ScreenConfig, DrawToolType } from '../types'

const logger = createLogger('ScreenshotDraw')

export function useScreenshotDraw(
  drawCanvas: Ref<HTMLCanvasElement | null>,
  drawCtx: Ref<CanvasRenderingContext2D | null>,
  imgCtx: Ref<CanvasRenderingContext2D | null>,
  screenConfig: Ref<ScreenConfig>
) {
  const currentDrawTool = ref<DrawToolType>(null)
  const canUndo = ref(false)
  let drawTools: ReturnType<typeof useCanvasTool> | null = null

  const initDrawTools = () => {
    if (drawCanvas.value && drawCtx.value && imgCtx.value) {
      drawTools = useCanvasTool(drawCanvas, drawCtx, imgCtx, screenConfig)
      drawCanvas.value.style.pointerEvents = 'none'
      drawCanvas.value.style.zIndex = '5'

      if (drawTools?.canUndo) {
        watch(drawTools.canUndo, (val: boolean) => (canUndo.value = val), { immediate: true })
      }
      return true
    }
    return false
  }

  const drawImgCanvas = (type: string) => {
    if (!drawTools) {
      logger.warn('绘图工具未初始化')
      return false
    }

    const drawableTypes = ['rect', 'circle', 'arrow', 'mosaic']

    if (drawableTypes.includes(type)) {
      if (currentDrawTool.value === type) {
        return true
      }

      if (currentDrawTool.value) {
        drawTools.stopDrawing && drawTools.stopDrawing()
      }

      currentDrawTool.value = type as DrawToolType

      if (drawCanvas.value) {
        drawCanvas.value.style.pointerEvents = 'auto'
      }

      if (type === 'mosaic') {
        drawTools.drawMosaicBrushSize && drawTools.drawMosaicBrushSize(20)
      }

      try {
        drawTools.draw(type as DrawToolType)
        return true
      } catch (error) {
        logger.error(`绘图工具激活失败: ${type}`, error)
        currentDrawTool.value = null
        if (drawCanvas.value) {
          drawCanvas.value.style.pointerEvents = 'none'
        }
        return false
      }
    } else if (type === 'redo') {
      if (drawTools.clearAll) {
        drawTools.clearAll()
      }
      currentDrawTool.value = null
      drawTools.resetState && drawTools.resetState()
      drawTools.clearEvents && drawTools.clearEvents()
      if (drawCanvas.value) {
        drawCanvas.value.style.pointerEvents = 'none'
        drawCanvas.value.style.zIndex = '5'
      }
      return true
    } else if (type === 'undo') {
      if (!canUndo.value) return false
      drawTools.stopDrawing && drawTools.stopDrawing()
      drawTools.undo && drawTools.undo()
      return true
    }

    return false
  }

  const resetDrawTools = () => {
    currentDrawTool.value = null
    if (drawTools) {
      drawTools.stopDrawing && drawTools.stopDrawing()
      drawTools.resetState && drawTools.resetState()
      drawTools.clearEvents && drawTools.clearEvents()
    }

    if (drawCtx.value && drawCanvas.value) {
      drawCtx.value.clearRect(0, 0, drawCanvas.value.width, drawCanvas.value.height)
    }

    if (drawCanvas.value) {
      drawCanvas.value.style.pointerEvents = 'none'
      drawCanvas.value.style.zIndex = '5'
    }
  }

  const clearDrawCanvas = () => {
    if (drawCtx.value && drawCanvas.value) {
      drawCtx.value.clearRect(0, 0, drawCanvas.value.width, drawCanvas.value.height)
    }
  }

  return {
    currentDrawTool,
    canUndo,
    drawTools,
    initDrawTools,
    drawImgCanvas,
    resetDrawTools,
    clearDrawCanvas
  }
}
