<template>
  <header class="space-view-header" data-testid="space-view-header">
    <div class="space-view-header__left">
      <h2 class="space-view-header__title">{{ t('space.title') }}</h2>
    </div>

    <div class="space-view-header__actions">
      <!-- 空间切换器 -->
      <SpaceSwitcher
        v-if="showSwitcher"
        :spaces="spaces"
        :current-space-id="currentSpaceId"
        @select="handleSpaceSelect" />

      <!-- 搜索按钮 -->
      <button
        type="button"
        class="space-view-header__icon-btn"
        :aria-label="t('search.title')"
        :title="t('search.title')"
        @click="handleSearch">
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
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </button>

      <!-- 创建空间按钮 -->
      <button
        type="button"
        class="space-view-header__icon-btn"
        :aria-label="t('space.create')"
        :title="t('space.create')"
        @click="handleCreate">
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
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SpaceSwitcher from '@/components/space/SpaceSwitcher.vue'

interface SpaceInfo {
  spaceId: string
  name: string
  avatarUrl?: string
  childCount?: number
  memberCount?: number
}

defineProps<{
  spaces: SpaceInfo[]
  currentSpaceId: string
  showSwitcher?: boolean
}>()

const emit = defineEmits<{
  'space-select': [spaceId: string]
  search: []
  create: []
}>()

const { t } = useI18n()

const handleSpaceSelect = (spaceId: string) => {
  emit('space-select', spaceId)
}

const handleSearch = () => {
  emit('search')
}

const handleCreate = () => {
  emit('create')
}
</script>

<style scoped lang="scss">
.space-view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background: var(--tjg-surface-panel);
  border-bottom: 1px solid var(--tjg-border-default);
  flex-shrink: 0;
}

.space-view-header__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.space-view-header__title {
  margin: 0;
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-semibold);
  color: var(--tjg-text-primary);
  line-height: 1.4;
}

.space-view-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.space-view-header__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: var(--tjg-radius-md);
  background: transparent;
  color: var(--tjg-text-secondary);
  cursor: pointer;
  transition:
    background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
    color: var(--tjg-text-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .space-view-header__icon-btn {
    transition: none;
  }
}
</style>
