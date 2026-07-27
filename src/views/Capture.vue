<template>
  <Screenshot :is-capturing="isCapturing" />
</template>
<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useTauriListener } from '@/composables/common/useTauriListener'
import { hasTauriRuntime } from '@/utils/AppHarness'

const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const { addListener } = useTauriListener()
const isCapturing = ref(false)

watchEffect(() => {
  if (!appWindow) return
  addListener(
    appWindow.listen('capture', (e) => {
      nextTick(() => {
        isCapturing.value = e.payload as boolean
      })
    }),
    'capture-toggle'
  )
})
</script>

<style scoped lang="scss"></style>
