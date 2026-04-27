<template>
  <div ref="selectionAreaRef" class="selection-area" v-show="visible" :style="selectionAreaStyle">
    <div
      :class="['drag-area', currentDrawTool ? 'cannot-drag' : 'can-drag']"
      :title="t('message.screenshot.tooltip_drag')"
      @mousedown="handleDragStart"
      @dblclick="emit('confirm')"></div>

    <div
      v-for="handle in resizeHandles"
      :key="handle.direction"
      :class="['resize-handle', `resize-${handle.direction}`, { disabled: currentDrawTool }]"
      :title="t('message.screenshot.tooltip_resize')"
      @mousedown.stop="handleResizeStart($event, handle.direction)"></div>

    <div class="border-radius-controller" :style="borderRadiusControllerStyle" @click.stop>
      <label>{{ t('message.screenshot.border_radius') }}:</label>
      <input type="range" :value="borderRadius" @input="handleBorderRadiusChange" min="0" max="100" step="1" />
      <span>{{ borderRadius }}px</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SelectionAreaStyle, DrawToolType, ScreenConfig } from './types'

const props = defineProps<{
  visible: boolean
  selectionAreaStyle: SelectionAreaStyle
  currentDrawTool: DrawToolType
  borderRadius: number
  screenConfig: ScreenConfig
}>()

const emit = defineEmits<{
  (e: 'drag-start', event: MouseEvent): void
  (e: 'drag-move', event: MouseEvent): void
  (e: 'drag-end'): void
  (e: 'resize-start', event: MouseEvent, direction: string): void
  (e: 'resize-move', event: MouseEvent): void
  (e: 'resize-end'): void
  (e: 'border-radius-change', value: number): void
  (e: 'confirm'): void
}>()

const { t } = useI18n()
const selectionAreaRef = ref<HTMLDivElement | null>(null)

const resizeHandles = [
  { direction: 'nw' },
  { direction: 'ne' },
  { direction: 'sw' },
  { direction: 'se' },
  { direction: 'n' },
  { direction: 'e' },
  { direction: 's' },
  { direction: 'w' }
]

const borderRadiusControllerStyle = ref({
  left: '0px',
  top: '0px'
})

const handleDragStart = (event: MouseEvent) => {
  emit('drag-start', event)
}

const handleResizeStart = (event: MouseEvent, direction: string) => {
  emit('resize-start', event, direction)
}

const handleBorderRadiusChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('border-radius-change', parseInt(target.value, 10))
}

const updateBorderRadiusControllerPosition = () => {
  if (!selectionAreaRef.value) return

  const controllerHeight = 35
  const controllerWidth = 120

  const selectionLeft = parseFloat(props.selectionAreaStyle.left)
  const selectionTop = parseFloat(props.selectionAreaStyle.top)

  let left = 0
  let top = selectionTop - controllerHeight

  if (top < 0) {
    top = 4
  }

  borderRadiusControllerStyle.value = {
    left: `${left}px`,
    top: `${top - selectionTop}px`
  }
}

defineExpose({
  selectionAreaRef,
  updateBorderRadiusControllerPosition
})
</script>

<style scoped lang="scss">
.selection-area {
  position: absolute;
  z-index: 2;
  background: transparent;
  box-sizing: border-box;
}

.drag-area {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  bottom: 8px;
  z-index: 10;
  background: transparent;
}

.drag-area.can-drag {
  cursor: move;
}

.drag-area.cannot-drag {
  cursor: not-allowed;
}

.resize-handle {
  position: absolute;
  background: var(--hula-surface-panel);
  border: 1px solid var(--hula-border-strong);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  z-index: 4;
  transition: all 0.2s;
}

.resize-handle.disabled {
  background: var(--hula-border-strong);
  cursor: not-allowed;
  opacity: 0.5;
}

.resize-nw {
  top: -4px;
  left: -4px;
  cursor: nw-resize;
}

.resize-ne {
  top: -4px;
  right: -4px;
  cursor: ne-resize;
}

.resize-sw {
  bottom: -4px;
  left: -4px;
  cursor: sw-resize;
}

.resize-se {
  bottom: -4px;
  right: -4px;
  cursor: se-resize;
}

.resize-n {
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  cursor: n-resize;
}

.resize-e {
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  cursor: e-resize;
}

.resize-s {
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  cursor: s-resize;
}

.resize-w {
  left: -6px;
  top: 50%;
  transform: translateY(-50%);
  cursor: w-resize;
}

.border-radius-controller {
  position: absolute;
  left: 0;
  background: var(--hula-overlay-inverse-strong);
  color: var(--hula-text-inverse);
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  z-index: 999;
  white-space: nowrap;

  label {
    margin: 0;
  }

  input[type='range'] {
    width: 60px;
    height: 4px;
    background: var(--hula-border-default);
    border-radius: 2px;
    outline: none;
    margin: 0;

    &::-webkit-slider-thumb {
      appearance: none;
      width: 12px;
      height: 12px;
      background: var(--hula-surface-panel);
      border-radius: 50%;
      cursor: pointer;
    }

    &::-moz-range-thumb {
      width: 12px;
      height: 12px;
      background: white;
      border-radius: 50%;
      border: none;
      cursor: pointer;
    }
  }

  span {
    font-size: 11px;
    min-width: 25px;
  }
}
</style>
