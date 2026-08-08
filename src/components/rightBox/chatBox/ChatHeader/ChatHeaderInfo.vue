<template>
  <div class="chat-header-info" @click="handleClick">
    <TjgAvatar class="avatar" :src="avatar" :size="44" :name="name" round :style="avatarStyle" />

    <div class="info-content">
      <div class="name-row">
        <span class="name" :title="name">{{ name }}</span>
        <n-tag v-if="isBotUser" size="small" type="info" :bordered="false">BOT</n-tag>
        <n-tag v-if="isChannel" size="small" type="success" :bordered="false">
          {{ t('home.chat_header.channel') }}
        </n-tag>
        <span
          v-if="isFederated"
          class="federation-icon"
          :title="federationTitle"
          role="img"
          :aria-label="t('home.chat_header.federated')">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.93 6h-2.95a15.7 15.7 0 0 0-1.38-3.56A8 8 0 0 1 18.93 8ZM12 4.26c.83 1.2 1.48 2.53 1.91 3.94h-3.82c.43-1.41 1.08-2.74 1.91-3.94ZM4.26 14a7.96 7.96 0 0 1 0-4h3.38a16.6 16.6 0 0 0 0 4H4.26Zm.81 2h2.95c.33 1.27.8 2.47 1.38 3.56A8 8 0 0 1 5.07 16Zm2.95-8H5.07a8 8 0 0 1 4.33-3.56A15.7 15.7 0 0 0 8.02 8ZM12 19.74c-.83-1.2-1.48-2.53-1.91-3.94h3.82A13.5 13.5 0 0 1 12 19.74ZM14.34 14H9.66a14.8 14.8 0 0 1 0-4h4.68a14.8 14.8 0 0 1 0 4Zm.27 5.56c.58-1.09 1.05-2.29 1.38-3.56h2.95a8 8 0 0 1-4.33 3.56ZM16.36 14a16.6 16.6 0 0 0 0-4h3.38a7.96 7.96 0 0 1 0 4h-3.38Z" />
          </svg>
        </span>
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
  isFederated?: boolean
  federationServer?: string
}>()

const federationTitle = computed(() =>
  props.federationServer
    ? t('home.chat_header.federated_tooltip', { server: props.federationServer })
    : t('home.chat_header.federated')
)

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
  transition: background-color var(--tjg-motion-duration-normal);

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

.federation-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--tjg-text-tertiary);
  cursor: help;
  transition: color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    color: var(--tjg-text-secondary);
  }
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
