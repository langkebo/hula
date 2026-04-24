<template>
  <div class="thread-view">
    <!-- 线程头部 -->
    <div class="thread-header">
      <div class="thread-title">
        <n-icon size="20" class="thread-icon">
          <Icon icon="mdi:message-reply-text" />
        </n-icon>
        <span>{{ t('thread.title') }}</span>
        <n-tag size="small" type="info">{{ thread?.replyCount || 0 }}</n-tag>
      </div>
      <n-button text @click="handleClose">
        <template #icon>
          <n-icon><Icon icon="mdi:close" /></n-icon>
        </template>
      </n-button>
    </div>

    <!-- 根消息 -->
    <div v-if="rootMessage" class="root-message">
      <div class="message-header">
        <n-avatar :src="rootMessage.avatarUrl" :size="32" round />
        <div class="message-info">
          <span class="sender-name">{{ rootMessage.senderName }}</span>
          <span class="timestamp">{{ formatTime(rootMessage.timestamp) }}</span>
        </div>
      </div>
      <div class="message-content" v-html="rootMessage.content"></div>
    </div>

    <n-divider />

    <!-- 线程回复列表 -->
    <n-scrollbar class="thread-messages">
      <n-spin :show="loading">
        <div v-if="messages.length === 0" class="empty-state">
          <n-empty :description="t('thread.no_replies')" />
        </div>
        <div v-else class="message-list">
          <div v-for="msg in messages" :key="msg.eventId" class="thread-message">
            <n-avatar :src="msg.avatarUrl" :size="28" round />
            <div class="message-body">
              <div class="message-header">
                <span class="sender-name">{{ msg.senderName }}</span>
                <span class="timestamp">{{ formatTime(msg.timestamp) }}</span>
              </div>
              <div class="message-content" v-html="msg.content"></div>
            </div>
          </div>
        </div>
      </n-spin>
    </n-scrollbar>

    <!-- 回复输入框 -->
    <div class="thread-reply">
      <n-input
        v-model:value="replyText"
        type="textarea"
        :placeholder="t('thread.reply_placeholder')"
        :autosize="{ minRows: 2, maxRows: 4 }"
        @keydown.enter.ctrl="handleSendReply" />
      <div class="reply-actions">
        <n-button type="primary" :loading="sending" @click="handleSendReply">
          {{ t('thread.send') }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { matrixThreadService } from '@/services/matrix/messaging/MatrixThreadService'
import type { Thread, ThreadDisplayMessage } from '@/services/matrix/messaging/MatrixThreadService'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ThreadView')
const { t } = useI18n()

const props = defineProps<{
  roomId: string
  threadRootId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const loading = ref(false)
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
  loading.value = true
  try {
    const viewData = matrixThreadService.getThreadViewData(props.roomId, props.threadRootId)
    thread.value = viewData.thread
    rootMessage.value = viewData.rootMessage
    messages.value = viewData.replies
  } catch (error) {
    logger.error('[ThreadView] 加载线程失败:', error)
  } finally {
    loading.value = false
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
    await loadThread()
  } catch (error) {
    logger.error('[ThreadView] 发送回复失败:', error)
  } finally {
    sending.value = false
  }
}

const handleClose = () => {
  emit('close')
}

onMounted(() => {
  loadThread()
})

watch(
  () => props.threadRootId,
  () => {
    loadThread()
  }
)
</script>

<style scoped lang="scss">
.thread-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-color);
}

.thread-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--line-color);

  .thread-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 500;

    .thread-icon {
      color: var(--primary-color);
    }
  }
}

.root-message {
  padding: 16px;
  background: var(--bg-secondary);

  .message-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .message-info {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .sender-name {
        font-weight: 500;
        font-size: 14px;
      }

      .timestamp {
        font-size: 12px;
        color: var(--text-color-secondary);
      }
    }
  }

  .message-content {
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-color);
  }
}

.thread-messages {
  flex: 1;
  padding: 16px;

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
  }

  .message-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .thread-message {
    display: flex;
    gap: 8px;

    .message-body {
      flex: 1;

      .message-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;

        .sender-name {
          font-weight: 500;
          font-size: 13px;
        }

        .timestamp {
          font-size: 11px;
          color: var(--text-color-secondary);
        }
      }

      .message-content {
        font-size: 14px;
        line-height: 1.5;
        color: var(--text-color);
      }
    }
  }
}

.thread-reply {
  padding: 16px;
  border-top: 1px solid var(--line-color);

  .reply-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }
}
</style>
