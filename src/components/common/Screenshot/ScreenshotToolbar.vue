<template>
  <div ref="buttonGroupRef" class="button-group" v-show="visible && !isDragging && !isResizing">
    <span
      :class="{ active: currentDrawTool === 'rect' }"
      :title="t('message.screenshot.tool_rect')"
      @click="handleToolClick('rect')">
      <svg><use href="#square"></use></svg>
    </span>
    <span
      :class="{ active: currentDrawTool === 'circle' }"
      :title="t('message.screenshot.tool_circle')"
      @click="handleToolClick('circle')">
      <svg><use href="#round"></use></svg>
    </span>
    <span
      :class="{ active: currentDrawTool === 'arrow' }"
      :title="t('message.screenshot.tool_arrow')"
      @click="handleToolClick('arrow')">
      <svg><use href="#arrow-right-up"></use></svg>
    </span>
    <span
      :class="{ active: currentDrawTool === 'mosaic' }"
      :title="t('message.screenshot.tool_mosaic')"
      @click="handleToolClick('mosaic')">
      <svg><use href="#mosaic"></use></svg>
    </span>
    <span :title="t('message.screenshot.redo')" @click="handleRedo">
      <svg><use href="#refresh"></use></svg>
    </span>
    <span
      :class="{ disabled: !canUndo }"
      :aria-disabled="!canUndo"
      :title="t('message.screenshot.undo')"
      @click.stop="handleUndo">
      <svg><use href="#return"></use></svg>
    </span>
    <span :title="t('message.screenshot.confirm')" @click="handleConfirm">
      <svg><use href="#check-small"></use></svg>
    </span>
    <span :title="t('message.screenshot.cancel')" @click="handleCancel">
      <svg><use href="#close"></use></svg>
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DrawToolType, ScreenConfig } from './types'

const props = defineProps<{
  visible: boolean
  isDragging: boolean
  isResizing: boolean
  currentDrawTool: DrawToolType
  canUndo: boolean
  screenConfig: ScreenConfig
}>()

const emit = defineEmits<{
  (e: 'tool-select', tool: DrawToolType): void
  (e: 'redo'): void
  (e: 'undo'): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()
const buttonGroupRef = ref<HTMLDivElement | null>(null)

const handleToolClick = (tool: DrawToolType) => {
  emit('tool-select', tool)
}

const handleRedo = () => {
  emit('redo')
}

const handleUndo = () => {
  if (props.canUndo) {
    emit('undo')
  }
}

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}

const updatePosition = () => {
  if (!buttonGroupRef.value || !props.visible || props.isDragging || props.isResizing) {
    return
  }

  const { scaleX, scaleY, startX, startY, endX, endY } = props.screenConfig

  const minY = Math.min(startY, endY) / scaleY
  const maxX = Math.max(startX, endX) / scaleX
  const maxY = Math.max(startY, endY) / scaleY

  const availableHeight = window.innerHeight
  const availableWidth = window.innerWidth

  const el = buttonGroupRef.value
  el.style.flexWrap = 'nowrap'
  el.style.whiteSpace = 'nowrap'
  el.style.width = 'max-content'
  el.style.overflow = 'visible'

  const rect = el.getBoundingClientRect()
  const measuredHeight = rect.height
  const contentWidth = el.scrollWidth || rect.width

  const maxAllowedWidth = availableWidth - 20
  const finalWidth = Math.min(contentWidth, maxAllowedWidth)

  const spaceBelow = availableHeight - maxY
  const canFitBelow = spaceBelow >= measuredHeight + 10

  let leftPosition: number
  let topPosition: number

  if (canFitBelow) {
    topPosition = maxY + 4
    leftPosition = maxX - finalWidth
    leftPosition = Math.max(10, Math.min(leftPosition, availableWidth - finalWidth - 10))
  } else {
    topPosition = minY - (measuredHeight + 4)
    if (topPosition < 0) topPosition = 10
    leftPosition = maxX - finalWidth
    leftPosition = Math.max(10, Math.min(leftPosition, availableWidth - finalWidth - 10))
  }

  el.style.top = `${topPosition}px`
  el.style.left = `${leftPosition}px`
  el.style.width = `${finalWidth}px`
  el.style.boxSizing = 'border-box'
}

defineExpose({
  updatePosition,
  buttonGroupRef
})
</script>

<style scoped lang="scss">
.button-group {
  position: absolute;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 5px 8px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  z-index: 999;
  white-space: nowrap;
  overflow: visible;

  span {
    cursor: pointer;
    min-width: 30px;
    height: 30px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    flex: 0 0 auto;

    svg {
      width: 22px;
      height: 22px;
    }

    &:hover svg {
      color: var(--color-primary);
    }

    &.active svg {
      color: var(--color-primary);
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }
  }
}
</style>
