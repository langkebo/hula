<template>
  <div
    class="hula-friend-list-item w-full h-70px mb-4px px-12px flex items-center gap-12px"
    :class="{
      active: active,
      'is-online': item.activeStatus === OnlineEnum.ONLINE || isBot,
      'is-blocked': isBlocked
    }"
    @click="emit('click', item)"
    @dblclick="emit('dblclick', item)">
    <!-- 头像区 -->
    <div class="hula-friend-list-item__avatar-shell">
      <n-avatar
        round
        :size="44"
        :src="AvatarUtils.getAvatarUrl(resolvedAvatarUrl)"
        :fallback-src="fallbackAvatar"
        class="hula-friend-list-item__avatar"
        :class="{ grayscale: !isOnline && !isBot }" />
      <div v-if="isOnline || isBot" class="hula-friend-list-item__online-dot" />
    </div>

    <!-- 信息区 -->
    <div class="flex-1 min-w-0 flex flex-col justify-center gap-4px">
      <div class="flex items-center justify-between">
        <span class="hula-friend-list-item__name truncate text-14px font-500 color-[--hula-text-primary]">
          {{ resolvedDisplayName }}
        </span>
        <slot name="extra" />
      </div>

      <div class="hula-friend-list-item__status flex items-center gap-6px text-12px">
        <template v-if="isBot">
          <span class="hula-friend-list-item__status-tag hula-friend-list-item__status-tag--bot">
            <span class="status-dot status-dot--bot"></span>
            {{ t('home.friends_list.bot_tag') }}
          </span>
        </template>
        <template v-else-if="userState">
          <img class="size-14px rounded-full" :src="userState.url" :alt="userState.title" />
          <span class="hula-friend-list-item__status-text color-[--hula-text-tertiary] truncate">
            {{ translateStateTitle(userState.title) }}
          </span>
        </template>
        <template v-else-if="isBlocked">
          <span class="color-[--hula-text-disabled]">{{ t('home.friends_list.status.blocked') }}</span>
        </template>
        <template v-else>
          <span
            class="hula-friend-list-item__status-tag"
            :class="{ 'hula-friend-list-item__status-tag--online': isOnline }">
            <span
              class="status-dot"
              :class="{ 'status-dot--online': isOnline, 'status-dot--offline': !isOnline }"></span>
            {{ statusText }}
          </span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { OnlineEnum, ThemeEnum } from '@/enums'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'

interface FriendItem {
  uid: string
  name?: string
  avatar?: string
  activeStatus?: OnlineEnum
}

const props = defineProps<{
  item: FriendItem
  active?: boolean
  isBot?: boolean
  isBlocked?: boolean
  displayName?: string
  avatarUrl?: string
  userState?: { url?: string; title?: string } | null
}>()

const emit = defineEmits<{
  click: [item: FriendItem]
  dblclick: [item: FriendItem]
}>()

const { t } = useI18n()
const settingStore = useSettingStore()

const fallbackAvatar = computed(() => (settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'))

const isOnline = computed(() => props.item.activeStatus === OnlineEnum.ONLINE)

const resolvedDisplayName = computed(() => props.displayName || props.item.name || props.item.uid)

const resolvedAvatarUrl = computed(() => props.avatarUrl || props.item.avatar || '')

const statusText = computed(() => {
  return props.item.activeStatus === OnlineEnum.ONLINE
    ? t('home.friends_list.status.online')
    : t('home.friends_list.status.offline')
})

const translateStateTitle = (title?: string) => {
  if (!title) return ''
  // 逻辑复用原有翻译
  return title
}

const getPresenceBadgeColor = (status?: OnlineEnum) => {
  switch (status) {
    case OnlineEnum.ONLINE:
      return 'var(--hula-color-success-500)'
    case OnlineEnum.OFFLINE:
      return 'var(--hula-text-disabled)'
    default:
      return 'var(--hula-text-disabled)'
  }
}
</script>

<style scoped lang="scss">
.hula-friend-list-item {
  cursor: pointer;
  border-radius: 12px;
  transition: all 0.2s var(--hula-motion-ease-standard);
  position: relative;

  &:hover {
    background: var(--hula-surface-list-hover);
  }

  &.active {
    background: var(--hula-surface-session-active);
    box-shadow: var(--hula-surface-session-active-shadow);

    .hula-friend-list-item__name {
      color: var(--hula-text-inverse);
      font-weight: 600;
    }

    .hula-friend-list-item__status-tag {
      color: color-mix(in srgb, var(--hula-text-inverse) 90%, transparent);
      background: color-mix(in srgb, var(--hula-text-inverse) 15%, transparent);
    }

    .hula-friend-list-item__status-text {
      color: color-mix(in srgb, var(--hula-text-inverse) 80%, transparent);
    }
  }

  &__avatar-shell {
    position: relative;
    flex-shrink: 0;
  }

  &__online-dot {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--hula-color-success-500);
    border: 2px solid var(--hula-surface-panel);
    z-index: 1;
    box-shadow: 0 0 4px color-mix(in srgb, var(--hula-color-success-500) 40%, transparent);
  }

  &__avatar {
    border: 2px solid transparent;
    transition: border-color 0.2s ease;

    &.grayscale {
      filter: grayscale(1);
      opacity: 0.75;
    }
  }

  &.active &__avatar {
    border-color: color-mix(in srgb, var(--hula-text-inverse) 40%, transparent);
  }

  &__status-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--hula-text-tertiary);
    background: var(--hula-surface-search);

    &--online {
      color: var(--hula-color-success-500);
      background: var(--color-success-light);
    }

    &--bot {
      color: var(--hula-color-primary-500);
      background: color-mix(in srgb, var(--hula-color-primary-500) 10%, transparent);
    }
  }

  &__status-text {
    font-size: 12px;
  }

  &.is-blocked {
    opacity: 0.6;
  }
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;

  &--online {
    background: var(--hula-color-success-500);
    box-shadow: 0 0 4px color-mix(in srgb, var(--hula-color-success-500) 50%, transparent);
  }

  &--offline {
    background: var(--hula-text-disabled);
  }

  &--bot {
    background: var(--hula-color-primary-500);
    box-shadow: 0 0 4px color-mix(in srgb, var(--hula-color-primary-500) 50%, transparent);
  }
}

[data-theme='dark'] .hula-friend-list-item {
  &.active {
    background: var(--hula-surface-session-active);
    box-shadow: var(--hula-surface-session-active-shadow);
  }
}
</style>
