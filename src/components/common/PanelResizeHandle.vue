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
  dragging = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const onMove = (ev: PointerEvent) => {
    if (!dragging) return
    settingStore.setPanelWidth(props.side, ev.clientX)
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
  width: 4px;
  height: 100%;
  background: var(--hula-border-muted);
  flex-shrink: 0;
  transition: background var(--hula-motion-duration-fast) var(--hula-motion-ease-standard);
}
.panel-resize-handle:hover {
  background: var(--hula-color-primary-300);
}
</style>
