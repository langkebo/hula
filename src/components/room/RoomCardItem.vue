<template>
  <article
    class="room-card-item flex flex-col gap-[--tjg-space-3] p-[--tjg-space-4] rounded-[--tjg-radius-lg] bg-[--tjg-surface-raised] border border-[--tjg-border-muted] cursor-pointer outline-none"
    data-testid="room-card-item"
    role="button"
    tabindex="0"
    :aria-label="room.name"
    @click="handlePreview"
    @keydown.enter.self.prevent="handlePreview"
    @keydown.space.self.prevent="handlePreview">
    <header class="room-card-item__header flex items-start gap-[--tjg-space-3]">
      <div
        class="room-card-item__avatar shrink-0 flex items-center justify-center size-[48px] overflow-hidden rounded-[--tjg-radius-md] bg-[--tjg-surface-subtle]">
        <img
          v-if="room.avatar"
          :src="room.avatar"
          :alt="''"
          class="w-full h-full object-cover"
          data-testid="room-card-avatar-img" />
        <span
          v-else
          class="text-[--tjg-text-secondary] text-[length:var(--tjg-font-size-lg)] font-[--tjg-font-weight-medium]"
          data-testid="room-card-avatar-placeholder">
          {{ avatarPlaceholder }}
        </span>
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-[--tjg-space-2]">
          <span class="room-card-item__name truncate text-[--tjg-text-primary]" :title="room.name">
            {{ room.name }}
          </span>
          <span
            v-if="room.isPinned"
            class="room-card-item__pinned shrink-0 color-[--tjg-color-primary-500]"
            data-testid="room-card-pinned"
            :title="t('menu.pin')">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <path d="M12 17v5" />
              <path
                d="M9 10.76V6a2 2 0 0 1 4 0v4.76a3 3 0 0 0 2 2.24h1a1 1 0 0 1 1 1v1H5v-1a1 1 0 0 1 1-1h1a3 3 0 0 0 2-2.24Z" />
            </svg>
          </span>
        </div>

        <div class="room-card-item__meta flex items-center gap-[--tjg-space-2] mt-2px">
          <span
            v-if="room.isFederated"
            class="inline-flex items-center gap-2px shrink-0 px-6px py-1px rounded-[--tjg-radius-xs] bg-[--tjg-color-info-100] text-[--tjg-color-info-600] text-[length:var(--tjg-font-size-2xs)]"
            data-testid="room-card-federation"
            :title="t('room.discovery.federated')">
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18" />
              <path d="M12 3a14 14 0 0 1 0 18" />
              <path d="M12 3a14 14 0 0 0 0 18" />
            </svg>
            {{ t('room.discovery.federated') }}
          </span>
          <span
            v-if="room.isEncrypted"
            class="inline-flex items-center shrink-0 color-[--tjg-color-success-500]"
            data-testid="room-card-encrypted"
            :title="t('room.detail.encrypted')">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
        </div>
      </div>

      <span
        v-if="room.unreadCount > 0"
        class="room-card-item__unread shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-4px rounded-full bg-[--tjg-color-danger-500] text-[--tjg-text-inverse] text-[length:var(--tjg-font-size-2xs)] font-[--tjg-font-weight-medium]"
        data-testid="room-card-unread">
        {{ room.unreadCount > 99 ? '99+' : room.unreadCount }}
      </span>
    </header>

    <p
      v-if="room.topic"
      class="room-card-item__topic text-[--tjg-text-tertiary] text-[length:var(--tjg-font-size-sm)] leading-[1.5]"
      data-testid="room-card-topic">
      {{ truncatedTopic }}
    </p>

    <div class="room-card-item__stats flex items-center gap-[--tjg-space-3] text-[length:var(--tjg-font-size-sm)]">
      <span class="inline-flex items-center gap-4px color-[--tjg-text-secondary]">
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        {{ room.memberCount }}
      </span>
      <span class="inline-flex items-center gap-4px color-[--tjg-color-success-500]">
        <span class="inline-block size-[6px] rounded-full bg-[--tjg-status-online]"></span>
        {{ room.onlineCount }}
      </span>
    </div>

    <footer
      class="room-card-item__actions flex items-center gap-[--tjg-space-1] mt-auto pt-[--tjg-space-2] border-t border-[--tjg-border-muted]">
      <button
        type="button"
        class="room-card-item__action flex-center flex-1 h-[28px] rounded-[--tjg-radius-sm] color-[--tjg-text-secondary] hover:bg-[--tjg-surface-list-hover] hover:color-[--tjg-color-primary-500] transition-colors cursor-pointer"
        data-testid="room-card-action-message"
        :aria-label="t('room.context.enter_chat')"
        :title="t('room.context.enter_chat')"
        @click.stop="handleAction('message')">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
      <button
        type="button"
        class="room-card-item__action flex-center flex-1 h-[28px] rounded-[--tjg-radius-sm] color-[--tjg-text-secondary] hover:bg-[--tjg-surface-list-hover] hover:color-[--tjg-color-primary-500] transition-colors cursor-pointer"
        data-testid="room-card-action-info"
        :aria-label="t('room.detail.overview')"
        :title="t('room.detail.overview')"
        @click.stop="handleAction('info')">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </button>
      <button
        type="button"
        class="room-card-item__action flex-center flex-1 h-[28px] rounded-[--tjg-radius-sm] color-[--tjg-text-secondary] hover:bg-[--tjg-surface-list-hover] hover:color-[--tjg-color-primary-500] transition-colors cursor-pointer"
        data-testid="room-card-action-settings"
        :aria-label="t('room.detail.settings')"
        :title="t('room.detail.settings')"
        @click.stop="handleAction('settings')">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <path
            d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <button
        type="button"
        class="room-card-item__action flex-center flex-1 h-[28px] rounded-[--tjg-radius-sm] color-[--tjg-text-secondary] hover:bg-[--tjg-surface-list-hover] hover:color-[--tjg-color-primary-500] transition-colors cursor-pointer"
        data-testid="room-card-action-pin"
        :aria-label="room.isPinned ? t('menu.unpin') : t('menu.pin')"
        :title="room.isPinned ? t('menu.unpin') : t('menu.pin')"
        @click.stop="handleAction('pin')">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <path d="M12 17v5" />
          <path
            d="M9 10.76V6a2 2 0 0 1 4 0v4.76a3 3 0 0 0 2 2.24h1a1 1 0 0 1 1 1v1H5v-1a1 1 0 0 1 1-1h1a3 3 0 0 0 2-2.24Z" />
        </svg>
      </button>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export interface RoomCardViewModel {
  roomId: string
  name: string
  avatar?: string
  topic?: string
  memberCount: number
  onlineCount: number
  unreadCount: number
  isFederated?: boolean
  isEncrypted?: boolean
  isPinned?: boolean
}

const props = defineProps<{
  room: RoomCardViewModel
}>()

const emit = defineEmits<{
  preview: [roomId: string]
  message: [roomId: string]
  info: [roomId: string]
  settings: [roomId: string]
  pin: [roomId: string]
}>()

const { t } = useI18n()

const TOPIC_MAX_LEN = 80

const avatarPlaceholder = computed(() => props.room.name?.charAt(0) || '?')

const truncatedTopic = computed(() => {
  const topic = props.room.topic ?? ''
  if (topic.length <= TOPIC_MAX_LEN) return topic
  return `${topic.slice(0, TOPIC_MAX_LEN)}...`
})

const handlePreview = () => {
  emit('preview', props.room.roomId)
}

const handleAction = (action: 'message' | 'info' | 'settings' | 'pin') => {
  switch (action) {
    case 'message':
      emit('message', props.room.roomId)
      break
    case 'info':
      emit('info', props.room.roomId)
      break
    case 'settings':
      emit('settings', props.room.roomId)
      break
    case 'pin':
      emit('pin', props.room.roomId)
      break
  }
}
</script>

<style scoped lang="scss">
.room-card-item {
  box-shadow: var(--tjg-shadow-card);
  transition:
    box-shadow var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    border-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    transform var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover,
  &:focus-visible {
    border-color: var(--tjg-border-default);
    box-shadow: var(--tjg-shadow-card-hover);
    transform: translateY(-2px);
  }

  &:focus-visible {
    box-shadow:
      var(--tjg-shadow-card-hover),
      0 0 0 2px var(--tjg-color-primary-200);
  }
}

.room-card-item__name {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
}

.room-card-item__topic {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .room-card-item {
    transition: none;
    transform: none;

    &:hover,
    &:focus-visible {
      transform: none;
    }
  }
}
</style>
