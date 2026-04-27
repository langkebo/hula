<template>
  <div ref="magnifierRef" class="magnifier" :style="magnifierStyle">
    <canvas ref="magnifierCanvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type Ref } from 'vue'
import type { ScreenConfig, MagnifierConfig } from './types'

const props = defineProps<{
  imgCanvas: HTMLCanvasElement | null
  screenConfig: ScreenConfig
  isDragging: boolean
  isResizing: boolean
  showButtonGroup: boolean
  isImageLoaded: boolean
  config?: Partial<MagnifierConfig>
}>()

const magnifierRef = ref<HTMLDivElement | null>(null)
const magnifierCanvas = ref<HTMLCanvasElement | null>(null)
const magnifierCtx = ref<CanvasRenderingContext2D | null>(null)
const selectionBorderColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--hula-color-primary-500')
  .trim()

const defaultConfig: MagnifierConfig = {
  width: 120,
  height: 120,
  zoomFactor: 3
}

const mergedConfig = computed(() => ({
  ...defaultConfig,
  ...props.config
}))

const magnifierStyle = ref({
  display: 'none',
  top: '0px',
  left: '0px'
})

const initMagnifier = () => {
  if (magnifierCanvas.value) {
    magnifierCanvas.value.width = mergedConfig.value.width
    magnifierCanvas.value.height = mergedConfig.value.height
    magnifierCtx.value = magnifierCanvas.value.getContext('2d', { willReadFrequently: true })
  }
}

const hideMagnifier = () => {
  if (magnifierRef.value) {
    magnifierRef.value.style.display = 'none'
  }
}

const showMagnifier = () => {
  if (magnifierRef.value) {
    magnifierRef.value.style.display = 'block'
  }
}

const handleMouseMove = (event: MouseEvent) => {
  if (!magnifierRef.value || !props.imgCanvas) return

  if (props.isDragging) {
    hideMagnifier()
    return
  }

  if (props.showButtonGroup && !props.isDragging && !props.isResizing) {
    hideMagnifier()
    return
  }

  if (!props.isImageLoaded) {
    hideMagnifier()
    return
  }

  if (magnifierCtx.value === null && magnifierCanvas.value) {
    magnifierCanvas.value.width = mergedConfig.value.width
    magnifierCanvas.value.height = mergedConfig.value.height
    magnifierCtx.value = magnifierCanvas.value.getContext('2d')
  }

  if (!magnifierCtx.value) return

  showMagnifier()

  const clientX = event.clientX
  const clientY = event.clientY
  const rect = props.imgCanvas.getBoundingClientRect()
  const mouseX = clientX - rect.left
  const mouseY = clientY - rect.top

  let magnifierTop = clientY + 20
  let magnifierLeft = clientX + 20

  if (magnifierTop + mergedConfig.value.height > window.innerHeight) {
    magnifierTop = clientY - mergedConfig.value.height - 20
  }
  if (magnifierLeft + mergedConfig.value.width > window.innerWidth) {
    magnifierLeft = clientX - mergedConfig.value.width - 20
  }

  magnifierRef.value.style.top = `${magnifierTop}px`
  magnifierRef.value.style.left = `${magnifierLeft}px`

  const sourceX = mouseX * props.screenConfig.scaleX - mergedConfig.value.width / mergedConfig.value.zoomFactor / 2
  const sourceY = mouseY * props.screenConfig.scaleY - mergedConfig.value.height / mergedConfig.value.zoomFactor / 2
  const sourceWidth = mergedConfig.value.width / mergedConfig.value.zoomFactor
  const sourceHeight = mergedConfig.value.height / mergedConfig.value.zoomFactor

  magnifierCtx.value.clearRect(0, 0, mergedConfig.value.width, mergedConfig.value.height)

  magnifierCtx.value.drawImage(
    props.imgCanvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    mergedConfig.value.width,
    mergedConfig.value.height
  )

  magnifierCtx.value.strokeStyle = selectionBorderColor || 'black'
  magnifierCtx.value.lineWidth = 1
  magnifierCtx.value.beginPath()
  magnifierCtx.value.moveTo(mergedConfig.value.width / 2, 0)
  magnifierCtx.value.lineTo(mergedConfig.value.width / 2, mergedConfig.value.height)
  magnifierCtx.value.moveTo(0, mergedConfig.value.height / 2)
  magnifierCtx.value.lineTo(mergedConfig.value.width, mergedConfig.value.height / 2)
  magnifierCtx.value.stroke()
}

defineExpose({
  initMagnifier,
  hideMagnifier,
  showMagnifier,
  handleMouseMove
})
</script>

<style scoped lang="scss">
.magnifier {
  position: absolute;
  pointer-events: none;
  width: 120px;
  height: 120px;
  border: 1px solid var(--hula-border-strong);
  border-radius: 12px;
  overflow: hidden;
  display: none;
  background: var(--hula-surface-panel);
  box-shadow: var(--hula-shadow-md);

  canvas {
    display: block;
  }
}
</style>
