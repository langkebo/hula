<template>
  <n-drawer v-model:show="visible" :width="400" placement="right" class="thread-panel">
    <n-drawer-content :title="t('thread.title')" closable>
      <template #header>
        <n-flex align="center" :size="8" class="thread-header">
          <span>{{ t('thread.title') }}</span>
          <n-tag v-if="isFrozen" size="small" type="warning" data-testid="thread-frozen-tag">
            {{ t('thread.frozen') }}
          </n-tag>
          <n-tag v-if="isMuted" size="small" data-testid="thread-muted-tag">{{ t('thread.muted') }}</n-tag>
          <div class="thread-header-spacer" />
          <n-button
            quaternary
            circle
            size="small"
            :loading="pendingAction === 'freeze'"
            :aria-label="isFrozen ? t('thread.unfreeze') : t('thread.freeze')"
            @click="handleToggleFreeze">
            <template #icon>
              <n-icon>
                <Icon :icon="isFrozen ? 'mdi:lock-open-variant-outline' : 'mdi:snowflake'" />
              </n-icon>
            </template>
          </n-button>
          <n-button
            quaternary
            circle
            size="small"
            :loading="pendingAction === 'mute'"
            :aria-label="isMuted ? t('thread.unmute') : t('thread.mute')"
            @click="handleToggleMute">
            <template #icon>
              <n-icon>
                <Icon :icon="isMuted ? 'mdi:bell-off-outline' : 'mdi:bell-outline'" />
              </n-icon>
            </template>
          </n-button>
          <n-popconfirm @positive-click="handleDeleteThread">
            <template #trigger>
              <n-button
                quaternary
                circle
                size="small"
                :loading="deleting"
                :aria-label="t('thread.delete')"
                data-testid="thread-delete">
                <template #icon>
                  <n-icon>
                    <svg aria-hidden="true"><use href="#delete" /></svg>
                  </n-icon>
                </template>
              </n-button>
            </template>
            {{ t('thread.delete_confirm') }}
          </n-popconfirm>
        </n-flex>
      </template>
      <div class="thread-content">
        <div class="original-message">
          <div class="message-header">
            <n-avatar :size="32" :src="AvatarUtils.getAvatarUrl(originalMessage?.senderAvatar)" round />
            <n-flex vertical :size="2">
              <span class="sender-name">{{ originalMessage?.senderName }}</span>
              <span class="message-time">{{ formatChatTime(originalMessage?.timestamp ?? 0) }}</span>
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
            <n-tag size="small" type="info" data-testid="thread-reply-count">{{ replyCount }}</n-tag>
            <n-tag v-if="participantCount > 0" size="small" data-testid="thread-participant-count">
              {{ t('thread.participants', { count: participantCount }) }}
            </n-tag>
          </n-flex>

          <n-scrollbar class="h-[calc(var(--tjg-viewport-height, 100vh)-350px)]">
            <EmptyState v-if="threadReplies.length === 0" compact :description="t('thread.no_replies')" />
            <div v-else class="reply-list">
              <div v-for="reply in threadReplies" :key="reply.id" class="reply-item">
                <n-flex :size="12">
                  <n-avatar :size="28" :src="AvatarUtils.getAvatarUrl(reply.senderAvatar)" round />
                  <n-flex vertical :size="4" class="flex-1">
                    <n-flex align="center" :size="8" class="reply-meta">
                      <span class="sender-name">{{ reply.senderName }}</span>
                      <span class="message-time">{{ formatChatTime(reply.timestamp) }}</span>
                      <div class="reply-meta-spacer" />
                      <n-popconfirm v-if="isOwnReply(reply)" @positive-click="handleRedactReply(reply)">
                        <template #trigger>
                          <n-button
                            text
                            size="tiny"
                            :loading="redactingId === reply.id"
                            :aria-label="t('thread.redact')"
                            :data-testid="`thread-redact-${reply.id}`">
                            {{ t('thread.redact') }}
                          </n-button>
                        </template>
                        {{ t('thread.redact_confirm') }}
                      </n-popconfirm>
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
        <div v-if="isFrozen" class="frozen-hint">{{ t('thread.frozen_reason') }}</div>
        <n-flex :size="8">
          <n-input
            v-model:value="replyContent"
            type="textarea"
            :disabled="isFrozen"
            :placeholder="isFrozen ? t('thread.frozen_reason') : t('thread.reply_placeholder')"
            :autosize="{ minRows: 1, maxRows: 4 }"
            @keydown.enter.ctrl="handleSendReply" />
          <n-button
            type="primary"
            :disabled="isFrozen || !replyContent.trim()"
            :loading="sendingReply"
            :aria-label="t('common.send')"
            @click="handleSendReply">
            <template #icon>
              <n-icon>
                <svg aria-hidden="true"><use href="#send" /></svg>
              </n-icon>
            </template>
          </n-button>
        </n-flex>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { matrixThreadService } from '@/services/matrix/messaging/MatrixThreadService'
import type { ThreadStatistics } from '@/services/matrix/messaging/threadTypes'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatChatTime } from '@/utils/ComputedTime'
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
  originalMessage?: ThreadMessage | undefined
  threadId?: string
  roomId?: string
}>()

const replyContent = ref('')
const sendingReply = ref(false)
const threadReplies = ref<ThreadMessage[]>([])
const isFrozen = ref(false)
const isMuted = ref(false)
const pendingAction = ref<'freeze' | 'mute' | null>(null)
const threadStats = ref<ThreadStatistics | null>(null)
const deleting = ref(false)
const redactingId = ref<string | null>(null)

const replyCount = computed(() => threadStats.value?.totalReplies ?? threadReplies.value.length)
const participantCount = computed(() => threadStats.value?.totalParticipants ?? 0)

const isOwnReply = (reply: ThreadMessage) => {
  const userId = matrixClientService.getUserId()
  return !!userId && reply.senderId === userId
}

const handleSendReply = async () => {
  const body = replyContent.value.trim()
  if (!body || sendingReply.value) return
  if (isFrozen.value) {
    showFeedback(t('thread.frozen_reason'), 'warning')
    return
  }
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
    logger.error(`Failed to send thread reply: ${err}`)
    showFeedback(t('thread.send_failed'), 'error')
  } finally {
    sendingReply.value = false
  }
}

const loadThreadState = async () => {
  if (!props.roomId || !props.threadId) return
  try {
    const detail = await matrixThreadService.getRoomThreadViaApi(props.roomId, props.threadId, false)
    if (!detail) return
    isFrozen.value = detail.summary?.is_frozen ?? false
    isMuted.value = detail.user_subscription?.is_muted ?? false
  } catch (err) {
    logger.error(`Failed to load thread state: ${err}`)
    showFeedback(t('common.load_failed'), 'error')
  }
}

const handleToggleFreeze = async () => {
  if (!props.roomId || !props.threadId || pendingAction.value) return
  pendingAction.value = 'freeze'
  try {
    if (isFrozen.value) {
      await matrixThreadService.unfreezeThreadViaApi(props.roomId, props.threadId)
      isFrozen.value = false
      showFeedback(t('thread.unfreeze_success'), 'success')
    } else {
      await matrixThreadService.freezeThreadViaApi(props.roomId, props.threadId)
      isFrozen.value = true
      showFeedback(t('thread.freeze_success'), 'success')
    }
  } catch (err) {
    logger.error(`Failed to toggle thread freeze: ${err}`)
    showFeedback(t('thread.action_failed'), 'error')
  } finally {
    pendingAction.value = null
  }
}

const handleToggleMute = async () => {
  if (!props.roomId || !props.threadId || pendingAction.value) return
  pendingAction.value = 'mute'
  try {
    const subscription = isMuted.value
      ? await matrixThreadService.subscribeToThreadViaApi(props.roomId, props.threadId)
      : await matrixThreadService.muteThreadViaApi(props.roomId, props.threadId)
    if (!subscription) {
      showFeedback(t('thread.action_failed'), 'error')
      return
    }
    isMuted.value = subscription.isMuted
    showFeedback(t(isMuted.value ? 'thread.mute_success' : 'thread.unmute_success'), 'success')
  } catch (err) {
    logger.error(`Failed to toggle thread mute: ${err}`)
    showFeedback(t('thread.action_failed'), 'error')
  } finally {
    pendingAction.value = null
  }
}

const loadThreadStats = async () => {
  if (!props.roomId || !props.threadId) return
  threadStats.value = await matrixThreadService.getThreadStatsViaApi(props.roomId, props.threadId)
}

const handleDeleteThread = async () => {
  if (!props.roomId || !props.threadId || deleting.value) return
  deleting.value = true
  try {
    await matrixThreadService.deleteRoomThreadViaApi(props.roomId, props.threadId)
    showFeedback(t('thread.delete_success'), 'success')
    visible.value = false
  } catch (err) {
    logger.error(`Failed to delete thread: ${err}`)
    showFeedback(t('thread.delete_failed'), 'error')
  } finally {
    deleting.value = false
  }
}

const handleRedactReply = async (reply: ThreadMessage) => {
  if (!props.roomId || redactingId.value) return
  redactingId.value = reply.id
  try {
    await matrixThreadService.redactThreadReplyViaApi(props.roomId, reply.id)
    showFeedback(t('thread.redact_success'), 'success')
    await loadThreadReplies()
  } catch (err) {
    logger.error(`Failed to redact thread reply: ${err}`)
    showFeedback(t('thread.action_failed'), 'error')
  } finally {
    redactingId.value = null
  }
}

watch(visible, (val) => {
  if (val && props.threadId) {
    loadThreadState()
    loadThreadStats()
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
    const last = threadReplies.value[threadReplies.value.length - 1]
    if (last) {
      await matrixThreadService.markThreadReadViaApi(props.roomId, props.threadId, last.id, last.timestamp)
    }
  } catch (err) {
    logger.error(`Failed to load thread replies: ${err}`)
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

.thread-header {
  width: 100%;

  .thread-header-spacer {
    flex: 1;
  }
}

.frozen-hint {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--tjg-text-tertiary);
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

  .reply-meta {
    width: 100%;
  }

  .reply-meta-spacer {
    flex: 1;
  }

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
