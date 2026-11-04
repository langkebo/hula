<template>
  <div class="size-full rounded-8px bg-[--right-bg-color]">
    <ActionBar :shrink="false" :current-label="currentWindowLabel" />

    <n-alert :title="t('common.notice')" type="warning">{{ t('common.feature_in_development') }}</n-alert>
  </div>
</template>
<script setup lang="ts">
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useI18n } from 'vue-i18n'
import { hasTauriRuntime } from '@/utils/AppHarness'

const { t } = useI18n()
const currentWindowLabel = computed(() => (hasTauriRuntime() ? WebviewWindow.getCurrent().label : ''))

onMounted(async () => {
  if (hasTauriRuntime()) {
    await getCurrentWebviewWindow().show()
  }
})
</script>
