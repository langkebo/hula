<template>
  <div
    role="listitem"
    :aria-label="ariaLabel"
    class="hula-room-list-item"
    :class="itemClasses"
    @click="handleClick"
    @contextmenu="handleContextMenu">
    <n-flex align="center" :size="10">
      <n-badge :dot="isFavorite" color="#f0a020" :offset="[-4, 4]">
        <n-avatar
          :size="44"
          :src="AvatarUtils.getAvatarUrl(avatarSrc)"
          :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
          round />
      </n-badge>
      <n-flex vertical :size="2" class="flex-1 min-w-0">
        <n-flex align="center" justify="space-between" :gap="8">
          <span class="text-14px font-medium truncate flex-1">{{ displayName }}</span>
          <n-flex align="center" :size="4" shrink="0">
            <n-icon v-if="isEncrypted" size="14" class="text-[--hula-text-tertiary]">
              <svg><use href="#lock" /></svg>
            </n-icon>
            <n-icon v-if="isBurnAfterRead" size="14" class="text-[#ff6b35]">
              <svg><use href="#fire" /></svg>
            </n-icon>
            <span class="text-11px text-[--hula-text-tertiary] whitespace-nowrap">{{ timeText }}</span>
          </n-flex>
        </n-flex>
        <n-flex align="center" justify="space-between" :gap="8">
          <n-flex align="center" :gap="4" class="min-w-0 flex-1">
            <n-tag v-if="hasMention" size="tiny" round :bordered="false" type="error" class="shrink-0">
              {{ t('message.message_list.mention_tag') }}
            </n-tag>
            <n-tag v-if="hasFavoriteTag" size="tiny" round :bordered="false" class="shrink-0">
              {{ t('message.message_list.favorite_tag') }}
            </n-tag>
            <n-tag v-if="hasLowPriorityTag" size="tiny" round :bordered="false" class="shrink-0">
              {{ t('message.message_list.low_priority_tag') }}
            </n-tag>
            <span v-if="typingText" class="text-12px text-[#1ab292] truncate flex-1">{{ typingText }}</span>
            <span v-else-if="lastMessageText" class="text-12px text-[--hula-text-secondary] truncate flex-1">
              {{ lastMessageText }}
            </span>
            <span v-else class="text-12px text-[--hula-text-tertiary] truncate flex-1">--</span>
          </n-flex>
          <n-flex align="center" :gap="4" shrink="0">
            <n-tag
              v-if="(isMuted || isShielded) && !isBurnAfterRead"
              size="tiny"
              round
              :bordered="false"
              class="shrink-0">
              {{ t('home.plugins.room_detail.mute') }}
            </n-tag>
            <n-badge :value="badgeCount" :max="99" :show="badgeCount > 0" type="error" class="shrink-0" />
          </n-flex>
        </n-flex>
      </n-flex>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RoomTypeEnum, ThemeEnum } from '@/enums'
import { matrixTypingService } from '@/services/matrix/messaging/MatrixTypingService'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useSessionStore } from '@/stores/domains/chat/chat/session'
import { useRoomStore } from '@/stores/domains/chat/room'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'

const props = defineProps<{
  item: SessionItem & {
    lastMsg?: string
    lastMsgTime?: string
    isAtMe?: boolean
    highlightCount?: number
    notificationCount?: number
    isTombstoned?: boolean
    membership?: 'join' | 'leave' | 'invite' | 'ban'
    isEncrypted?: boolean
    isBurnAfterRead?: boolean
    memberCount?: number
  }
  classes?: Record<string, boolean>
  menu?: unknown[]
  'special-menu'?: unknown[]
  'batch-mode'?: boolean
  'batch-selected'?: boolean
}>()

const emit = defineEmits<{
  click: [item: SessionItem]
  dblclick: [item: SessionItem]
  select: [item: SessionItem, menu: unknown]
  'accept-invite': [item: SessionItem]
  'reject-invite': [item: SessionItem]
  'batch-toggle': [roomId: string]
  'menu-show': []
}>()

const { t } = useI18n()
const globalStore = useGlobalStore()
const roomStore = useRoomStore()
const sessionStore = useSessionStore()
const settingStore = useSettingStore()

const roomId = computed(() => props.item.roomId)
const displayName = computed(() => props.item.name)
const avatarSrc = computed(() => props.item.avatar ?? '')
const unreadCount = computed(() => props.item.unreadCount ?? 0)
const activeTime = computed(() => props.item.activeTime ?? 0)
const lastMessage = computed(() => props.item.lastMsg ?? props.item.text ?? '')
const isTop = computed(() => !!props.item.top)
const isMuted = computed(
  () => props.item.muteNotification === 1 || (props.item.muteNotification as number) === 2 || !!props.item.shield
)
const isShielded = computed(() => !!props.item.shield)
const roomTags = computed(() => roomStore.getTagsForRoom(roomId.value))
const hasFavoriteTag = computed(() => !!props.item.isFavorite || 'm.favourite' in roomTags.value)
const hasLowPriorityTag = computed(() => 'm.lowpriority' in roomTags.value)
const unreadDetail = computed(() => {
  if (!globalStore.unreadReady || !roomId.value) return null
  return sessionStore.getUnreadDetail(roomId.value)
})
const badgeCount = computed(() => unreadDetail.value?.total ?? props.item.notificationCount ?? unreadCount.value)
const hasMention = computed(() => (unreadDetail.value?.highlight ?? props.item.highlightCount ?? 0) > 0)
const isFavorite = computed(() => hasFavoriteTag.value)
const isDm = computed(() => props.item.type === RoomTypeEnum.SINGLE)
const isEncrypted = computed(() => props.item.isEncrypted ?? false)
const isBurnAfterRead = computed(() => props.item.isBurnAfterRead ?? false)

const timeText = computed(() => {
  if (!activeTime.value) return ''
  const date = new Date(activeTime.value)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) return t('home.plugins.room_detail.just_now')
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24 && date.toDateString() === now.toDateString()) return `${diffHours}h`
  if (new Date(now.getTime() - 86400000).toDateString() === date.toDateString())
    return t('home.plugins.room_detail.yesterday')
  if (date.getFullYear() === now.getFullYear()) {
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
  }
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
})

const lastMessageText = computed(() => {
  if (!lastMessage.value) return ''
  const maxLen = unreadCount.value > 0 ? 30 : 40
  return lastMessage.value.length > maxLen ? `${lastMessage.value.slice(0, maxLen)}...` : lastMessage.value
})

const typingText = computed(() => {
  if (!roomId.value) return ''
  return matrixTypingService.getTypingUsersText(roomId.value, 2)
})

const itemClasses = computed(() => ({
  'hula-room-list-item--selected': props.classes?.selected ?? false,
  'hula-room-list-item--top': isTop.value,
  'hula-room-list-item--dm': isDm.value,
  'hula-room-list-item--encrypted': isEncrypted.value,
  'hula-room-list-item--burn': isBurnAfterRead.value
}))

const ariaLabel = computed(() => {
  const parts: string[] = [displayName.value]
  if (lastMessageText.value) parts.push(lastMessageText.value)
  if (badgeCount.value > 0) parts.push(`${badgeCount.value}条未读`)
  return parts.join('，')
})

const handleClick = () => {
  emit('click', props.item)
}

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()
}
</script>

<style lang="scss" scoped>
.hula-room-list-item {
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  user-select: none;
  border-radius: 6px;
  margin: 2px 8px;

  &:hover {
    background: var(--hula-surface-list-hover);
  }

  &--selected {
    background: var(--hula-surface-session-active);

    .text-14px {
      font-weight: 600;
      color: var(--hula-text-primary);
    }
  }

  &--top {
    border-left: 3px solid var(--hula-brand-primary);
    padding-left: calc(16px - 3px);
  }

  &--dm {
    .n-avatar {
      border: 2px solid transparent;

      .n-badge__dot {
        width: 10px !important;
        height: 10px !important;
        right: -1px !important;
        bottom: -1px !important;
      }
    }
  }

  &--burn {
    position: relative;

    &::after {
      content: '';
      position: absolute;
      top: 8px;
      left: 52px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ff6b35;
      animation: burn-pulse 2s infinite;
    }
  }
}

@keyframes burn-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.85);
  }
}
</style>
