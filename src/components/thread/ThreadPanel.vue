<template>
  <n-drawer v-model:show="visible" :width="400" placement="right" class="thread-panel">
    <n-drawer-content :title="t('thread.title')" closable>
      <n-spin :show="loading">
        <div class="thread-content">
          <div v-if="originalMessage" class="original-message">
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
              <span class="text-14px font-medium">{{ t('thread.replies') }}</span>
              <n-tag size="small" type="info">{{ threadReplies.length }}</n-tag>
              <n-button
                v-if="!isSubscribed"
                size="tiny"
                quaternary
                type="primary"
                @click="handleSubscribe">
                {{ t('thread.subscribe') }}
              </n-button>
              <n-button
                v-if="isSubscribed && !isMuted"
                size="tiny"
                quaternary
                type="warning"
                @click="handleMute">
                {{ t('thread.mute') }}
              </n-button>
            </n-flex>

            <n-scrollbar style="height: calc(100vh - 350px)">
              <n-empty v-if="threadReplies.length === 0" :description="t('thread.no_replies')" />
              <div v-else class="reply-list">
                <div v-for="reply in threadReplies" :key="reply.event_id" class="reply-item">
                  <n-flex :size="12">
                    <n-avatar :size="28" :src="AvatarUtils.getAvatarUrl(getAvatarUrl(reply.sender))" round />
                    <n-flex vertical :size="4" class="flex-1">
                      <n-flex align="center" :size="8">
                        <span class="sender-name">{{ getDisplayName(reply.sender) }}</span>
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
      </n-spin>

      <template #footer>
        <n-flex :size="8">
          <n-input
            v-model:value="replyContent"
            type="textarea"
            :placeholder="t('thread.reply_placeholder')"
            :autosize="{ minRows: 1, maxRows: 4 }"
            @keydown.enter.ctrl="handleSendReply" />
          <n-button type="primary" :disabled="!replyContent.trim() || sending" :loading="sending" @click="handleSendReply">
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
import { useI18n } from 'vue-i18n'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { useUserStore } from '@/stores/user'
import dayjs from 'dayjs'
import matrixThreadService, { type ThreadReply } from '@/services/matrix/MatrixThreadService'
import { matrixClientService, matrixMessageService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ThreadPanel')
const { t } = useI18n()
const userStore = useUserStore()

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

const emit = defineEmits<{
  (e: 'sendReply', content: string): void
  (e: 'replySent', event: any): void
}>()

const replyContent = ref('')
const threadReplies = ref<ThreadReply[]>([])
const loading = ref(false)
const sending = ref(false)
const isSubscribed = ref(false)
const isMuted = ref(false)

const formatTime = (timestamp?: number) => {
  if (!timestamp) return ''
  return dayjs(timestamp).format('MM-DD HH:mm')
}

const getAvatarUrl = (userId: string): string | undefined => {
  const user = userStore.getUserById(userId)
  return user?.avatarUrl ?? undefined
}

const getDisplayName = (userId: string): string => {
  const user = userStore.getUserById(userId)
  return user?.displayName || user?.name || userId
}

const loadThreadReplies = async () => {
  if (!props.roomId || !props.threadId) {
    threadReplies.value = []
    return
  }

  loading.value = true
  try {
    const replies = await matrixThreadService.getThreadReplies(props.roomId, props.threadId)
    threadReplies.value = replies
  } catch (err) {
    logger.error('加载线程回复失败:', err)
    threadReplies.value = []
  } finally {
    loading.value = false
  }
}

const handleSubscribe = async () => {
  if (!props.roomId || !props.threadId) return

  const success = await matrixThreadService.subscribeToThread(props.roomId, props.threadId)
  if (success) {
    isSubscribed.value = true
    window.$message?.success(t('thread.subscribe_success'))
  }
}

const handleMute = async () => {
  if (!props.roomId || !props.threadId) return

  const success = await matrixThreadService.muteThread(props.roomId, props.threadId)
  if (success) {
    isMuted.value = true
    window.$message?.success(t('thread.mute_success'))
  }
}

const handleSendReply = async () => {
  if (!replyContent.value.trim() || !props.roomId || !props.threadId) return

  sending.value = true
  try {
    const content = {
      body: replyContent.value.trim(),
      msgtype: 'm.text',
      'm.relates_to': {
        rel_type: 'm.thread',
        event_id: props.threadId
      }
    }

    const eventId = await matrixMessageService.sendEvent(props.roomId, 'm.room.message', content)
    emit('replySent', { eventId, content: replyContent.value.trim() })
    emit('sendReply', replyContent.value.trim())
    replyContent.value = ''

    await loadThreadReplies()
  } catch (err) {
    logger.error('发送回复失败:', err)
    window.$message?.error(t('thread.send_failed'))
  } finally {
    sending.value = false
  }
}

watch(visible, (val) => {
  if (val && props.threadId) {
    loadThreadReplies()
  }
})

watch(
  () => props.threadId,
  (val) => {
    if (val && visible.value) {
      loadThreadReplies()
    }
  }
)
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
  background: var(--bg-color);
  border-radius: 8px;
  border-left: 3px solid var(--primary-color);

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
    color: var(--text-color-3);
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
    color: var(--text-color-3);
  }

  .reply-content {
    font-size: 13px;
    line-height: 1.4;
    color: var(--text-color);
  }
}
</style>
