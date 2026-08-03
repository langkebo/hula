<template>
  <div
    role="listitem"
    tabindex="0"
    :data-test="`session-item-${roomId}`"
    :aria-label="ariaLabel"
    :aria-current="isActive ? 'true' : undefined"
    :aria-pressed="isBatchMode ? isBatchSelected : undefined"
    class="room-item"
    :class="itemClasses"
    @click="handleClick"
    @dblclick="handleDblClick"
    @keydown.enter.prevent="handleClick"
    @keydown.space.prevent="handleClick"
    @contextmenu="handleContextMenu">
    <!-- Left indicator bar when active -->
    <div v-if="isActive" class="active-indicator"></div>

    <!-- Batch mode checkbox -->
    <n-checkbox
      v-if="isBatchMode"
      :checked="isBatchSelected"
      class="room-checkbox"
      @update:checked="handleBatchToggle"
      @click.stop />

    <!-- Room avatar -->
    <div class="room-avatar" :class="{ 'is-online': isOnline }">
      <img v-if="avatarSrc" :src="AvatarUtils.getAvatarUrl(avatarSrc)" alt="" @error="handleAvatarError" />
      <span v-else class="room-avatar__initial">{{ roomInitial }}</span>
      <!-- Favorite star badge -->
      <div v-if="isFavorite" class="favorite-badge"></div>
    </div>

    <!-- Room info -->
    <div class="room-info">
      <div class="room-top">
        <div class="room-name">
          <span class="truncate">{{ displayName }}</span>
          <n-tag v-if="isEncrypted" size="small" type="success" :bordered="false" class="room-tag">E2EE</n-tag>
          <n-tag v-if="isBurnAfterRead" size="small" type="error" :bordered="false" class="room-tag">
            <svg class="size-12px"><use href="#fire" /></svg>
          </n-tag>
        </div>
        <div class="room-time">{{ timeText }}</div>
      </div>
      <div class="room-bottom">
        <div class="room-preview" :class="{ mention: hasMention }">
          <template v-if="typingText">
            <span class="typing-indicator">{{ typingText }}</span>
          </template>
          <template v-else-if="lastMessageText">
            <n-tag v-if="hasMention" size="tiny" round :bordered="false" type="error" class="preview-tag">@</n-tag>
            <n-tag v-if="hasFavoriteTag" size="tiny" round :bordered="false" class="preview-tag">
              {{ t('message.message_list.favorite_tag') }}
            </n-tag>
            <n-tag v-if="hasLowPriorityTag" size="tiny" round :bordered="false" class="preview-tag">
              {{ t('message.message_list.low_priority_tag') }}
            </n-tag>
            <span class="truncate">{{ lastMessageText }}</span>
          </template>
          <span v-else class="room-preview__placeholder">--</span>
        </div>
        <div class="room-meta">
          <span v-if="isTop" class="pin-icon">
            <svg class="size-11px"><use href="#pin-filled" /></svg>
          </span>
          <span v-if="isMuted || isShielded" class="mute-icon">
            <svg class="size-11px"><use href="#volume-off" /></svg>
          </span>
          <RoomInviteActions
            v-if="isInvite"
            :room-id="roomId"
            @accepted="handleAcceptInvite"
            @rejected="handleRejectInvite" />
          <span v-else-if="unreadCount > 0" class="unread-badge" :class="{ mention: hasMention }">
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RoomInviteActions from '@/components/room/RoomInviteActions.vue'
import { useTyping } from '@/composables/chat/useTyping'
import { RoomTypeEnum, ThemeEnum } from '@/enums'
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
  batchMode?: boolean
  batchSelected?: boolean
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
const unreadCount = computed(() => {
  const detail = sessionStore.getUnreadDetail(roomId.value)
  return detail?.total ?? props.item.notificationCount ?? props.item.unreadCount ?? 0
})
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
const hasMention = computed(() => {
  const detail = sessionStore.getUnreadDetail(roomId.value)
  return (detail?.highlight ?? props.item.highlightCount ?? 0) > 0
})
const isFavorite = computed(() => hasFavoriteTag.value)
const isDm = computed(() => props.item.type === RoomTypeEnum.SINGLE)
const isEncrypted = computed(() => props.item.isEncrypted ?? false)
const isBurnAfterRead = computed(() => props.item.isBurnAfterRead ?? false)
const isInvite = computed(() => props.item.membership === 'invite')
const isBatchMode = computed(() => props.batchMode ?? false)
const isBatchSelected = computed(() => props.batchSelected ?? false)
const isActive = computed(() => props.classes?.selected ?? false)
const isOnline = computed(() => {
  // For DMs, check if the other user is online
  if (!isDm.value) return false
  // This would need to be connected to presence data
  return false // Placeholder - should be derived from presence store
})

const roomInitial = computed(() => {
  const name = displayName.value
  if (!name) return '?'
  // Get first character, handling multi-byte characters
  const firstChar = name.charAt(0)
  return firstChar.toUpperCase()
})

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

const { getTypingUsersText } = useTyping()

const typingText = computed(() => {
  if (!roomId.value) return ''
  return getTypingUsersText(roomId.value, 2)
})

const itemClasses = computed(() => ({
  active: isActive.value,
  'batch-mode': isBatchMode.value,
  'batch-selected': isBatchSelected.value,
  top: isTop.value,
  muted: props.classes?.muted ?? false,
  dm: isDm.value,
  encrypted: isEncrypted.value,
  burn: isBurnAfterRead.value,
  invite: isInvite.value
}))

const ariaLabel = computed(() => {
  const parts: string[] = [displayName.value]
  if (lastMessageText.value) parts.push(lastMessageText.value)
  if (unreadCount.value > 0) parts.push(`${unreadCount.value}`)
  return parts.join('，')
})

const handleClick = () => {
  if (isBatchMode.value) {
    emit('batch-toggle', roomId.value)
    return
  }
  emit('click', props.item)
}

const handleDblClick = () => {
  emit('dblclick', props.item)
}

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()
}

const handleBatchToggle = () => {
  emit('batch-toggle', roomId.value)
}

const handleAcceptInvite = () => {
  emit('accept-invite', props.item)
}

const handleRejectInvite = () => {
  emit('reject-invite', props.item)
}

const handleAvatarError = (event: Event) => {
  const target = event.target as HTMLImageElement
  target.style.display = 'none'
  // Show the initial instead
  const parent = target.parentElement
  if (parent) {
    const initialSpan = parent.querySelector('.room-avatar__initial') as HTMLElement | null
    if (initialSpan) {
      initialSpan.style.display = 'flex'
    }
  }
}
</script>

<style lang="scss" scoped>
.room-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: var(--hula-radius-sm);
  cursor: pointer;
  position: relative;
  transition: background 0.15s ease;
  height: 68px;
  min-height: 68px;
  user-select: none;
  margin: 0 8px 2px;

  &:hover {
    background: var(--hula-surface-list-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--hula-color-primary-500);
    outline-offset: 2px;
  }

  &.active {
    background: var(--hula-surface-session-active);
    box-shadow: var(--hula-surface-session-active-shadow);

    .room-name {
      color: var(--hula-text-inverse);
      font-weight: 600;
    }

    .room-time {
      color: rgba(255, 255, 255, 0.8);
    }

    .room-preview {
      color: rgba(255, 255, 255, 0.7);
    }

    .room-preview__placeholder {
      color: rgba(255, 255, 255, 0.5);
    }

    .typing-indicator {
      color: rgba(255, 255, 255, 0.9);
    }
  }

  &.batch-mode {
    padding-left: 12px;
  }

  &.batch-selected {
    background: var(--hula-color-primary-100);
    box-shadow: inset 0 0 0 1px var(--hula-color-primary-300-alpha);
  }

  &.top {
    border-left: 3px solid var(--hula-color-primary-500);
    padding-left: 9px;
  }

  &.muted {
    opacity: 0.65;
  }

  &.invite {
    background: var(--hula-room-invite-bg);
  }
}

.active-indicator {
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  background: var(--hula-color-primary-500);
  border-radius: 0 3px 3px 0;
}

.room-checkbox {
  flex-shrink: 0;
}

.room-avatar {
  width: 42px;
  height: 42px;
  border-radius: var(--hula-radius-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  position: relative;
  background: var(--hula-surface-subtle);
  overflow: hidden;
  color: var(--hula-text-secondary);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__initial {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--hula-color-primary-100);
    color: var(--hula-color-primary-500);
  }
}

.favorite-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--hula-color-warning-500);
  border: 2px solid var(--hula-surface-panel);
  z-index: 2;
}

.room-avatar.is-online::after {
  content: '';
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--hula-color-success-500);
  border: 2px solid var(--hula-surface-panel);
}

.room-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.room-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--hula-text-primary);
  white-space: nowrap;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 6px;

  .truncate {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.room-tag {
  flex-shrink: 0;
}

.room-time {
  font-size: 11px;
  color: var(--hula-text-tertiary);
  flex-shrink: 0;
}

.room-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.room-preview {
  font-size: 12px;
  color: var(--hula-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;

  &.mention {
    color: var(--hula-accent);
  }

  &__placeholder {
    color: var(--hula-text-tertiary);
  }
}

.preview-tag {
  flex-shrink: 0;
}

.typing-indicator {
  color: var(--hula-color-primary-500);
}

.room-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.unread-badge {
  background: var(--hula-room-unread-badge-bg);
  color: var(--hula-text-inverse);
  font-size: 10px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;

  &.mention {
    background: var(--hula-room-highlight-badge-bg);
  }
}

.pin-icon,
.mute-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hula-text-tertiary);

  svg {
    width: 11px;
    height: 11px;
    fill: currentColor;
  }
}

.burn::after {
  content: '';
  position: absolute;
  top: 8px;
  left: 52px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--hula-color-danger-500);
  animation: burn-pulse 2s infinite;
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

@media (prefers-reduced-motion: reduce) {
  .burn::after {
    animation: none;
  }
}
</style>
