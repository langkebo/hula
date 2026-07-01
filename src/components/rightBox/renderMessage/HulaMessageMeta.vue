<template>
  <div class="hula-message-meta" :class="{ 'is-me': isMe }">
    <div class="meta-row">
      <div v-if="!isMe && senderPresence" class="presence-indicator" :title="senderPresenceText">
        <div class="presence-dot" :class="senderPresence" />
      </div>

      <span class="timestamp">{{ formattedTime }}</span>

      <span v-if="isSending" class="status-pill status-pill--sending">
        <span class="status-dot status-dot--sending" />
      </span>

      <button v-else-if="showRetry" type="button" class="retry-button" @click="emit('retry')">
        {{ t('message_container.retry') }}
      </button>

      <div v-if="receipts.length" class="receipts-preview">
        <n-tooltip trigger="hover">
          <template #trigger>
            <div class="receipts-count">
              <svg class="size-12px"><use href="#success"></use></svg>
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTyping } from '@/composables/chat/useTyping'
import { MessageStatusEnum } from '@/enums'
import { matrixClientService } from '@/services/matrix'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { matrixReceiptService } from '@/services/matrix/messaging/MatrixReceiptService'
import { formatTimestamp } from '@/utils/ComputedTime'

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
  status?: MessageStatusEnum
  isLastMessage?: boolean
}>()
const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()

const formattedTime = computed(() => formatTimestamp(props.timestamp, true))

const isSending = computed(
  () => props.isMe && (props.status === MessageStatusEnum.PENDING || props.status === MessageStatusEnum.SENDING)
)
const showRetry = computed(() => props.isMe && props.status === MessageStatusEnum.FAILED)
const resolvedMessageId = computed(() => matrixMessageService.resolveEventId(props.messageId))

const receipts = computed<ReceiptInfo[]>(() => {
  if (!props.isMe || isSending.value || showRetry.value) return []
  if (matrixMessageService.isLocalEventId(resolvedMessageId.value)) return []

  const myUserId = matrixClientService.getUserId()

  return matrixReceiptService
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
  return (user as unknown as { presence?: string })?.presence
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
.hula-message-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--hula-text-tertiary);
  user-select: none;

  &.is-me {
    align-items: flex-end;
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
  background: var(--hula-text-disabled);

  &.online {
    background: var(--hula-color-success-500);
  }
  &.unavailable {
    background: var(--hula-color-warning-500);
  }
  &.offline {
    background: var(--hula-text-disabled);
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
  color: var(--hula-color-primary-500);
  animation: status-pulse 1.2s ease-in-out infinite;
}

.retry-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--hula-color-danger-500);
  font-size: 11px;
  line-height: 1.2;
  cursor: pointer;
}

.retry-button:hover {
  color: var(--hula-color-danger-600, var(--hula-color-danger-500));
}

.receipts-count {
  display: flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  &:hover {
    color: var(--hula-color-primary-500);
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
  color: var(--hula-color-primary-500);
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
      animation-delay: 0.2s;
    }
    &:nth-child(3) {
      animation-delay: 0.4s;
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
