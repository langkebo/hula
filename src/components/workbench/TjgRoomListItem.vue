<template>
  <div
    role="listitem"
    tabindex="0"
    :data-test="`session-item-${roomId}`"
    :aria-label="ariaLabel"
    :aria-current="isActive ? 'true' : undefined"
    :aria-pressed="isBatchMode ? isBatchSelected : undefined"
    class="tjg-room-list-item"
    :class="itemClasses"
    @click="handleClick"
    @keydown.enter.prevent="handleClick"
    @keydown.space.prevent="handleClick"
    @contextmenu="handleContextMenu">
    <n-flex align="center" :size="12">
      <n-checkbox
        v-if="isBatchMode"
        :checked="isBatchSelected"
        class="tjg-room-list-item__checkbox"
        @update:checked="handleBatchToggle"
        @click.stop />
      <n-badge :dot="isFavorite" color="var(--tjg-color-warning-500)" :offset="[-4, 4]">
        <n-avatar
          :size="44"
          :src="AvatarUtils.getAvatarUrl(avatarSrc)"
          :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
          round />
      </n-badge>
      <n-flex vertical :size="4" class="flex-1 min-w-0">
        <n-flex align="center" justify="space-between" :gap="8">
          <span class="tjg-room-list-item__name truncate flex-1">{{ displayName }}</span>
          <n-flex align="center" :size="4" shrink="0">
            <n-icon v-if="isEncrypted" size="14" class="text-[--tjg-text-tertiary]">
              <svg><use href="#lock" /></svg>
            </n-icon>
            <n-icon v-if="isBurnAfterRead" size="14" class="text-[--tjg-color-danger-500]">
              <svg><use href="#fire" /></svg>
            </n-icon>
            <span class="tjg-room-list-item__time whitespace-nowrap">{{ timeText }}</span>
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
            <span v-if="typingText" class="tjg-room-list-item__typing truncate flex-1">
              {{ typingText }}
            </span>
            <span v-else-if="lastMessageText" class="tjg-room-list-item__preview truncate flex-1">
              {{ lastMessageText }}
            </span>
            <span v-else class="tjg-room-list-item__placeholder truncate flex-1">--</span>
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
            <n-badge
              v-if="!isInvite"
              :value="badgeCount"
              :max="99"
              :show="badgeCount > 0"
              :color="badgeColor"
              class="shrink-0" />
            <RoomInviteActions
              v-if="isInvite"
              :room-id="roomId"
              @accepted="handleAcceptInvite"
              @rejected="handleRejectInvite" />
          </n-flex>
        </n-flex>
      </n-flex>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
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
// 未读角标配色：@提及用警示红；静音/屏蔽会话用灰色（参考 HuLa 设计）；普通未读用品牌绿
const badgeColor = computed(() => {
  if (hasMention.value) return 'var(--tjg-room-highlight-badge-bg)'
  if (isMuted.value || isShielded.value) return 'rgba(128, 128, 128, 0.5)'
  return 'var(--tjg-room-unread-badge-bg)'
})
const isFavorite = computed(() => hasFavoriteTag.value)
const isDm = computed(() => props.item.type === RoomTypeEnum.SINGLE)
const isGroup = computed(() => props.item.type === RoomTypeEnum.GROUP)
const isSpace = computed(() => props.item.type === RoomTypeEnum.SPACE)
const isEncrypted = computed(() => props.item.isEncrypted ?? false)
const isBurnAfterRead = computed(() => props.item.isBurnAfterRead ?? false)
const isInvite = computed(() => props.item.membership === 'invite')
const isBatchMode = computed(() => props.batchMode ?? false)
const isBatchSelected = computed(() => props.batchSelected ?? false)
const isActive = computed(() => globalStore.currentSessionRoomId === roomId.value)

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
  'tjg-room-list-item--selected': isActive.value,
  'tjg-room-list-item--batch': isBatchMode.value,
  'tjg-room-list-item--batch-selected': isBatchSelected.value,
  'tjg-room-list-item--top': isTop.value,
  'tjg-room-list-item--muted': props.classes?.muted ?? false,
  'tjg-room-list-item--group': isGroup.value,
  'tjg-room-list-item--dm': isDm.value,
  'tjg-room-list-item--space': isSpace.value,
  'tjg-room-list-item--encrypted': isEncrypted.value,
  'tjg-room-list-item--burn': isBurnAfterRead.value
}))

const ariaLabel = computed(() => {
  const parts: string[] = [displayName.value]
  if (lastMessageText.value) parts.push(lastMessageText.value)
  if (badgeCount.value > 0) parts.push(`${badgeCount.value}`)
  return parts.join('，')
})

const handleClick = () => {
  if (isBatchMode.value) {
    emit('batch-toggle', roomId.value)
    return
  }
  emit('click', props.item)
}

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()
}

const handleAcceptInvite = () => {
  emit('accept-invite', props.item)
}

const handleRejectInvite = () => {
  emit('reject-invite', props.item)
}

const handleBatchToggle = () => {
  emit('batch-toggle', roomId.value)
}
</script>

<style lang="scss" scoped>
.tjg-room-list-item {
  min-height: 50px;
  padding: 12px;
  cursor: pointer;
  transition:
    background-color 0.2s var(--tjg-motion-ease-standard),
    box-shadow 0.2s var(--tjg-motion-ease-standard),
    opacity 0.2s var(--tjg-motion-ease-standard);
  user-select: none;
  border-radius: 12px;
  margin: 0 8px 8px;
  border: 1px solid transparent;

  &:hover {
    background: var(--tjg-surface-list-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 2px;
  }

  &:active {
    background: var(--tjg-surface-session-active);
  }

  &--selected {
    background: var(--tjg-surface-session-active);
    box-shadow: var(--tjg-surface-session-active-shadow);

    .tjg-room-list-item__name {
      font-weight: 600;
      /* color: #ffffff — 选中态白色文字覆盖（等价于 var(--tjg-text-inverse)） */
      color: var(--tjg-text-inverse);
    }

    .tjg-room-list-item__preview {
      color: color-mix(in srgb, var(--tjg-text-inverse) 85%, transparent);
    }

    .tjg-room-list-item__time {
      color: color-mix(in srgb, var(--tjg-text-inverse) 75%, transparent);
    }
  }

  &--batch {
    padding-left: 12px;
  }

  &--batch-selected {
    background: var(--tjg-color-primary-100);
    box-shadow: inset 0 0 0 1px var(--tjg-color-primary-300-alpha);
  }

  &--top {
    padding-left: 9px;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: var(--tjg-color-primary-500);
    }
  }

  &--muted {
    opacity: 0.65;
  }

  &--group {
    .n-avatar {
      border: 2px solid var(--tjg-color-primary-500);
    }
  }

  &--dm {
    .n-avatar {
      border: 2px solid var(--tjg-color-info-500);

      .n-badge__dot {
        width: 10px !important;
        height: 10px !important;
        right: -1px !important;
        bottom: -1px !important;
      }
    }
  }

  &--space {
    .n-avatar {
      border: 2px solid var(--tjg-color-warning-500);
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
      background: var(--tjg-color-danger-500);
      animation: burn-pulse 2s infinite;
    }
  }
}

.tjg-room-list-item__checkbox {
  flex-shrink: 0;
}

.tjg-room-list-item__name {
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: var(--tjg-text-primary);
}

.tjg-room-list-item__time {
  font-size: 12px;
  line-height: 18px;
  color: var(--tjg-text-tertiary);
}

.tjg-room-list-item__preview,
.tjg-room-list-item__placeholder {
  font-size: 12px;
  line-height: 18px;
}

.tjg-room-list-item__preview {
  color: var(--tjg-text-secondary);
}

.tjg-room-list-item__placeholder {
  color: var(--tjg-text-tertiary);
}

.tjg-room-list-item__typing {
  font-size: 12px;
  line-height: 18px;
  color: var(--tjg-color-primary-500);
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
  .tjg-room-list-item--burn::after {
    animation: none;
  }
}
</style>
