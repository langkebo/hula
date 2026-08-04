<template>
  <div class="chat-header-info" @click="handleClick">
    <TjgAvatar
      class="avatar"
      :src="avatar"
      :size="44"
      :name="name"
      round
      :style="avatarStyle" />

    <div class="info-content">
      <div class="name-row">
        <span class="name" :title="name">{{ name }}</span>
        <n-tag v-if="isBotUser" size="small" type="info" :bordered="false">BOT</n-tag>
        <n-tag v-if="isChannel" size="small" type="success" :bordered="false">
          {{ t('home.chat_header.channel') }}
        </n-tag>
      </div>

      <div class="status-row">
        <template v-if="isGroup">
          <span class="member-count">
            {{ t('home.chat_header.member_count', { count: memberCount }) }}
          </span>
        </template>
        <template v-else-if="!isChannel">
          <span class="status" :class="{ online: isOnline }">
            <component :is="statusIcon" v-if="statusIcon" class="status-icon" />
            {{ statusTitle }}
          </span>
        </template>
        <span v-if="typingText" class="typing-indicator">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          {{ typingText }}
        </span>
        <EncryptionStatus
          v-if="encryptionStatus"
          :status="encryptionStatus"
          :show-tooltip="true"
          class="security-status" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NTag } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import TjgAvatar from '@/components/atomic/TjgAvatar.vue'
import EncryptionStatus from '@/components/encryption/EncryptionStatus.vue'
import { useTyping } from '@/composables/chat/useTyping'
import { RoomTypeEnum } from '@/enums'
import { IsAllUserEnum } from '@/services/types'

type RoomEncryptionStatus = 'encrypted' | 'unencrypted' | 'unknown' | 'error'

const props = defineProps<{
  name: string
  avatar: string
  type: RoomTypeEnum
  memberCount: number
  isOnline: boolean
  statusIcon: string | null
  statusTitle: string
  isBotUser: boolean
  hotFlag?: IsAllUserEnum
  encryptionStatus?: RoomEncryptionStatus | null
  roomId?: string
}>()

const { t } = useI18n()

const isGroup = computed(() => props.type === RoomTypeEnum.GROUP)
const isChannel = computed(() => props.hotFlag === IsAllUserEnum.Yes)

const avatarStyle = computed(() => {
  if (isChannel.value) {
    return { border: '2px solid var(--tjg-color-primary-500)' }
  }
  if (props.isOnline) {
    return { border: '2px solid var(--tjg-color-success-500)' }
  }
  return { border: '2px solid var(--tjg-border-strong)' }
})

const { getTypingUsersText } = useTyping()

const typingText = computed(() => {
  if (!props.roomId) return ''
  return getTypingUsersText(props.roomId, 2)
})

const emit = defineEmits<(e: 'click') => void>()

const handleClick = () => {
  emit('click')
}
</script>

<style scoped lang="scss">
.chat-header-info {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background-color 0.2s;

  &:hover {
    background-color: color-mix(in srgb, var(--tjg-text-primary) 5%, transparent);
  }
}

.avatar {
  flex-shrink: 0;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name {
  font-size: 16px;
  font-weight: 500;
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.member-count,
.status {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
}

.status {
  display: flex;
  align-items: center;
  gap: 4px;

  &.online {
    color: var(--tjg-color-success-500);
  }
}

.status-icon {
  width: 14px;
  height: 14px;
}

.security-status {
  min-width: 0;
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--tjg-color-primary-500);
}

.typing-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--tjg-color-primary-500);
  animation: typing-bounce 1.4s infinite ease-in-out both;
}

.typing-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing-bounce {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
