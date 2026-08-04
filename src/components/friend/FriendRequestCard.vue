<template>
  <article class="friend-request-card" :dir="dir" :aria-label="ariaLabel">
    <div class="friend-request-card__header">
      <n-avatar
        :size="48"
        round
        :src="AvatarUtils.getAvatarUrl(request.avatarUrl)"
        :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'" />
      <div class="friend-request-card__identity">
        <span class="friend-request-card__name">{{ request.displayName || request.userId }}</span>
        <span class="friend-request-card__account">{{ request.userId }}</span>
      </div>
      <span class="friend-request-card__countdown">
        {{ countdownLabel }}
      </span>
    </div>

    <p v-if="request.message" class="friend-request-card__message">
      {{ request.message }}
    </p>

    <div class="friend-request-card__actions">
      <n-button
        v-if="showAccept"
        type="primary"
        size="small"
        :loading="processing"
        data-test="friend-request-accept"
        :aria-label="t('friend.request.accept')"
        @click="$emit('accept', request)">
        {{ t('friend.request.accept') }}
      </n-button>
      <n-button
        v-if="showReject"
        size="small"
        :loading="processing"
        data-test="friend-request-reject"
        :aria-label="t('friend.request.reject')"
        @click="$emit('reject', request)">
        {{ t('friend.request.reject') }}
      </n-button>
      <n-button
        v-if="showCancel"
        size="small"
        :loading="processing"
        :aria-label="t('friend.request.cancel')"
        @click="$emit('cancel', request)">
        {{ t('friend.request.cancel') }}
      </n-button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ThemeEnum } from '@/enums'
import type { FriendRequestItem } from '@/stores/domains/chat/contacts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000

const props = withDefaults(
  defineProps<{
    request: FriendRequestItem
    processing?: boolean
    dir?: 'ltr' | 'rtl'
    now?: number
  }>(),
  {
    processing: false,
    dir: 'ltr',
    now: undefined
  }
)

defineEmits<{
  accept: [request: FriendRequestItem]
  reject: [request: FriendRequestItem]
  cancel: [request: FriendRequestItem]
}>()

const { t } = useI18n()
const settingStore = useSettingStore()
const expiresAt = computed(() => (props.request.timestamp || Date.now()) + DEFAULT_TTL_MS)
const remainingMs = computed(() => Math.max(0, expiresAt.value - (props.now || Date.now())))
const remainingHours = computed(() => Math.ceil(remainingMs.value / (60 * 60 * 1000)))
const showAccept = computed(() => props.request.direction !== 'outgoing')
const showReject = computed(() => props.request.direction !== 'outgoing')
const showCancel = computed(() => props.request.direction === 'outgoing')
const countdownLabel = computed(() => {
  if (remainingMs.value <= 0) {
    return t('friend.request.expired')
  }
  return t('friend.request.expires_in', { hours: remainingHours.value })
})
const ariaLabel = computed(() => `${props.request.displayName || props.request.userId} ${countdownLabel.value}`)
</script>

<style scoped lang="scss">
.friend-request-card {
  background: var(--tjg-surface-panel);
  border: 1px solid var(--tjg-border-default);
  border-radius: var(--tjg-radius-lg);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  transition:
    background-color var(--tjg-motion-duration-normal, 180ms) var(--tjg-motion-ease-standard),
    box-shadow var(--tjg-motion-duration-normal, 180ms) var(--tjg-motion-ease-standard);

  &:hover {
    box-shadow: var(--tjg-shadow-md);
  }
}

.friend-request-card__header {
  align-items: center;
  display: flex;
  gap: 12px;
}

.friend-request-card__identity {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.friend-request-card__name {
  color: var(--tjg-text-primary);
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-request-card__account,
.friend-request-card__countdown,
.friend-request-card__message {
  color: var(--tjg-text-tertiary);
  font-size: 12px;
}

.friend-request-card__countdown {
  flex-shrink: 0;
}

.friend-request-card__message {
  background: var(--tjg-surface-panel-muted);
  border-radius: var(--tjg-radius-sm);
  line-height: 1.5;
  margin: 0;
  padding: 8px 10px;
}

.friend-request-card__actions {
  display: flex;
  gap: 8px;
}
</style>
