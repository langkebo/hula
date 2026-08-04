<template>
  <div v-if="hasReplies" class="thread-indicator" @click="handleOpenThread">
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
    {{ t('thread.start') }}
  </n-button>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixThreadService } from '@/services/matrix/messaging/MatrixThreadService'

const { getThread } = matrixThreadService

const { t } = useI18n()

const props = defineProps<{
  roomId: string
  eventId: string
}>()

const emit = defineEmits<{
  openThread: [eventId: string]
}>()

const replyCount = ref(0)

const hasReplies = computed(() => replyCount.value > 0)

const loadThreadInfo = () => {
  const thread = getThread(props.roomId, props.eventId)
  if (thread) {
    replyCount.value = thread.replyCount
  }
}

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
  transition: all 0.2s;

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
