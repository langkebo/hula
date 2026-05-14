<template>
  <div class="hula-message-meta" :class="{ 'is-me': isMe }">
    <div class="meta-row">
      <!-- 在线状态 -->
      <div v-if="!isMe && senderPresence" class="presence-indicator" :title="senderPresenceText">
        <div class="presence-dot" :class="senderPresence" />
      </div>

      <!-- 时间戳 -->
      <span class="timestamp">{{ formattedTime }}</span>

      <!-- 已读回执 (简易版) -->
      <div v-if="isMe && receipts.length" class="receipts-preview">
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

    <!-- 输入中指示器 (仅针对房间级别，但可显示在最新消息旁) -->
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
import { matrixClientService } from '@/services/matrix'
import { matrixTypingService } from '@/services/matrix/messaging/MatrixTypingService'
import type { MatrixEvent } from '@/services/matrix/sdk'
import { formatTimestamp } from '@/utils/ComputedTime'

interface ReceiptInfo {
  userId: string
  displayName: string
  avatarUrl: string
}

interface MatrixReceipt {
  userId: string
  data: {
    ts: number
    threadId?: string
  }
}

const props = defineProps<{
  messageId: string
  roomId: string
  senderId: string
  timestamp: number
  isMe: boolean
  isLastMessage?: boolean
}>()

const { t } = useI18n()

const formattedTime = computed(() => formatTimestamp(props.timestamp, true))

// 获取已读回执
const receipts = computed<ReceiptInfo[]>(() => {
  const room = matrixClientService.getClient()?.getRoom(props.roomId)
  if (!room) return []

  const eventReceipts = (
    room as unknown as { getReceiptsForEvent: (e: unknown) => MatrixReceipt[] }
  ).getReceiptsForEvent({
    getType() {
      return 'm.read'
    }
  } as unknown as MatrixEvent)

  return eventReceipts.map((r: MatrixReceipt) => ({
    userId: r.userId,
    displayName: room.getMember(r.userId)?.name || r.userId,
    avatarUrl: room.getMember(r.userId)?.getMxcAvatarUrl() || ''
  }))
})

// 获取发送者在线状态
const senderPresence = computed(() => {
  const user = matrixClientService.getClient()?.getUser(props.senderId)
  return (user as unknown as { presence?: string })?.presence
})

const senderPresenceText = computed(() => {
  if (!senderPresence.value) return ''
  return t(`auth.onlineStatus.states.${senderPresence.value}`)
})

// 获取正在输入的用户
const typingUsers = computed<string[]>(() => {
  return matrixTypingService.getTypingUsers(props.roomId).map((user) => user.userId)
})

const typingText = computed(() => {
  if (!typingUsers.value.length) return ''
  if (typingUsers.value.length === 1) {
    const name =
      matrixClientService.getClient()?.getRoom(props.roomId)?.getMember(typingUsers.value[0])?.name ||
      typingUsers.value[0]
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
