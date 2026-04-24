<template>
  <div class="mobile-thread-view">
    <!-- 导航栏 -->
    <van-nav-bar
      :title="t('thread.title')"
      left-arrow
      @click-left="handleBack">
      <template #right>
        <span class="reply-count">{{ thread?.replyCount || 0 }} {{ t('thread.replies') }}</span>
      </template>
    </van-nav-bar>

    <!-- 根消息 -->
    <div v-if="rootMessage" class="root-message">
      <div class="message-header">
        <van-image
          :src="rootMessage.avatarUrl"
          round
          width="40"
          height="40"
          fit="cover" />
        <div class="message-info">
          <div class="sender-name">{{ rootMessage.senderName }}</div>
          <div class="timestamp">{{ formatTime(rootMessage.timestamp) }}</div>
        </div>
      </div>
      <div class="message-content">{{ rootMessage.content }}</div>
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
            <van-image
              :src="msg.avatarUrl"
              round
              width="32"
              height="32"
              fit="cover" />
            <div class="message-body">
              <div class="message-header">
                <span class="sender-name">{{ msg.senderName }}</span>
                <span class="timestamp">{{ formatTime(msg.timestamp) }}</span>
              </div>
              <div class="message-content">{{ msg.content }}</div>
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
      <van-button
        type="primary"
        size="small"
        :loading="sending"
        :disabled="!replyText.trim()"
        @click="handleSendReply">
        {{ t('thread.send') }}
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { matrixThreadService } from '@/services/matrix/messaging/MatrixThreadService'
import type { Thread, ThreadDisplayMessage } from '@/services/matrix/messaging/MatrixThreadService'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
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

const formatTime = (timestamp: number) => {
  return formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
    locale: zhCN
  })
}

const loadThread = async () => {
  try {
    const viewData = matrixThreadService.getThreadViewData(props.roomId, props.threadRootId)
    thread.value = viewData.thread
    rootMessage.value = viewData.rootMessage
  } catch (error) {
    logger.error('[MobileThreadView] 加载线程失败:', error)
    showToast(t('thread.load_failed'))
  }
}

const loadMessages = async () => {
  if (finished.value) return

  loading.value = true
  try {
    const viewData = matrixThreadService.getThreadViewData(props.roomId, props.threadRootId)
    messages.value = viewData.replies
    finished.value = true
  } catch (error) {
    logger.error('[MobileThreadView] 加载消息失败:', error)
    showToast(t('thread.load_failed'))
  } finally {
    loading.value = false
  }
}

const onRefresh = async () => {
  refreshing.value = true
  finished.value = false
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
    showToast(t('thread.send_success'))

    // 重新加载消息
    finished.value = false
    await loadMessages()
  } catch (error) {
    logger.error('[MobileThreadView] 发送回复失败:', error)
    showToast(t('thread.send_failed'))
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
  height: 100vh;
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
    border-radius: 20px;
    padding: 8px 16px;
  }

  .van-button {
    flex-shrink: 0;
    border-radius: 20px;
    padding: 0 20px;
    height: 36px;
  }
}
</style>
