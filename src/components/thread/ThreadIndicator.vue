<template>
  <div v-clickable v-if="hasReplies" class="thread-indicator" @click="handleOpenThread">
    <n-icon size="16" class="thread-icon">
      <Icon icon="mdi:message-reply-text" />
    </n-icon>
    <span class="reply-count">{{ replyCount }} {{ t('thread.replies') }}</span>
    <n-icon size="14" class="arrow-icon">
      <Icon icon="mdi:chevron-right" />
    </n-icon>
  </div>
  <n-button v-else text size="small" class="start-thread-btn" @click="handleOpenThread">
    <template #icon>
      <n-icon><Icon icon="mdi:message-reply-text" /></n-icon>
    </template>
    {{ t('common.thread.start') }}
  </n-button>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThreadIndicator } from '@/composables/messaging/useThreadIndicator'

const { t } = useI18n()

const props = defineProps<{
  roomId: string
  eventId: string
}>()

const emit = defineEmits<{
  openThread: [eventId: string]
}>()

// 回复数读取与空态派生走共享逻辑，桌面只保留 Naive UI 呈现差异
const { replyCount, hasReplies, loadThreadInfo } = useThreadIndicator(
  () => props.roomId,
  () => props.eventId
)

const handleOpenThread = () => {
  emit('openThread', props.eventId)
}

onMounted(() => {
  loadThreadInfo()
})
</script>

<style scoped lang="scss">
.thread-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--tjg-color-primary-200);
  border-radius: 12px;
  cursor: pointer;
  transition:
    color var(--tjg-motion-duration-normal),
    background-color var(--tjg-motion-duration-normal),
    border-color var(--tjg-motion-duration-normal),
    box-shadow var(--tjg-motion-duration-normal),
    opacity var(--tjg-motion-duration-normal),
    transform var(--tjg-motion-duration-normal);

  &:hover {
    background: var(--tjg-color-primary-500);
    transform: translateX(2px);
  }

  .thread-icon {
    color: var(--tjg-color-primary-500);
  }

  .reply-count {
    font-size: 13px;
    font-weight: 500;
    color: var(--tjg-color-primary-500);
  }

  .arrow-icon {
    color: var(--tjg-color-primary-500);
  }
}

.start-thread-btn {
  font-size: 13px;
  color: var(--tjg-text-secondary);

  &:hover {
    color: var(--tjg-color-primary-500);
  }
}
</style>
