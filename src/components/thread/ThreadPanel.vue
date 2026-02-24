<template>
  <div v-if="visible" class="thread-panel">
    <div class="thread-header">
      <div class="header-left">
        <span class="thread-title">{{ t('thread.title') }}</span>
        <span v-if="replyCount > 0" class="reply-count">{{ replyCount }} {{ t('thread.replies') }}</span>
      </div>
      <n-button text @click="$emit('close')">
        <template #icon>
          <svg class="size-18px">
            <use href="#close"></use>
          </svg>
        </template>
      </n-button>
    </div>

    <div class="thread-content">
      <n-scrollbar ref="scrollbarRef">
        <div class="root-message" v-if="rootMessage">
          <RenderMessage
            :message="rootMessage"
            :is-group="isGroup"
            :from-user="rootMessage.fromUser" />
        </div>

        <div class="thread-replies">
          <div
            v-for="reply in replies"
            :key="reply.eventId"
            class="reply-item">
            <div class="reply-message">
              <n-avatar
                round
                :size="28"
                :src="getAvatarUrl(reply.sender)" />
              <div class="reply-content">
                <span class="reply-sender">{{ reply.sender }}</span>
                <span class="reply-text">{{ reply.content?.body }}</span>
              </div>
            </div>
          </div>
        </div>
      </n-scrollbar>
    </div>

    <div class="thread-composer">
      <ReplyComposer v-if="replyTo" :reply-to="replyTo" @cancel="replyTo = null" />
      <MsgInput
        ref="msgInputRef"
        :placeholder="t('thread.reply_placeholder')"
        @send="handleSend" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { matrixThreadService, type ThreadMessage } from '@/services/matrix'
import type { MessageType } from '@/services/types'
import ReplyComposer from '@/components/rightBox/ReplyComposer.vue'
import MsgInput from '@/components/rightBox/MsgInput.vue'
import { AvatarUtils } from '@/utils/AvatarUtils'

const props = defineProps<{
  visible: boolean
  roomId: string
  rootEventId: string
  rootMessage?: MessageType | null
  isGroup: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'reply-sent', eventId: string): void
}>()

const { t } = useI18n()
const scrollbarRef = ref()
const msgInputRef = ref()
const replies = ref<ThreadMessage[]>([])
const replyCount = ref(0)
const replyTo = ref(null)
const loading = ref(false)

const getAvatarUrl = (userId: string) => {
  return AvatarUtils.getAvatarUrl(userId)
}

const loadReplies = async () => {
  if (!props.roomId || !props.rootEventId) return

  loading.value = true
  try {
    const threadInfo = await matrixThreadService.getThread(props.roomId, props.rootEventId)
    if (threadInfo) {
      replyCount.value = threadInfo.replyCount
    }
    replies.value = await matrixThreadService.getThreadMessages(props.roomId, props.rootEventId)
    scrollToBottom()
  } catch (error) {
    console.error('[ThreadPanel] 加载线程回复失败:', error)
  } finally {
    loading.value = false
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    scrollbarRef.value?.scrollTo({ top: 999999, behavior: 'smooth' })
  })
}

const handleSend = async (content: any) => {
  try {
    const eventId = await matrixThreadService.sendThreadReply(props.roomId, props.rootEventId, {
      body: content.text || content.body,
      html: content.html
    })
    emit('reply-sent', eventId)
    await loadReplies()
  } catch (error) {
    console.error('[ThreadPanel] 发送回复失败:', error)
    window.$message?.error(t('thread.send_failed'))
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      loadReplies()
    }
  }
)

watch(
  () => props.rootEventId,
  () => {
    if (props.visible) {
      loadReplies()
    }
  }
)
</script>

<style scoped lang="scss">
.thread-panel {
  @apply flex flex-col h-full bg-[--bg-color] border-l-1px border-solid border-[--border-color];
  width: 360px;
}

.thread-header {
  @apply flex items-center justify-between p-12px border-b-1px border-solid border-[--border-color];
}

.header-left {
  @apply flex items-center gap-8px;
}

.thread-title {
  @apply text-14px font-medium;
}

.reply-count {
  @apply text-12px color-#909090;
}

.thread-content {
  @apply flex-1 overflow-hidden;
}

.root-message {
  @apply p-12px border-b-1px border-solid border-[--border-color] bg-[--right-chat-reply-color];
}

.thread-replies {
  @apply flex flex-col gap-8px p-12px;
}

.reply-item {
  @apply py-4px;
}

.thread-composer {
  @apply border-t-1px border-solid border-[--border-color] p-8px;
}
</style>
