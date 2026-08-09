import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { createLogger } from '@/utils/Logger'
import { ErrorType, invokeWithErrorHandler } from '@/utils/TauriInvokeHandler.ts'
import { drawRectangle } from '../canvasUtils'
import type { ScreenConfig } from '../types'

const logger = createLogger('Screenshot')

interface ScreenshotCanvasOptions {
  imgCanvas: Ref<HTMLCanvasElement | null>
  maskCanvas: Ref<HTMLCanvasElement | null>
  drawCanvas: Ref<HTMLCanvasElement | null>
  imgCtx: Ref<CanvasRenderingContext2D | null>
  maskCtx: Ref<CanvasRenderingContext2D | null>
  drawCtx: Ref<CanvasRenderingContext2D | null>
  screenConfig: Ref<ScreenConfig>
  isImageLoaded: Ref<boolean>
  selectionBorderColor: string
  /** 每次截图前的瞬态重置（绘制工具/拖拽状态/放大镜等） */
  prepareCapture: () => void
  /** 画布 ctx 就绪后创建绘制工具实例 */
  initDrawTools: () => void
  /** 蒙版框选事件（来自 useMaskSelection） */
  maskHandlers: {
    mousedown: (event: MouseEvent) => void
    mousemove: (event: MouseEvent) => void
    mouseup: (event: MouseEvent) => void
  }
  onContextMenu: (event: MouseEvent) => void
  onKeyDown: (event: KeyboardEvent) => void
}

/**
 * 截图画布初始化：调用 Rust 截图命令、解码像素、铺设三层画布
 * （图像层/蒙版层/绘制层）并注册框选事件监听。
 */
export const useScreenshotCanvas = (options: ScreenshotCanvasOptions) => {
  const {
    imgCanvas,
    maskCanvas,
    drawCanvas,
    imgCtx,
    maskCtx,
    drawCtx,
    screenConfig,
    isImageLoaded,
    selectionBorderColor,
    prepareCapture,
    initDrawTools,
    maskHandlers,
    onContextMenu,
    onKeyDown
  } = options

  const { t } = useI18n()

  let screenshotImage: HTMLImageElement

  /** 图像就位后的公共收尾：全屏描边 + 创建绘制工具 + 标记加载完成 */
  const finishImageLoad = (canvasWidth: number, canvasHeight: number) => {
    if (maskCtx.value) {
      drawRectangle(
        maskCtx.value,
        screenConfig.value.startX,
        screenConfig.value.startY,
        canvasWidth,
        canvasHeight,
        {
          borderColor: selectionBorderColor,
          borderRadius: 0,
          scaleX: screenConfig.value.scaleX
        },
        4
      )
    }
    initDrawTools()
    isImageLoaded.value = true
  }

  const initCanvas = async () => {
    prepareCapture()

    const canvasWidth = screen.width * window.devicePixelRatio
    const canvasHeight = screen.height * window.devicePixelRatio

    const config = {
      x: '0',
      y: '0',
      width: `${canvasWidth}`,
      height: `${canvasHeight}`
    }

    const screenshotData = await invokeWithErrorHandler<string>('screenshot', config, {
      customErrorMessage: t('message.screenshot.save_failed'),
      errorType: ErrorType.Client
    })

    if (imgCanvas.value && maskCanvas.value) {
      imgCanvas.value.width = canvasWidth
      imgCanvas.value.height = canvasHeight
      maskCanvas.value.width = canvasWidth
      maskCanvas.value.height = canvasHeight
      drawCanvas.value!.width = canvasWidth
      drawCanvas.value!.height = canvasHeight

      imgCtx.value = imgCanvas.value.getContext('2d')
      maskCtx.value = maskCanvas.value.getContext('2d')
      drawCtx.value = drawCanvas.value!.getContext('2d', { willReadFrequently: true })

      if (drawCtx.value) {
        drawCtx.value.clearRect(0, 0, canvasWidth, canvasHeight)
      }

      const { clientWidth: containerWidth, clientHeight: containerHeight } = imgCanvas.value!
      screenConfig.value.scaleX = canvasWidth / containerWidth
      screenConfig.value.scaleY = canvasHeight / containerHeight

      screenshotImage = new Image()

      screenshotImage.onload = () => {
        if (imgCtx.value) {
          try {
            imgCtx.value.drawImage(screenshotImage, 0, 0, canvasWidth, canvasHeight)
            finishImageLoad(canvasWidth, canvasHeight)
          } catch (error) {
            logger.error('Failed to draw image to canvas:', error)
          }
        }
      }

      if (screenshotData && imgCtx.value) {
        try {
          const binaryString = atob(screenshotData)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }

          const imageData = new ImageData(new Uint8ClampedArray(bytes), canvasWidth, canvasHeight)
          imgCtx.value.putImageData(imageData, 0, 0)
          finishImageLoad(canvasWidth, canvasHeight)
        } catch {
          screenshotImage.src = `data:image/png;base64,${screenshotData}`
        }
      } else {
        screenshotImage.src = `data:image/png;base64,${screenshotData}`
      }
    }

    maskCanvas.value?.addEventListener('mousedown', maskHandlers.mousedown)
    maskCanvas.value?.addEventListener('mousemove', maskHandlers.mousemove)
    maskCanvas.value?.addEventListener('mouseup', maskHandlers.mouseup)
    maskCanvas.value?.addEventListener('contextmenu', onContextMenu)

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('contextmenu', onContextMenu)
  }

  return {
    initCanvas
  }
}
