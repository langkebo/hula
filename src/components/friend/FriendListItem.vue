<template>
  <article
    class="friend-list-item"
    :class="{ 'friend-list-item--selected': selected, 'friend-list-item--rtl': isRtl }"
    :dir="dir"
    :aria-label="ariaLabel"
    tabindex="0"
    @click="$emit('select', friend)"
    @keydown.enter="$emit('select', friend)"
    @contextmenu="$emit('contextmenu', { friend, event: $event })">
    <div class="friend-list-item__avatar-wrap">
      <n-badge :dot="friend.friendStatus === 'favorite'" color="var(--color-warning)" :offset="[-4, 4]">
        <n-avatar
          :size="44"
          round
          :src="AvatarUtils.getAvatarUrl(friend.avatarUrl)"
          :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'" />
      </n-badge>
      <span
        class="friend-list-item__presence"
        :class="{ 'friend-list-item__presence--online': friend.activeStatus === OnlineEnum.ONLINE }"
        aria-hidden="true" />
    </div>

    <div class="friend-list-item__content">
      <div class="friend-list-item__title-row">
        <span class="friend-list-item__name" v-safe-html="highlightText(displayName)" />
        <n-tag v-if="friend.friendStatus === 'blocked'" size="tiny" type="error">
          {{ t('friend.status.blocked') }}
        </n-tag>
        <n-tag v-else-if="(friend.friendStatus as string) === 'hidden'" size="tiny">
          {{ t('friend.status.hidden') }}
        </n-tag>
      </div>
      <div class="friend-list-item__meta">
        <span>
          {{ friend.activeStatus === OnlineEnum.ONLINE ? t('friend.list.online') : t('friend.list.offline') }}
        </span>
        <span
          v-if="friend.statusMessage"
          class="friend-list-item__status"
          v-safe-html="highlightText(friend.statusMessage)" />
      </div>
    </div>

    <div class="friend-list-item__actions">
      <n-button
        tertiary
        circle
        size="small"
        :aria-label="t('friend.context.send_message')"
        @click.stop="$emit('send-message', friend)">
        <template #icon>
          <svg class="size-16px"><use href="#message" /></svg>
        </template>
      </n-button>
      <n-button
        tertiary
        circle
        size="small"
        :aria-label="t('friend.context.remove')"
        @click.stop="$emit('remove', friend)">
        <template #icon>
          <svg class="size-16px"><use href="#delete" /></svg>
        </template>
      </n-button>
      <n-button
        tertiary
        circle
        size="small"
        :aria-label="t('menu.ctx_menu_more')"
        @click.stop="$emit('more', { friend, event: $event })">
        <template #icon>
          <svg class="size-16px"><use href="#more" /></svg>
        </template>
      </n-button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { OnlineEnum, ThemeEnum } from '@/enums'
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'

const props = withDefaults(
  defineProps<{
    friend: MatrixContact
    selected?: boolean
    dir?: 'ltr' | 'rtl'
    query?: string
  }>(),
  {
    selected: false,
    dir: 'ltr',
    query: ''
  }
)

defineEmits<{
  select: [friend: MatrixContact]
  'send-message': [friend: MatrixContact]
  remove: [friend: MatrixContact]
  more: [payload: { friend: MatrixContact; event: MouseEvent }]
  contextmenu: [payload: { friend: MatrixContact; event: MouseEvent }]
}>()

const { t } = useI18n()
const settingStore = useSettingStore()
const isRtl = computed(() => props.dir === 'rtl')
const displayName = computed(() => props.friend.remark || props.friend.displayName || props.friend.name)
const ariaLabel = computed(() => `${displayName.value} ${props.friend.userId}`)

const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const highlightText = (value?: string | null) => {
  const text = String(value || '')
  if (!props.query.trim()) {
    return escapeHtml(text)
  }

  const normalizedQuery = props.query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(${normalizedQuery})`, 'ig')
  return escapeHtml(text).replace(pattern, '<mark>$1</mark>')
}
</script>

<style scoped lang="scss">
.friend-list-item {
  --friend-card-bg: var(--hula-surface-panel);
  --friend-card-border: var(--hula-border-default);
  --friend-card-text: var(--hula-text-primary, #18181c);
  --friend-card-subtle: var(--hula-text-tertiary, #909090);
  align-items: center;
  background: var(--friend-card-bg);
  border: 1px solid transparent;
  border-radius: var(--hula-radius-lg, 12px);
  cursor: pointer;
  display: flex;
  gap: 12px;
  min-height: 76px;
  padding: 12px;
  transition:
    background-color var(--hula-motion-duration-normal, 180ms) var(--hula-motion-ease-standard),
    box-shadow var(--hula-motion-duration-normal, 180ms) var(--hula-motion-ease-standard);

  &:hover {
    background: var(--hula-surface-list-hover);
  }

  &--rtl:hover {
    transform: none;
  }

  &:focus-visible {
    outline: 2px solid var(--hula-color-primary-500);
    outline-offset: 2px;
  }
}

.friend-list-item--selected {
  background: var(--hula-surface-session-active);
  box-shadow: var(--hula-surface-session-active-shadow);
  border-color: transparent;

  .friend-list-item__name {
    color: var(--hula-text-inverse);
    font-weight: 600;
  }

  .friend-list-item__meta {
    color: color-mix(in srgb, var(--hula-text-inverse) 80%, transparent);
  }

  .friend-list-item__presence {
    border-color: var(--hula-color-primary-500);
  }
}

.friend-list-item--rtl {
  direction: rtl;
}

.friend-list-item__avatar-wrap {
  flex-shrink: 0;
  position: relative;
}

.friend-list-item__presence {
  background: var(--hula-text-disabled);
  border: 2px solid var(--friend-card-bg);
  border-radius: 999px;
  bottom: -2px;
  height: 12px;
  inset-inline-end: -2px;
  position: absolute;
  width: 12px;
  transition: border-color 0.2s ease;
}

.friend-list-item__presence--online {
  background: var(--hula-color-success-500);
  box-shadow: 0 0 4px color-mix(in srgb, var(--hula-color-success-500) 40%, transparent);
}

.friend-list-item__content {
  color: var(--friend-card-text);
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.friend-list-item__title-row {
  align-items: center;
  display: flex;
  gap: 6px;
  min-width: 0;
}

.friend-list-item__name {
  flex: 1;
  font-size: 14px;
  line-height: 20px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-list-item__meta {
  color: var(--friend-card-subtle);
  display: flex;
  font-size: 12px;
  gap: 8px;
  min-width: 0;
}

.friend-list-item__status {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-list-item__actions {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}

:deep(mark) {
  background: rgba(99, 102, 241, 0.14);
  border-radius: 4px;
  color: inherit;
  padding: 0 2px;
}

@media (prefers-reduced-motion: reduce) {
  .friend-list-item {
    transition: none;
  }
}

[data-theme='dark'] .friend-list-item--selected {
  background: var(--hula-surface-session-active);
  box-shadow: var(--hula-surface-session-active-shadow);
}
</style>
