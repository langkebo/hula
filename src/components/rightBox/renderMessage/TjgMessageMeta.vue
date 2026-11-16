<template>
  <div class="tjg-message-meta" :class="{ 'is-me': isMe, 'is-compact': compact }">
    <!-- 移动端紧凑模式只保留发送状态/重试，时间由消息列表的时间分割承担 -->
    <div class="meta-row" v-if="!compact || isSending || showRetry || isEdited">
      <div v-if="!compact && !isMe && senderPresence" class="presence-indicator" :title="senderPresenceText">
        <div class="presence-dot" :class="senderPresence" />
      </div>

      <span v-if="!compact" class="timestamp">{{ formattedTime }}</span>

      <!-- 已编辑：唯一的编辑历史入口（内容已被 SDK 按最新 `m.replace` 替换，不再另存一份） -->
      <button
        v-if="isEdited"
        type="button"
        class="edited-pill"
        :aria-label="t('message_container.edit_history.aria_open')"
        @click="showEditHistory = true">
        {{ t('message_container.edited') }}
      </button>

      <span v-if="isSending" class="status-pill status-pill--sending">
        <span class="status-dot status-dot--sending" />
      </span>

      <button v-else-if="showRetry" type="button" class="retry-button" @click="emit('retry')">
        {{ t('message_container.retry') }}
      </button>

      <div v-if="!compact && receipts.length" class="receipts-preview">
        <n-tooltip trigger="hover">
          <template #trigger>
            <div class="receipts-count">
              <svg class="size-12px" aria-hidden="true"><use href="#success"></use></svg>
              <span>{{ receipts.length }}</span>
            </div>
          </template>
          <div class="receipts-list">
            <div v-for="receipt in receipts" :key="receipt.userId" class="receipt-item">
              <n-avatar round :size="16" :src="receipt.avatarUrl" />
              <span>{{ receipt.displayName }}</span>
            </div>
          </div>
        </n-tooltip>
      </div>
    </div>

    <div v-if="isLastMessage && typingUsers.length" class="typing-indicator">
      <span class="typing-text">{{ typingText }}</span>
      <div class="typing-dots">
        <span />
        <span />
        <span />
      </div>
    </div>

    <MessageEditHistoryDialog v-model:show="showEditHistory" :room-id="roomId" :event-id="resolvedMessageId" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTyping } from '@/composables/chat/useTyping'
import { MessageStatusEnum } from '@/enums'
import { matrixClientService } from '@/services/matrix'
import { matrixMessageRelationService } from '@/services/matrix/messaging/MatrixMessageRelationService'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { matrixReadStateService } from '@/services/matrix/messaging/MatrixReadStateService'
import { formatChatTime } from '@/utils/ComputedTime'
import MessageEditHistoryDialog from './MessageEditHistoryDialog.vue'

interface ReceiptInfo {
  userId: string
  displayName: string
  avatarUrl: string
}

const props = defineProps<{
  messageId: string
  roomId: string
  senderId: string
  timestamp: number
  isMe: boolean
  status?: MessageStatusEnum | undefined
  isLastMessage?: boolean
  /** 移动端紧凑模式：隐藏时间、在线状态与已读数，仅保留发送中/失败重试 */
  compact?: boolean
}>()
const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()

const formattedTime = computed(() => formatChatTime(props.timestamp))

const isSending = computed(
  () => props.isMe && (props.status === MessageStatusEnum.PENDING || props.status === MessageStatusEnum.SENDING)
)
const showRetry = computed(() => props.isMe && props.status === MessageStatusEnum.FAILED)
const resolvedMessageId = computed(() => matrixMessageService.resolveEventId(props.messageId))

/**
 * 这条消息是否被编辑过。
 *
 * 判据读 SDK 事件上的 `m.new_content`（`isEdited`），不读正文 —— 正文已被 SDK 替换成最新版本，
 * 「有没有历史」这个信息只存在于关系事件里。
 * 本地未上屏的消息（临时 id）不可能有编辑历史，直接返回 false，避免白跑一次 `/relations`。
 */
const isEdited = computed(() => {
  if (!props.roomId || !resolvedMessageId.value) return false
  if (matrixMessageService.isLocalEventId(resolvedMessageId.value)) return false
  const event = matrixClientService.getRoom(props.roomId)?.findEventById(resolvedMessageId.value)
  return event ? matrixMessageRelationService.isEdited(event) : false
})

const showEditHistory = ref(false)

const receipts = computed<ReceiptInfo[]>(() => {
  if (!props.isMe || isSending.value || showRetry.value) return []
  if (matrixMessageService.isLocalEventId(resolvedMessageId.value)) return []

  const myUserId = matrixClientService.getUserId()

  return matrixReadStateService
    .getReadReceipts(props.roomId, resolvedMessageId.value)
    .filter((receipt) => receipt.userId !== myUserId)
    .map((receipt) => ({
      userId: receipt.userId,
      displayName: receipt.displayName || receipt.userId,
      avatarUrl: receipt.avatarUrl ?? ''
    }))
})

const senderPresence = computed(() => {
  const user = matrixClientService.getUser(props.senderId)
  return (user as { presence?: string })?.presence
})

const senderPresenceText = computed(() => {
  if (!senderPresence.value) return ''
  return t(`auth.onlineStatus.states.${senderPresence.value}`)
})

const { getTypingUsers } = useTyping()

const typingUsers = computed<string[]>(() => {
  const myUserId = matrixClientService.getUserId()
  return getTypingUsers(props.roomId)
    .map((user) => user.userId)
    .filter((userId) => userId && userId !== myUserId)
})

const typingText = computed(() => {
  if (!typingUsers.value.length) return ''
  if (typingUsers.value.length === 1) {
    const name =
      matrixClientService.getRoom(props.roomId)?.getMember(typingUsers.value[0])?.name || typingUsers.value[0]
    return t('home.chat_main.typing.single', { name })
  }
  return t('home.chat_main.typing.multiple', { count: typingUsers.value.length })
})
</script>

<style scoped lang="scss">
.tjg-message-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--tjg-text-tertiary);
  user-select: none;

  &.is-me {
    align-items: flex-end;
  }

  &.is-compact {
    margin-top: 2px;
  }
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.presence-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tjg-text-disabled);

  &.online {
    background: var(--tjg-color-success-500);
  }
  &.unavailable {
    background: var(--tjg-color-warning-500);
  }
  &.offline {
    background: var(--tjg-text-disabled);
  }
}

.status-pill {
  display: inline-flex;
  align-items: center;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}

.status-dot--sending {
  color: var(--tjg-color-primary-500);
  animation: status-pulse 1.2s ease-in-out infinite;
}

.retry-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--tjg-color-danger-600);
  font-size: 11px;
  line-height: 1.2;
  cursor: pointer;
}

.edited-pill {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--tjg-text-tertiary);
  font-size: 11px;
  line-height: 1.2;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: var(--tjg-color-primary-600);
    text-decoration: underline;
  }
}

.retry-button:hover {
  color: var(--tjg-color-danger-600, var(--tjg-color-danger-500));
}

.receipts-count {
  display: flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  &:hover {
    color: var(--tjg-color-primary-500);
  }
}

.receipts-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
  padding: 4px;
}

.receipt-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--tjg-color-primary-600);
}

.typing-dots {
  display: flex;
  gap: 2px;
  span {
    width: 3px;
    height: 3px;
    background: currentColor;
    border-radius: 50%;
    animation: typing-animation 1.4s infinite;
    &:nth-child(2) {
      animation-delay: var(--tjg-motion-duration-normal);
    }
    &:nth-child(3) {
      animation-delay: var(--tjg-motion-duration-xslow);
    }
  }
}

@keyframes status-pulse {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes typing-animation {
  0%,
  60%,
  100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-3px);
  }
}
</style>
