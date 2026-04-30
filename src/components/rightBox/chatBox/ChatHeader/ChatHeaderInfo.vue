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
    background-color: color-mix(in srgb, var(--hula-text-primary) 5%, transparent);
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
  color: var(--hula-text-primary);
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
  color: var(--hula-text-tertiary);
}

.status {
  display: flex;
  align-items: center;
  gap: 4px;

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
</style>
