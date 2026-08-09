import { type Ref, ref, watch } from 'vue'
import { useCanvasTool } from '@/composables/common/useCanvasTool'
import { createLogger } from '@/utils/Logger'
import type { DrawToolType, ScreenConfig } from '../types'

const logger = createLogger('Screenshot')

interface DrawToolsOptions {
  drawCanvas: Ref<HTMLCanvasElement | null>
  drawCtx: Ref<CanvasRenderingContext2D | null>
  imgCtx: Ref<CanvasRenderingContext2D | null>
  screenConfig: Ref<ScreenConfig>
}

/**
 * 绘制工具接线：useCanvasTool 实例的创建、工具切换、撤销/重做与状态重置。
 * 画布初始化完成后由 useScreenshotCanvas 调 initDrawTools 创建实例。
 */
export const useDrawTools = (options: DrawToolsOptions) => {
  const { drawCanvas, drawCtx, imgCtx, screenConfig } = options

  let drawTools: ReturnType<typeof useCanvasTool> | null = null
  const canUndo = ref(false)
  const currentDrawTool = ref<DrawToolType>(null)

  /** 画布就绪后创建绘制工具实例，并同步 canUndo 状态 */
  const initDrawTools = () => {
    if (!drawCanvas.value || !drawCtx.value || !imgCtx.value) return

    drawTools = useCanvasTool(drawCanvas, drawCtx, imgCtx, screenConfig)
    drawCanvas.value.style.pointerEvents = 'none'
    drawCanvas.value.style.zIndex = '5'

    if (drawTools.canUndo) {
      watch(drawTools.canUndo, (val: boolean) => (canUndo.value = val), { immediate: true })
    }
  }

  const drawImgCanvas = (type: DrawToolType) => {
    if (!drawTools) return

    const drawableTypes: DrawToolType[] = ['rect', 'circle', 'arrow', 'mosaic']

    if (drawableTypes.includes(type)) {
      if (currentDrawTool.value === type) return

      if (currentDrawTool.value) {
        drawTools.stopDrawing?.()
      }

      currentDrawTool.value = type

      if (drawCanvas.value) {
        drawCanvas.value.style.pointerEvents = 'auto'
      }

      if (type === 'mosaic') {
        drawTools.drawMosaicBrushSize?.(20)
      }

      try {
        if (type) drawTools.draw(type)
      } catch (error) {
        logger.error(`Failed to activate drawing tool: ${type}`, error)
        currentDrawTool.value = null
        if (drawCanvas.value) {
          drawCanvas.value.style.pointerEvents = 'none'
        }
      }
    }
  }

  const handleRedo = () => {
    if (drawTools?.clearAll) {
      drawTools.clearAll()
    }
    currentDrawTool.value = null
    drawTools?.resetState?.()
    drawTools?.clearEvents?.()
    if (drawCanvas.value) {
      drawCanvas.value.style.pointerEvents = 'none'
      drawCanvas.value.style.zIndex = '5'
    }
  }

  const handleUndo = () => {
    if (!canUndo.value) return
    drawTools?.stopDrawing?.()
    drawTools?.undo?.()
  }

  const resetDrawTools = () => {
    currentDrawTool.value = null
    if (drawTools) {
      drawTools.stopDrawing?.()
      drawTools.resetState?.()
      drawTools.clearEvents?.()
    }

    if (drawCtx.value && drawCanvas.value) {
      drawCtx.value.clearRect(0, 0, drawCanvas.value.width, drawCanvas.value.height)
    }

    if (drawCanvas.value) {
      drawCanvas.value.style.pointerEvents = 'none'
      drawCanvas.value.style.zIndex = '5'
    }
  }

  return {
    canUndo,
    currentDrawTool,
    initDrawTools,
    drawImgCanvas,
    handleRedo,
    handleUndo,
    resetDrawTools
  }
}
