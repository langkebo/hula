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
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { useDrawTools } from './composables/useDrawTools'
import { useMaskSelection } from './composables/useMaskSelection'
import { useScreenshotCanvas } from './composables/useScreenshotCanvas'
import { useScreenshotExport } from './composables/useScreenshotExport'
import { useSelectionDragResize } from './composables/useSelectionDragResize'
import type ScreenshotMagnifier from './ScreenshotMagnifier.vue'
import type ScreenshotToolbar from './ScreenshotToolbar.vue'
import type { ScreenConfig } from './types'

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

const handleBorderRadiusChange = (value: number) => {
  borderRadius.value = value
  updateSelectionAreaPosition()
}

// 蒙版框选（拖出截图选区）
const { redrawSelection, handleMaskMouseDown, handleMaskMouseMove, handleMaskMouseUp, clearMouseMoveThrottle } =
  useMaskSelection({
    screenConfig,
    maskCanvas,
    maskCtx,
    borderRadius,
    selectionBorderColor,
    overlayMaskColor,
    showButtonGroup,
    onMagnifierMouseMove: (e) => magnifierRef.value?.handleMouseMove(e),
    hideMagnifier: () => magnifierRef.value?.hideMagnifier(),
    onSelectionComplete: updateButtonGroupPosition
  })

// 绘制工具（画笔/矩形/箭头/马赛克）
const { canUndo, currentDrawTool, initDrawTools, drawImgCanvas, handleRedo, handleUndo, resetDrawTools } = useDrawTools(
  {
    drawCanvas,
    drawCtx,
    imgCtx,
    screenConfig
  }
)

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

const resetScreenshot = async () => {
  try {
    clearMouseMoveThrottle()
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

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    resetScreenshot()
  }
}

const handleRightClick = (event: MouseEvent) => {
  event.preventDefault()
  resetScreenshot()
}

// 画布初始化（截图命令 + 三层画布铺设 + 事件注册）
const { initCanvas } = useScreenshotCanvas({
  imgCanvas,
  maskCanvas,
  drawCanvas,
  imgCtx,
  maskCtx,
  drawCtx,
  screenConfig,
  isImageLoaded,
  selectionBorderColor,
  prepareCapture: () => {
    magnifierRef.value?.hideMagnifier()
    resetDrawTools()
    isImageLoaded.value = false
    borderRadius.value = 0
    isDragging.value = false
    isResizing.value = false
  },
  initDrawTools,
  maskHandlers: {
    mousedown: handleMaskMouseDown,
    mousemove: handleMaskMouseMove,
    mouseup: handleMaskMouseUp
  },
  onContextMenu: handleRightClick,
  onKeyDown: handleKeyDown
})

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
  clearMouseMoveThrottle()
  cleanupDragResize()

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
