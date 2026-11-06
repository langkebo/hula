<template>
  <div v-clickable v-if="hasReplies" class="thread-indicator" @click="handleOpenThread">
    <van-icon name="chat-o" size="14" />
    <span class="reply-count">{{ replyCount }}</span>
    <van-icon name="arrow" size="12" />
  </div>
  <van-button v-else plain size="mini" type="primary" icon="chat-o" @click="handleOpenThread">
    {{ t('common.thread.start') }}
  </van-button>
</template>

<script setup lang="ts">
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

// 回复数读取与空态派生走共享逻辑，移动端只保留 Vant 呈现差异
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
  gap: 4px;
  padding: 4px 10px;
  background: var(--van-primary-color);
  background-opacity: 0.1;
  border-radius: 12px;
  cursor: pointer;

  .reply-count {
    font-size: 12px;
    font-weight: 500;
    color: var(--van-primary-color);
  }

  .van-icon {
    color: var(--van-primary-color);
  }
}
</style>
