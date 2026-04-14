<template>
  <van-popup v-model:show="visible" position="right" :style="{ width: '100%', height: '100%' }" class="mobile-thread-popup">
    <div class="mobile-thread-panel">
      <van-nav-bar
        :title="t('thread.title')"
        left-arrow
        fixed
        placeholder
        @click-left="visible = false">
        <template #right>
          <van-icon name="close" size="20" @click="visible = false" />
        </template>
      </van-nav-bar>

      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <div class="thread-content">
          <div v-if="originalMessage" class="original-message">
            <div class="message-header">
              <van-avatar round size="32" :src="originalMessage.senderAvatar" />
              <div class="message-meta">
                <span class="sender-name">{{ originalMessage.senderName }}</span>
                <span class="message-time">{{ formatTime(originalMessage.timestamp) }}</span>
              </div>
            </div>
            <div class="message-body">
              {{ originalMessage.content }}
            </div>
          </div>

          <van-divider />

          <div class="thread-replies">
            <van-flex align="center" :size="8" class="mb-12px">
              <span class="text-14px font-medium">{{ t('thread.replies') }}</span>
              <van-tag type="primary">{{ threadReplies.length }}</van-tag>
              <van-button
                v-if="!isSubscribed"
                size="small"
                type="primary"
                plain
                @click="handleSubscribe">
                {{ t('thread.subscribe') }}
              </van-button>
              <van-button
                v-if="isSubscribed && !isMuted"
                size="small"
                type="warning"
                plain
                @click="handleMute">
                {{ t('thread.mute') }}
              </van-button>
            </van-flex>

            <van-loading v-if="loading" size="24px" class="loading-container" />

            <van-empty v-else-if="threadReplies.length === 0" :description="t('thread.no_replies')" />

            <div v-else class="reply-list">
              <div v-for="reply in threadReplies" :key="reply.event_id" class="reply-item">
                <van-flex :size="12">
                  <van-avatar round size="28" :src="getAvatarUrl(reply.sender)" />
                  <van-flex vertical :size="4" class="flex-1">
                    <van-flex align="center" :size="8">
                      <span class="sender-name">{{ getDisplayName(reply.sender) }}</span>
                      <span class="message-time">{{ formatTime(reply.timestamp) }}</span>
                    </van-flex>
                    <div class="reply-content">{{ reply.content }}</div>
                  </van-flex>
                </van-flex>
              </div>
            </div>
          </div>
        </div>
      </van-pull-refresh>

      <div class="thread-footer">
        <van-field
          v-model="replyContent"
          type="textarea"
          :placeholder="t('thread.reply_placeholder')"
          rows="1"
          autosize
          show-word-limit
          @keydown.enter="handleSendReply">
          <template #button>
            <van-button
              size="small"
              type="primary"
              :disabled="!replyContent.trim() || sending"
              :loading="sending"
              @click="handleSendReply">
              {{ t('common.send') }}
            </van-button>
          </template>
        </van-field>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { showToast } from 'vant'
import { useI18n } from 'vue-i18n'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { useUserStore } from '@/stores/user'
import dayjs from 'dayjs'
import matrixThreadService, { type ThreadReply } from '@/services/matrix/MatrixThreadService'
import { matrixMessageService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileThreadPanel')
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

const props = defineProps<{
  originalMessage?: ThreadMessage
  threadId?: string
  roomId?: string
}>()

const emit = defineEmits<{
  (e: 'sendReply', content: string): void
  (e: 'replySent', event: any): void
  (e: 'update:show', value: boolean): void
}>()

const replyContent = ref('')
const threadReplies = ref<ThreadReply[]>([])
const loading = ref(false)
const refreshing = ref(false)
const sending = ref(false)
const isSubscribed = ref(false)
const isMuted = ref(false)

const visible = computed({
  get: () => props.threadId !== undefined && props.threadId !== '',
  set: (val) => {
    if (!val) {
      emit('update:show', false)
    }
  }
})

const formatTime = (timestamp?: number) => {
  if (!timestamp) return ''
  return dayjs(timestamp).format('MM-DD HH:mm')
}

const getAvatarUrl = (userId: string): string | undefined => {
  const user = userStore.getUserById(userId)
  return user?.avatarUrl ?? AvatarUtils.getAvatarUrl(userId)
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

const onRefresh = async () => {
  await loadThreadReplies()
  refreshing.value = false
}

const handleSubscribe = async () => {
  if (!props.roomId || !props.threadId) return

  try {
    const success = await matrixThreadService.subscribeToThread(props.roomId, props.threadId)
    if (success) {
      isSubscribed.value = true
      window.$message?.success(t('thread.subscribe_success'))
    }
  } catch (err) {
    logger.error('订阅线程失败:', err)
  }
}

const handleMute = async () => {
  if (!props.roomId || !props.threadId) return

  try {
    const success = await matrixThreadService.muteThread(props.roomId, props.threadId)
    if (success) {
      isMuted.value = true
      window.$message?.success(t('thread.mute_success'))
    }
  } catch (err) {
    logger.error('静音线程失败:', err)
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

watch(
  () => props.threadId,
  (val) => {
    if (val && val !== '') {
      loadThreadReplies()
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.mobile-thread-popup {
  background: var(--van-background-2);
}

.mobile-thread-panel {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--van-background-2);
}

.thread-content {
  flex: 1;
  padding: 16px;
  padding-bottom: 60px;
  overflow-y: auto;
}

.original-message {
  padding: 12px;
  background: var(--van-card-background);
  border-radius: 8px;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.message-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sender-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--van-text-color);
}

.message-time {
  font-size: 12px;
  color: var(--van-text-color-3);
}

.message-body {
  font-size: 14px;
  color: var(--van-text-color);
  line-height: 1.5;
}

.thread-replies {
  margin-top: 8px;
}

.reply-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reply-item {
  padding: 8px 0;
}

.reply-content {
  font-size: 14px;
  color: var(--van-text-color);
  line-height: 1.5;
  word-break: break-word;
}

.thread-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--van-background);
  padding: 8px 16px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--van-divider-border-color);
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}

.mb-12px {
  margin-bottom: 12px;
}

.text-14px {
  font-size: 14px;
}

.font-medium {
  font-weight: 500;
}

.flex-1 {
  flex: 1;
  min-width: 0;
}
</style>
