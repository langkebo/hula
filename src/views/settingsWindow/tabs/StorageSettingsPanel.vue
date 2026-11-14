<template>
  <div class="storage-panel">
    <div class="storage-panel-header">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.preferences.storage_directory_label') }}</span>
        <span class="setting-desc">{{ t('setting.preferences.storage_directory_desc') }}</span>
      </div>
      <n-button size="small" :disabled="scanning || !currentDirectory" @click="startScan">
        {{ scanning ? t('setting.storage.scanning') : t('setting.storage.start_scan') }}
      </n-button>
    </div>
    <div class="storage-path-row">
      <n-radio-group v-model:value="pathType" @update:value="handleStoragePathTypeChange">
        <n-radio value="default">{{ t('setting.storage.path_type_default') }}</n-radio>
        <n-radio value="custom">{{ t('setting.storage.path_type_custom') }}</n-radio>
      </n-radio-group>
      <n-button v-if="pathType === 'custom'" size="small" secondary :disabled="scanning" @click="selectCustomDirectory">
        {{ t('setting.storage.select_directory') }}
      </n-button>
    </div>
    <div class="storage-directory">{{ currentDirectory || t('setting.storage.fetching_directory') }}</div>
    <div class="storage-stats">
      <span>
        {{ t('setting.storage.processed_files') }}
        {{ t('setting.storage.processed_files_unit', { count: scanProgress.files_processed ?? 0 }) }}
      </span>
      <span>{{ t('setting.storage.total_size') }} {{ formatBytes(scanProgress.total_size) }}</span>
      <span>{{ storageProgressText }}</span>
    </div>
    <n-progress
      type="line"
      :percentage="
        showDiskUsage && diskInfo
          ? Number(diskInfo.disk_usage_percentage.toFixed(0))
          : Number(scanningProgress.toFixed(0))
      "
      :processing="scanning" />
  </div>
</template>

<script setup lang="ts">
import { open } from '@tauri-apps/plugin-dialog'
import { NButton, NProgress, NRadio, NRadioGroup } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useScannerStore } from '@/stores/domains/widget/scanner'
import { formatBytes } from '@/utils/Formatting.ts'
import { isDesktop } from '@/utils/PlatformConstants'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const scannerStore = useScannerStore()
const { pathType, currentDirectory, scanning, showDiskUsage, diskInfo, scanProgress, scanningProgress } =
  storeToRefs(scannerStore)
const desktopRuntimeAvailable = isDesktop()

const storageProgressText = computed(() => {
  if (showDiskUsage.value && diskInfo.value) {
    return t('setting.preferences.storage_disk_usage', {
      percentage: diskInfo.value.disk_usage_percentage.toFixed(2)
    })
  }

  return t('setting.preferences.storage_scan_progress', {
    percentage: scanningProgress.value.toFixed(0)
  })
})

onMounted(async () => {
  if (!desktopRuntimeAvailable) return
  try {
    await scannerStore.initializeScanner()
  } catch {
    showFeedback(t('setting.preferences.feedback.initialize_storage_scan_failed'), 'warning')
  }
})

function handleStoragePathTypeChange(value: 'default' | 'custom') {
  scannerStore.setPathType(value)
}

async function selectCustomDirectory() {
  try {
    const result = await open({
      directory: true,
      title: t('setting.storage.select_directory_title')
    })
    if (result) {
      scannerStore.setCustomDirectory(result)
    }
  } catch {
    showFeedback(t('setting.storage.select_directory_error'), 'error')
  }
}

async function startScan() {
  const success = await scannerStore.startScan()
  if (!success) {
    // 失败后 scanning 已复位，按钮仍可点击即重试入口
    showFeedback(t('setting.storage.scan_failed'), 'error')
  }
}
</script>

<style scoped>
.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}

.setting-desc {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}

.storage-panel {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-3);
  margin-top: var(--tjg-space-3);
  padding: var(--tjg-space-4);
  border: 1px solid var(--tjg-settings-divider);
  border-radius: var(--tjg-radius-md);
  background: var(--tjg-settings-card-bg);
}

.storage-panel-header,
.storage-path-row,
.storage-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-3);
}

.storage-stats {
  flex-wrap: wrap;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

.storage-directory {
  padding: 10px var(--tjg-space-3);
  border-radius: var(--tjg-radius-sm);
  background: var(--tjg-settings-card-bg-hover);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
  word-break: break-all;
}
</style>
