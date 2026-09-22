<template>
  <n-drawer v-model:show="visible" :width="400" placement="right" class="thread-panel">
    <n-drawer-content :title="t('thread.title')" closable>
      <div class="thread-content">
        <div class="original-message">
          <div class="message-header">
            <n-avatar :size="32" :src="AvatarUtils.getAvatarUrl(originalMessage?.senderAvatar)" round />
            <n-flex vertical :size="2">
              <span class="sender-name">{{ originalMessage?.senderName }}</span>
              <span class="message-time">{{ formatTime(originalMessage?.timestamp) }}</span>
            </n-flex>
          </div>
          <div class="message-body">
            {{ originalMessage?.content }}
          </div>
        </div>

        <n-divider />

        <div class="thread-replies">
          <n-flex align="center" :size="8" class="mb-12px">
            <span class="text-[length:var(--tjg-font-size-base)] font-medium">{{ t('thread.replies') }}</span>
            <n-tag size="small" type="info">{{ threadReplies.length }}</n-tag>
          </n-flex>

          <n-scrollbar class="h-[calc(100vh-350px)]">
            <n-empty v-if="threadReplies.length === 0" :description="t('thread.no_replies')" />
            <div v-else class="reply-list">
              <div v-for="reply in threadReplies" :key="reply.id" class="reply-item">
                <n-flex :size="12">
                  <n-avatar :size="28" :src="AvatarUtils.getAvatarUrl(reply.senderAvatar)" round />
                  <n-flex vertical :size="4" class="flex-1">
                    <n-flex align="center" :size="8">
                      <span class="sender-name">{{ reply.senderName }}</span>
                      <span class="message-time">{{ formatTime(reply.timestamp) }}</span>
                    </n-flex>
                    <div class="reply-content">{{ reply.content }}</div>
                  </n-flex>
                </n-flex>
              </div>
            </div>
          </n-scrollbar>
        </div>
      </div>

      <template #footer>
        <n-flex :size="8">
          <n-input
            v-model:value="replyContent"
            type="textarea"
            :placeholder="t('thread.reply_placeholder')"
            :autosize="{ minRows: 1, maxRows: 4 }"
            @keydown.enter.ctrl="handleSendReply" />
          <n-button type="primary" :disabled="!replyContent.trim()" :loading="sendingReply" @click="handleSendReply">
            <template #icon>
              <n-icon>
                <svg><use href="#send" /></svg>
              </n-icon>
            </template>
          </n-button>
        </n-flex>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixThreadService } from '@/services/matrix/messaging/MatrixThreadService'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ThreadPanel')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

interface ThreadMessage {
  id: string
  senderId: string
  senderName: string
  senderAvatar?: string
  content: string
  timestamp: number
}

const visible = defineModel<boolean>('show', { default: false })

const props = defineProps<{
  originalMessage?: ThreadMessage
  threadId?: string
  roomId?: string
}>()

const replyContent = ref('')
const sendingReply = ref(false)
const threadReplies = ref<ThreadMessage[]>([])

const formatTime = (timestamp?: number) => {
  if (!timestamp) return ''
  return dayjs(timestamp).format('MM-DD HH:mm')
}

const handleSendReply = async () => {
  const body = replyContent.value.trim()
  if (!body || sendingReply.value) return
  if (!props.roomId || !props.threadId) {
    showFeedback(t('thread.send_failed'), 'error')
    return
  }

  sendingReply.value = true
  try {
    await matrixThreadService.sendThreadReply(props.roomId, props.threadId, { body })
    replyContent.value = ''
    await loadThreadReplies()
  } catch (err) {
    logger.error(`发送线程回复失败: ${err}`)
    showFeedback(t('thread.send_failed'), 'error')
  } finally {
    sendingReply.value = false
  }
}

watch(visible, (val) => {
  if (val && props.threadId) {
    loadThreadReplies()
  }
})

const loadThreadReplies = async () => {
  if (!props.roomId || !props.threadId) return
  try {
    const replies = await matrixThreadService.getThreadRepliesViaApi(props.roomId, props.threadId)
    threadReplies.value = replies.map((reply) => ({
      id: reply.event_id,
      senderId: reply.sender,
      senderName: reply.sender,
      content: typeof reply.content?.body === 'string' ? reply.content.body : '',
      timestamp: reply.origin_server_ts
    }))
  } catch (err) {
    logger.error(`加载线程回复失败: ${err}`)
    showFeedback(t('thread.load_failed'), 'error')
  }
}
</script>

<style scoped lang="scss">
.thread-panel {
  :deep(.n-drawer-body-content) {
    padding: 0;
    display: flex;
    flex-direction: column;
  }
}

.thread-content {
  flex: 1;
  padding: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.original-message {
  padding: 12px;
  background: var(--tjg-surface-app);
  border-radius: 8px;
  border-left: 3px solid var(--tjg-color-primary-500);

  .message-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .sender-name {
    font-size: 14px;
    font-weight: 500;
  }

  .message-time {
    font-size: 12px;
    color: var(--tjg-text-tertiary);
  }

  .message-body {
    font-size: 14px;
    line-height: 1.5;
  }
}

.thread-replies {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.reply-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reply-item {
  padding: 8px 0;

  .sender-name {
    font-size: 13px;
    font-weight: 500;
  }

  .message-time {
    font-size: 11px;
    color: var(--tjg-text-tertiary);
  }

  .reply-content {
    font-size: 13px;
    line-height: 1.4;
    color: var(--tjg-text-primary);
  }
}
</style>
