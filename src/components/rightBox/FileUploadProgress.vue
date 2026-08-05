<template>
  <div
    v-if="(queue.isActive || queue.endTime) && queue.totalFiles > 1"
    class="file-upload-progress"
    :class="{ 'is-completed': !queue.isActive && queue.endTime }">
    <!-- 进度条头部信息 -->
    <div class="flex-y-center pb-10px">
      <div class="flex-center gap-8px">
        <svg class="size-16px color-[--tjg-text-primary]">
          <use href="#file2"></use>
        </svg>
        <span class="text-(14px [--tjg-text-primary]) max-w-200px truncate">
          {{ getStatusText() }}
        </span>
        <span class="text-(12px [--tjg-text-primary])">{{ queue.completedFiles }}/{{ queue.totalFiles }}</span>
      </div>
    </div>

    <!-- 主进度条 -->
    <n-progress
      type="line"
      :percentage="progress"
      :show-indicator="false"
      :height="6"
      :border-radius="3"
      :color="'var(--tjg-color-primary-500)'"
      :rail-color="'var(--tjg-border-strong)'" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { globalFileUploadQueue } from '@/composables/common/useFileUploadQueue'

const { t } = useI18n()

// 队列状态
const { queue, progress, isUploading } = globalFileUploadQueue

// 状态文本
const getStatusText = () => {
  if (queue.isActive) {
    if (isUploading.value) {
      const uploadingFile = queue.items.find((item) => item.status === 'uploading')
      return uploadingFile
        ? t('message.file_upload_progress.uploading_with_name', { name: uploadingFile.name })
        : t('message.file_upload_progress.uploading')
    }
    return t('message.file_upload_progress.preparing')
  } else if (queue.endTime) {
    if (queue.failedFiles > 0) {
      return t('message.file_upload_progress.completed_failed', { count: queue.failedFiles })
    } else {
      return t('message.file_upload_progress.completed')
    }
  }
  return ''
}
</script>

<style scoped lang="scss">
.file-upload-progress {
  @apply absolute w-fit max-w-260px bottom-10px left-20px z-1000 rounded-8px p-12px;
  background: var(--tjg-surface-panel);
  border-radius: 8px;
  box-shadow: var(--tjg-shadow-md);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: all var(--tjg-motion-duration-overlay) ease;
}

.progress-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
