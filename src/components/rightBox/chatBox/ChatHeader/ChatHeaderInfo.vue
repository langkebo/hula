<template>
  <div class="chat-header-info" @click="handleClick">
    <n-avatar
      v-if="isChannel"
      class="avatar"
      :src="channelAvatar"
      :size="44"
      round
      :style="{ border: '2px solid var(--hula-color-primary-500)' }" />
    <n-avatar v-else-if="avatar" class="avatar" :src="avatar" :size="44" round :style="avatarStyle" />
    <n-avatar v-else class="avatar" :size="44" round :style="avatarStyle">
      {{ nameInitial }}
    </n-avatar>

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
import { NAvatar, NTag } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import EncryptionStatus from '@/components/encryption/EncryptionStatus.vue'
import { useTyping } from '@/composables/chat/useTyping'
import { RoomTypeEnum } from '@/enums'
import { IsAllUserEnum } from '@/services/types'
import { AvatarUtils } from '@/utils/AvatarUtils'

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

const nameInitial = computed(() => {
  return props.name?.charAt(0)?.toUpperCase() || '?'
})

const avatarStyle = computed(() => {
  if (isChannel.value) {
    return { border: '2px solid var(--hula-color-primary-500)' }
  }
  if (props.isOnline) {
    return { border: '2px solid var(--hula-color-success-500)' }
  }
  return { border: '2px solid var(--hula-border-strong)' }
})

const channelAvatar = computed(() => {
  return AvatarUtils.getAvatarUrl(props.avatar)
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
  gap: var(--hula-space-3);
  cursor: pointer;
  padding: var(--hula-space-1) var(--hula-space-2);
  border-radius: var(--hula-radius-sm);
  transition: background-color var(--hula-motion-duration-fast) var(--hula-motion-ease-standard);

  &:hover {
    background-color: var(--hula-surface-list-hover);
  }
}

.avatar {
  flex-shrink: 0;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-0);
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  gap: var(--hula-space-2);
}

.name {
  font-size: var(--hula-font-size-lg);
  font-weight: var(--hula-font-weight-medium);
  color: var(--hula-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--hula-space-2);
  flex-wrap: wrap;
}

.member-count,
.status {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-tertiary);
}

.status {
  display: flex;
  align-items: center;
  gap: var(--hula-space-1);

  &.online {
    color: var(--hula-color-success-500);
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
  gap: var(--hula-space-1);
  font-size: var(--hula-font-size-sm);
  color: var(--hula-color-primary-500);
}

.typing-dot {
  width: 4px;
  height: 4px;
  border-radius: var(--hula-radius-full);
  background: var(--hula-color-primary-500);
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
