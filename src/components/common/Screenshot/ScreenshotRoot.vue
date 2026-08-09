<template>
  <div ref="canvasbox" class="canvasbox">
    <canvas ref="drawCanvas" class="draw-canvas"></canvas>
    <canvas ref="maskCanvas" class="mask-canvas"></canvas>
    <canvas ref="imgCanvas" class="img-canvas"></canvas>

    <ScreenshotMagnifier
      ref="magnifierRef"
      :img-canvas="imgCanvas"
      :screen-config="screenConfig"
      :is-dragging="isDragging"
      :is-resizing="isResizing"
      :show-button-group="showButtonGroup"
      :is-image-loaded="isImageLoaded" />

    <ScreenshotSelection
      :visible="showButtonGroup"
      :selection-area-style="selectionAreaStyle"
      :current-draw-tool="currentDrawTool"
      :border-radius="borderRadius"
      :screen-config="screenConfig"
      @drag-start="handleSelectionDragStart"
      @confirm="confirmSelection"
      @resize-start="handleResizeStart"
      @border-radius-change="handleBorderRadiusChange" />

    <ScreenshotToolbar
      ref="toolbarRef"
      :visible="showButtonGroup"
      :is-dragging="isDragging"
      :is-resizing="isResizing"
      :current-draw-tool="currentDrawTool"
      :can-undo="canUndo"
      :screen-config="screenConfig"
      @tool-select="drawImgCanvas"
      @redo="handleRedo"
      @undo="handleUndo"
      @confirm="confirmSelection"
      @cancel="cancelSelection" />
  </div>
</template>

<script setup lang="ts">
import { emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { writeImage } from '@tauri-apps/plugin-clipboard-manager'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useCanvasTool } from '@/composables/common/useCanvasTool'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { isMac } from '@/utils/PlatformConstants'
import { ErrorType, invokeWithErrorHandler } from '@/utils/TauriInvokeHandler.ts'
import { useScreenshotExport } from './composables/useScreenshotExport'
import { useSelectionDragResize } from './composables/useSelectionDragResize'
import type ScreenshotMagnifier from './ScreenshotMagnifier.vue'
import type ScreenshotToolbar from './ScreenshotToolbar.vue'
import type { DrawToolType, ScreenConfig } from './types'

const logger = createLogger('Screenshot')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null

const imgCanvas = ref<HTMLCanvasElement | null>(null)
const imgCtx = ref<CanvasRenderingContext2D | null>(null)
const maskCanvas = ref<HTMLCanvasElement | null>(null)
const maskCtx = ref<CanvasRenderingContext2D | null>(null)
const drawCanvas = ref<HTMLCanvasElement | null>(null)
const drawCtx = ref<CanvasRenderingContext2D | null>(null)
const cssVars = getComputedStyle(document.documentElement)
const selectionBorderColor = cssVars.getPropertyValue('--tjg-color-primary-500').trim()
const overlayMaskColor =
  cssVars.getPropertyValue('--tjg-overlay-mask-default').trim() ||
  cssVars.getPropertyValue('--tjg-surface-overlay').trim()

const magnifierRef = ref<InstanceType<typeof ScreenshotMagnifier> | null>(null)
const toolbarRef = ref<InstanceType<typeof ScreenshotToolbar> | null>(null)

let drawTools: ReturnType<typeof useCanvasTool> | null = null
const canUndo = ref(false)
const currentDrawTool = ref<DrawToolType>(null)
const showButtonGroup = ref(false)
const isImageLoaded = ref(false)

const borderRadius = ref(0)

const screenConfig = ref<ScreenConfig>({
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
  scaleX: 0,
  scaleY: 0,
  isDrawing: false,
  width: 0,
  height: 0
})

const selectionAreaStyle = ref({
  left: '0px',
  top: '0px',
  width: '0px',
  height: '0px',
  borderRadius: '0px',
  border: `2px solid ${selectionBorderColor}`
})

let screenshotImage: HTMLImageElement
let mouseMoveThrottleId: number | null = null
const mouseMoveThrottleDelay = 16

const drawMask = () => {
  if (maskCtx.value && maskCanvas.value) {
    maskCtx.value.fillStyle = overlayMaskColor || 'black'
    maskCtx.value.fillRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
  }
}

const drawRectangle = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  lineWidth: number = 2
) => {
  context.strokeStyle = selectionBorderColor || 'black'
  context.lineWidth = lineWidth

  if (borderRadius.value > 0) {
    const radius = borderRadius.value * screenConfig.value.scaleX
    const adjustedRadius = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2)

    context.beginPath()

    const rectX = width >= 0 ? x : x + width
    const rectY = height >= 0 ? y : y + height
    const rectWidth = Math.abs(width)
    const rectHeight = Math.abs(height)

    context.moveTo(rectX + adjustedRadius, rectY)
    context.lineTo(rectX + rectWidth - adjustedRadius, rectY)
    context.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + adjustedRadius)
    context.lineTo(rectX + rectWidth, rectY + rectHeight - adjustedRadius)
    context.quadraticCurveTo(
      rectX + rectWidth,
      rectY + rectHeight,
      rectX + rectWidth - adjustedRadius,
      rectY + rectHeight
    )
    context.lineTo(rectX + adjustedRadius, rectY + rectHeight)
    context.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - adjustedRadius)
    context.lineTo(rectX, rectY + adjustedRadius)
    context.quadraticCurveTo(rectX, rectY, rectX + adjustedRadius, rectY)
    context.closePath()

    context.stroke()
  } else {
    context.strokeRect(x, y, width, height)
  }

  drawSizeText(context, x, y, width, height)
}

const drawSizeText = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => {
  const roundedWidth = Math.round(Math.abs(width))
  const roundedHeight = Math.round(Math.abs(height))
  const sizeText = `${roundedWidth} x ${roundedHeight}`

  const textX = width >= 0 ? x : x + width
  const textY = height >= 0 ? y : y + height

  context.font = '14px Arial'
  context.fillStyle = 'white'
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.fillText(sizeText, textX + 5, textY - 10)
}

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

const updateSelectionAreaPosition = () => {
  const { scaleX, scaleY, startX, startY, endX, endY } = screenConfig.value

  const minX = Math.min(startX, endX) / scaleX
  const minY = Math.min(startY, endY) / scaleY
  const maxX = Math.max(startX, endX) / scaleX
  const maxY = Math.max(startY, endY) / scaleY

  selectionAreaStyle.value = {
    left: `${minX}px`,
    top: `${minY}px`,
    width: `${maxX - minX}px`,
    height: `${maxY - minY}px`,
    borderRadius: `${borderRadius.value}px`,
    border: `2px solid ${selectionBorderColor}`
  }
}

const updateButtonGroupPosition = () => {
  toolbarRef.value?.updatePosition()
}

// Selection drag & 8-direction resize
const {
  isDragging,
  isResizing,
  handleSelectionDragStart,
  handleResizeStart,
  cleanup: cleanupDragResize
} = useSelectionDragResize({
  screenConfig,
  selectionAreaStyle,
  currentDrawTool,
  borderRadius,
  selectionBorderColor,
  showButtonGroup,
  redrawSelection,
  updateButtonGroupPosition,
  hideMagnifier: () => magnifierRef.value?.hideMagnifier(),
  onResizeMouseMove: (e) => magnifierRef.value?.handleMouseMove(e)
})

// Screenshot export pipeline (canvas merge + crop + rounded corners)
const { exportSelection } = useScreenshotExport({
  imgCanvas,
  drawCanvas,
  screenConfig,
  borderRadius,
  isImageLoaded,
  resetScreenshot: async () => {}
})

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

const handleBorderRadiusChange = (value: number) => {
  borderRadius.value = value
  updateSelectionAreaPosition()
}

const handleMaskMouseDown = (event: MouseEvent) => {
  if (showButtonGroup.value) return

  const offsetEvent = event as MouseEvent & { offsetX: number; offsetY: number }
  screenConfig.value.startX = offsetEvent.offsetX * screenConfig.value.scaleX
  screenConfig.value.startY = offsetEvent.offsetY * screenConfig.value.scaleY
  screenConfig.value.isDrawing = true
}

const handleMaskMouseMove = (event: MouseEvent) => {
  magnifierRef.value?.handleMouseMove(event)

  if (!screenConfig.value.isDrawing || !maskCtx.value || !maskCanvas.value) return

  const offsetEvent = event as MouseEvent & { offsetX: number; offsetY: number }

  if (isMac()) {
    const currentY = offsetEvent.offsetY * screenConfig.value.scaleY
    const isInMenuBar = currentY < 30
    const throttleDelay = isInMenuBar ? 32 : mouseMoveThrottleDelay

    if (mouseMoveThrottleId) return

    mouseMoveThrottleId = window.setTimeout(() => {
      mouseMoveThrottleId = null

      if (!screenConfig.value.isDrawing || !maskCtx.value || !maskCanvas.value) return

      const mouseX = offsetEvent.offsetX * screenConfig.value.scaleX
      const mouseY = offsetEvent.offsetY * screenConfig.value.scaleY
      const width = mouseX - screenConfig.value.startX
      const height = mouseY - screenConfig.value.startY

      maskCtx.value.save()
      maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
      drawMask()
      maskCtx.value.clearRect(screenConfig.value.startX, screenConfig.value.startY, width, height)
      drawRectangle(maskCtx.value, screenConfig.value.startX, screenConfig.value.startY, width, height)
      maskCtx.value.restore()
    }, throttleDelay)
  } else {
    const mouseX = offsetEvent.offsetX * screenConfig.value.scaleX
    const mouseY = offsetEvent.offsetY * screenConfig.value.scaleY
    const width = mouseX - screenConfig.value.startX
    const height = mouseY - screenConfig.value.startY

    maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
    drawMask()
    maskCtx.value.clearRect(screenConfig.value.startX, screenConfig.value.startY, width, height)
    drawRectangle(maskCtx.value, screenConfig.value.startX, screenConfig.value.startY, width, height)
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
    magnifierRef.value?.hideMagnifier()
    redrawSelection()
    showButtonGroup.value = true
    nextTick(updateButtonGroupPosition)
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    resetScreenshot()
  }
}

const handleRightClick = (event: MouseEvent) => {
  event.preventDefault()
  resetScreenshot()
}

const confirmSelection = async () => {
  magnifierRef.value?.hideMagnifier()

  if (!isImageLoaded.value) {
    await resetScreenshot()
    return
  }

  const { startX, startY, endX, endY } = screenConfig.value
  const width = Math.abs(endX - startX)
  const height = Math.abs(endY - startY)

  if (width < 1 || height < 1) {
    await resetScreenshot()
    return
  }

  const blob = await exportSelection()

  if (!blob) {
    showFeedback(t('message.screenshot.save_failed'), 'error')
    await resetScreenshot()
    return
  }

  try {
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    try {
      await emitTo('home', 'screenshot', {
        type: 'image',
        buffer: Array.from(buffer),
        mimeType: 'image/png'
      })
    } catch (e) {
      logger.warn('Failed to send screenshot to home window:', e)
    }

    try {
      await writeImage(buffer)
      showFeedback(t('message.screenshot.save_success'), 'success')
    } catch (clipboardError) {
      logger.error('Failed to copy screenshot to clipboard:', clipboardError)
      showFeedback(t('message.screenshot.save_failed'), 'error')
    }

    await resetScreenshot()
  } catch {
    showFeedback(t('message.screenshot.save_failed'), 'error')
    await resetScreenshot()
  }
}

const cancelSelection = () => {
  resetScreenshot()
}

const resetScreenshot = async () => {
  try {
    if (isMac() && mouseMoveThrottleId) {
      clearTimeout(mouseMoveThrottleId)
      mouseMoveThrottleId = null
    }

    resetDrawTools()

    showButtonGroup.value = false
    isImageLoaded.value = false
    borderRadius.value = 0
    isDragging.value = false
    isResizing.value = false

    screenConfig.value = {
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
      scaleX: 0,
      scaleY: 0,
      isDrawing: false,
      width: 0,
      height: 0
    }

    if (imgCtx.value && imgCanvas.value) {
      imgCtx.value.clearRect(0, 0, imgCanvas.value.width, imgCanvas.value.height)
    }
    if (maskCtx.value && maskCanvas.value) {
      maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
    }
    if (drawCtx.value && drawCanvas.value) {
      drawCtx.value.clearRect(0, 0, drawCanvas.value.width, drawCanvas.value.height)
      drawCanvas.value.style.pointerEvents = 'none'
    }

    magnifierRef.value?.hideMagnifier()

    await appWindow?.hide()
  } catch (error) {
    await appWindow?.hide()
  }
}

const initCanvas = async () => {
  magnifierRef.value?.hideMagnifier()
  resetDrawTools()
  isImageLoaded.value = false
  borderRadius.value = 0
  isDragging.value = false
  isResizing.value = false

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

          if (maskCtx.value) {
            drawRectangle(
              maskCtx.value,
              screenConfig.value.startX,
              screenConfig.value.startY,
              canvasWidth,
              canvasHeight,
              4
            )
          }

          if (drawCanvas.value && drawCtx.value && imgCtx.value) {
            drawTools = useCanvasTool(drawCanvas, drawCtx, imgCtx, screenConfig)
            drawCanvas.value.style.pointerEvents = 'none'
            drawCanvas.value.style.zIndex = '5'

            if (drawTools?.canUndo) {
              import('vue').then(({ watch }) => {
                watch(drawTools!.canUndo, (val: boolean) => (canUndo.value = val), { immediate: true })
              })
            }
          }
          isImageLoaded.value = true
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

        if (maskCtx.value) {
          drawRectangle(
            maskCtx.value,
            screenConfig.value.startX,
            screenConfig.value.startY,
            canvasWidth,
            canvasHeight,
            4
          )
        }

        if (drawCanvas.value && drawCtx.value && imgCtx.value) {
          drawTools = useCanvasTool(drawCanvas, drawCtx, imgCtx, screenConfig)
          drawCanvas.value.style.pointerEvents = 'none'
          drawCanvas.value.style.zIndex = '5'

          if (drawTools?.canUndo) {
            import('vue').then(({ watch }) => {
              watch(drawTools!.canUndo, (val: boolean) => (canUndo.value = val), { immediate: true })
            })
          }
        }
        isImageLoaded.value = true
      } catch (error) {
        screenshotImage.src = `data:image/png;base64,${screenshotData}`
      }
    } else {
      screenshotImage.src = `data:image/png;base64,${screenshotData}`
    }
  }

  maskCanvas.value?.addEventListener('mousedown', handleMaskMouseDown)
  maskCanvas.value?.addEventListener('mousemove', handleMaskMouseMove)
  maskCanvas.value?.addEventListener('mouseup', handleMaskMouseUp)
  maskCanvas.value?.addEventListener('contextmenu', handleRightClick)

  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('contextmenu', handleRightClick)
}

const handleScreenshot = () => {
  resetDrawTools()
  appWindow?.show()
  initCanvas()
  magnifierRef.value?.initMagnifier()
}

onMounted(async () => {
  appWindow?.listen('capture', () => {
    resetDrawTools()
    initCanvas()
    magnifierRef.value?.initMagnifier()
  })

  appWindow?.listen('capture-reset', () => {
    resetDrawTools()
    resetScreenshot()
  })

  window.addEventListener('trigger-screenshot', handleScreenshot)
})

onUnmounted(async () => {
  if (isMac() && mouseMoveThrottleId) {
    clearTimeout(mouseMoveThrottleId)
    mouseMoveThrottleId = null
  }

  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('contextmenu', handleRightClick)

  if (maskCanvas.value) {
    maskCanvas.value.removeEventListener('contextmenu', handleRightClick)
  }

  window.removeEventListener('trigger-screenshot', handleScreenshot)
})
</script>

<style scoped lang="scss">
.canvasbox {
  width: 100vw;
  height: 100vh;
  position: relative;
  background-color: transparent;
}

canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.img-canvas {
  z-index: 0;
}

.mask-canvas {
  z-index: 1;
}

.draw-canvas {
  z-index: 5;
  pointer-events: none;
}
</style>
