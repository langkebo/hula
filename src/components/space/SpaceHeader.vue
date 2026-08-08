<template>
  <header class="space-header" data-testid="space-header">
    <!-- 头像 -->
    <div class="space-header__avatar-area" data-testid="space-header-avatar" :aria-label="space.name">
      <img
        v-if="space.avatarUrl"
        data-testid="space-header-avatar-img"
        :src="space.avatarUrl"
        :alt="''"
        class="space-header__avatar-img" />
      <span v-else data-testid="space-header-avatar-placeholder" class="space-header__avatar-placeholder">
        {{ avatarInitial }}
      </span>
    </div>

    <!-- 信息区 -->
    <div class="space-header__info">
      <div class="space-header__title-row">
        <h2 class="space-header__name" data-testid="space-header-name">{{ space.name }}</h2>
        <button
          v-if="canManage"
          data-testid="space-header-settings"
          type="button"
          class="space-header__settings"
          :aria-label="t('space.settings')"
          @click="emit('settings', space.spaceId)">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      <p v-if="space.topic" class="space-header__topic" data-testid="space-header-topic">{{ space.topic }}</p>

      <!-- 统计行 -->
      <div class="space-header__stats">
        <span class="space-header__stat" data-testid="space-header-members" :aria-label="t('space.member_count_value', { count: space.memberCount ?? 0 })">
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
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>{{ t('space.member_count_value', { count: space.memberCount ?? 0 }) }}</span>
        </span>
        <span class="space-header__stat" data-testid="space-header-children" :aria-label="t('space.room_count_value', { count: space.childCount ?? 0 })">
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
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span>{{ t('space.room_count_value', { count: space.childCount ?? 0 }) }}</span>
        </span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'SpaceHeader' })

const props = defineProps<{
  space: {
    spaceId: string
    name: string
    topic?: string
    avatarUrl?: string
    memberCount?: number
    childCount?: number
  }
  canManage?: boolean
}>()

const emit = defineEmits<{
  settings: [spaceId: string]
}>()

const { t } = useI18n()

const avatarInitial = computed(() => props.space.name?.charAt(0)?.toUpperCase() || '?')
</script>

<style scoped lang="scss">
.space-header {
  display: flex;
  align-items: flex-start;
  gap: var(--tjg-space-4);
  padding: var(--tjg-space-4) var(--tjg-space-5);
  background: var(--tjg-surface-panel);
  border-bottom: 1px solid var(--tjg-border-default);
}

.space-header__avatar-area {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: var(--tjg-radius-full);
  overflow: hidden;
  background: var(--tjg-surface-subtle);
}

.space-header__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.space-header__avatar-placeholder {
  font-size: var(--tjg-font-size-xl);
  font-weight: var(--tjg-font-weight-semibold);
  color: var(--tjg-text-secondary);
}

.space-header__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.space-header__title-row {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  min-width: 0;
}

.space-header__name {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--tjg-font-size-xl);
  font-weight: var(--tjg-font-weight-semibold);
  color: var(--tjg-text-primary);
}

.space-header__settings {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: 0;
  border-radius: var(--tjg-radius-xs);
  background: transparent;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
  transition:
    background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    transform var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
    color: var(--tjg-text-primary);
  }

  &:active {
    transform: scale(var(--tjg-motion-scale-active));
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 2px;
  }
}

.space-header__topic {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
}

.space-header__stats {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-4);
  margin-top: 2px;
}

.space-header__stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
}

@media (prefers-reduced-motion: reduce) {
  .space-header__settings {
    transition: none;
  }
}
</style>
