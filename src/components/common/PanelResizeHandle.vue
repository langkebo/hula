<template>
  <div
    data-testid="panel-resize-handle"
    class="panel-resize-handle"
    :style="{ cursor: 'col-resize' }"
    @pointerdown="onPointerDown"
  />
</template>

<script setup lang="ts">
import { useSettingStore } from '@/stores/domains/settings/setting'

const props = defineProps<{ side: 'left' | 'right' }>()
const settingStore = useSettingStore()

let dragging = false

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
    dragging = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
</script>

<style scoped>
.panel-resize-handle {
  position: absolute;
  top: 0;
  right: -2px;
  width: 4px;
  height: 100%;
  background: var(--hula-border-muted);
  z-index: 10;
  transition: background var(--hula-motion-duration-fast) var(--hula-motion-ease-standard);
}
.panel-resize-handle:hover {
  background: var(--hula-color-primary-300);
}
</style>
