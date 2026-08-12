<template>
  <div
    data-testid="panel-resize-handle"
    class="panel-resize-handle"
    :style="{ cursor: 'col-resize' }"
    @pointerdown="onPointerDown" />
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue'
import { useSettingStore } from '@/stores/domains/settings/setting'

const props = defineProps<{ side: 'left' | 'right' }>()
const settingStore = useSettingStore()

let dragging = false
let activeMove: ((ev: PointerEvent) => void) | null = null
let activeUp: (() => void) | null = null

function cleanupDrag() {
  if (activeMove) {
    window.removeEventListener('pointermove', activeMove)
    activeMove = null
  }
  if (activeUp) {
    window.removeEventListener('pointerup', activeUp)
    activeUp = null
  }
  if (dragging) {
    dragging = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
}

function onPointerDown(e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  dragging = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const startX = e.clientX
  const startWidth = settingStore.panelWidth[props.side]

  const onMove = (ev: PointerEvent) => {
    if (!dragging) return
    const delta = ev.clientX - startX
    settingStore.setPanelWidth(props.side, startWidth + delta)
  }
  const onUp = () => {
    cleanupDrag()
  }
  activeMove = onMove
  activeUp = onUp
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

onUnmounted(cleanupDrag)
</script>

<style scoped>
.panel-resize-handle {
  position: absolute;
  top: 0;
  right: -2px;
  width: 4px;
  height: 100%;
  background: var(--tjg-border-muted);
  z-index: 10;
  transition: background var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);
}
.panel-resize-handle:hover {
  background: var(--tjg-color-primary-300);
}
</style>
