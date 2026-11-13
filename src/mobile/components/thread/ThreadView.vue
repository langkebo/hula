<template>
  <div class="mobile-thread-view">
    <!-- 导航栏 -->
    <van-nav-bar :title="t('thread.title')" left-arrow @click-left="handleBack">
      <template #right>
        <span class="reply-count">{{ thread?.replyCount || 0 }} {{ t('thread.replies') }}</span>
      </template>
    </van-nav-bar>

    <!-- 根消息 -->
    <div v-if="rootMessage" class="root-message">
      <div class="message-header">
        <van-image :src="rootMessage.avatarUrl ?? ''" round width="40" height="40" fit="cover" />
        <div class="message-info">
          <div class="sender-name">{{ rootMessage.senderName }}</div>
          <div class="timestamp">{{ formatTime(rootMessage.timestamp) }}</div>
        </div>
      </div>
      <div class="message-content">
        <van-image
          v-if="isImage(rootMessage)"
          :src="mediaUrl(rootMessage) ?? ''"
          fit="cover"
          class="message-image"
          @click="previewImage(rootMessage)" />
        <div v-else-if="isFile(rootMessage)" class="message-file">
          <van-icon name="description" size="20" />
          <span class="file-name">{{ rootMessage.content }}</span>
        </div>
        <span v-else class="message-text">{{ rootMessage.content }}</span>
      </div>
    </div>

    <van-divider />

    <!-- 线程回复列表 -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        :finished-text="t('common.no_more')"
        @load="loadMessages">
        <div v-if="messages.length === 0 && !loading" class="empty-state">
          <van-empty :description="t('thread.no_replies')" />
        </div>
        <div v-else class="message-list">
          <div v-for="msg in messages" :key="msg.eventId" class="thread-message">
            <van-image :src="msg.avatarUrl ?? ''" round width="32" height="32" fit="cover" />
            <div class="message-body">
              <div class="message-header">
                <span class="sender-name">{{ msg.senderName }}</span>
                <span class="timestamp">{{ formatTime(msg.timestamp) }}</span>
              </div>
              <div class="message-content">
                <van-image
                  v-if="isImage(msg)"
                  :src="mediaUrl(msg) ?? ''"
                  fit="cover"
                  class="message-image"
                  @click="previewImage(msg)" />
                <div v-else-if="isFile(msg)" class="message-file">
                  <van-icon name="description" size="20" />
                  <span class="file-name">{{ msg.content }}</span>
                </div>
                <span v-else class="message-text">{{ msg.content }}</span>
              </div>
            </div>
          </div>
        </div>
      </van-list>
    </van-pull-refresh>

    <!-- 回复输入框 -->
    <div class="thread-reply">
      <van-field
        v-model="replyText"
        type="textarea"
        :placeholder="t('thread.reply_placeholder')"
        :autosize="{ minHeight: 40, maxHeight: 100 }"
        rows="1" />
      <van-button type="primary" size="small" :loading="sending" :disabled="!replyText.trim()" @click="handleSendReply">
        {{ t('common.thread.send') }}
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { showImagePreview, showToast } from 'vant'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { Thread, ThreadDisplayMessage } from '@/services/matrix/messaging/MatrixThreadService'
import { matrixThreadService } from '@/services/matrix/messaging/MatrixThreadService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileThreadView')
const { t } = useI18n()
const router = useRouter()

const props = defineProps<{
  roomId: string
  threadRootId: string
}>()

const loading = ref(false)
const refreshing = ref(false)
const finished = ref(false)
const sending = ref(false)
const replyText = ref('')
const thread = ref<Thread | null>(null)
const rootMessage = ref<ThreadDisplayMessage | null>(null)
const messages = ref<ThreadDisplayMessage[]>([])

/** 每页窗口增量（synapse-rust getRoomThread 的 replyLimit 窗口） */
const PAGE_SIZE = 50
const pageLimit = ref(PAGE_SIZE)
const lastLoadedCount = ref(0)

const isImage = (msg: ThreadDisplayMessage) => msg.msgType === 'm.image' && !!msg.mxcUrl
const isFile = (msg: ThreadDisplayMessage) =>
  msg.msgType === 'm.file' || msg.msgType === 'm.audio' || msg.msgType === 'm.video'
const mediaUrl = (msg: ThreadDisplayMessage) => matrixThreadService.resolveMediaUrl(msg.mxcUrl, 320)
const previewImage = (msg: ThreadDisplayMessage) => {
  const url = mediaUrl(msg)
  if (url) showImagePreview([url])
}

const resetPagination = () => {
  pageLimit.value = PAGE_SIZE
  lastLoadedCount.value = 0
  finished.value = false
}

const formatTime = (timestamp: number) => {
  return dayjs(timestamp).fromNow()
}

const loadThread = async () => {
  try {
    const viewData = matrixThreadService.getThreadViewData(props.roomId, props.threadRootId)
    thread.value = viewData.thread
    rootMessage.value = viewData.rootMessage
  } catch (error) {
    logger.error('[MobileThreadView] Failed to load thread:', error)
    showToast(t('common.thread.load_failed'))
  }
}

const loadMessages = async () => {
  if (finished.value) return

  loading.value = true
  try {
    const { replies, total } = await matrixThreadService.loadThreadRepliesPage(
      props.roomId,
      props.threadRootId,
      pageLimit.value
    )
    messages.value = replies
    // 已取满，或窗口继续放大也拿不到更多（防止 van-list 无限触发 load）
    if (replies.length >= total || replies.length === lastLoadedCount.value) {
      finished.value = true
    } else {
      lastLoadedCount.value = replies.length
      pageLimit.value += PAGE_SIZE
    }
  } catch (error) {
    logger.error('[MobileThreadView] Failed to load messages:', error)
    finished.value = true
    showToast(t('common.thread.load_failed'))
  } finally {
    loading.value = false
  }
}

const onRefresh = async () => {
  refreshing.value = true
  resetPagination()
  try {
    await loadThread()
    await loadMessages()
  } finally {
    refreshing.value = false
  }
}

const handleSendReply = async () => {
  if (!replyText.value.trim()) return

  sending.value = true
  try {
    await matrixThreadService.sendThreadReply(props.roomId, props.threadRootId, {
      body: replyText.value
    })
    replyText.value = ''
    showToast(t('common.thread.send_success'))

    // 重新加载消息
    resetPagination()
    await loadMessages()
  } catch (error) {
    logger.error('[MobileThreadView] Failed to send reply:', error)
    showToast(t('common.thread.send_failed'))
  } finally {
    sending.value = false
  }
}

const handleBack = () => {
  router.back()
}

onMounted(() => {
  loadThread()
})
</script>

<style scoped lang="scss">
.mobile-thread-view {
  display: flex;
  flex-direction: column;
  /* 旧 WebView 不认 dvh ⇒ 先给 vh 兜底，再让 dvh 覆盖（跟随键盘/地址栏） */
  height: 100vh;
  height: 100dvh;
  background: var(--van-background-2);

  .reply-count {
    font-size: 14px;
    color: var(--van-text-color-2);
  }
}

.root-message {
  padding: 16px;
  background: var(--van-background);

  .message-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    .message-info {
      flex: 1;

      .sender-name {
        font-weight: 500;
        font-size: 15px;
        color: var(--van-text-color);
        margin-bottom: 4px;
      }

      .timestamp {
        font-size: 12px;
        color: var(--van-text-color-3);
      }
    }
  }

  .message-content {
    font-size: 14px;
    line-height: 1.6;
    color: var(--van-text-color);
  }
}

.message-list {
  padding: 12px 16px;

  .thread-message {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;

    .message-body {
      flex: 1;

      .message-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;

        .sender-name {
          font-weight: 500;
          font-size: 14px;
          color: var(--van-text-color);
        }

        .timestamp {
          font-size: 11px;
          color: var(--van-text-color-3);
        }
      }

      .message-content {
        font-size: 14px;
        line-height: 1.5;
        color: var(--van-text-color);
      }
    }
  }
}

.message-image {
  display: block;
  max-width: 200px;
  overflow: hidden;
  border-radius: var(--tjg-radius-lg);
}

.message-file {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--van-background-2);
  border-radius: var(--tjg-radius-lg);

  .file-name {
    font-size: 13px;
    color: var(--van-text-color-2);
    word-break: break-all;
  }
}

.message-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-state {
  padding: 60px 0;
}

.thread-reply {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 16px;
  background: var(--van-background);
  border-top: 1px solid var(--van-border-color);

  :deep(.van-field) {
    flex: 1;
    background: var(--van-background-2);
    border-radius: var(--tjg-radius-2xl);
    padding: 8px 16px;
  }

  .van-button {
    flex-shrink: 0;
    border-radius: var(--tjg-radius-2xl);
    padding: 0 20px;
    height: 36px;
  }
}
</style>
