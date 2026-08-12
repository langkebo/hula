<template>
  <div class="space-switcher" data-testid="space-switcher">
    <button
      type="button"
      class="space-switcher-btn"
      :class="{ 'space-switcher-btn--open': isOpen }"
      :aria-label="t('space.switcher_title')"
      :title="t('space.switcher_title')"
      @click="toggleSwitcher">
      <svg
        class="space-switcher-btn__icon"
        viewBox="0 0 24 24"
        width="16"
        height="16"
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
      <span class="space-switcher-btn__name">{{ currentSpaceName }}</span>
      <svg
        class="space-switcher-btn__caret"
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <div v-if="isOpen" class="space-switcher-dropdown" data-testid="space-switcher-dropdown">
      <div class="space-switcher-search">
        <svg
          class="space-switcher-search__icon"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          class="space-switcher-search__input"
          :placeholder="t('space.switcher_search_placeholder')"
          @keydown.esc="closeSwitcher" />
      </div>

      <div class="space-switcher-list">
        <div v-if="filteredSpaces.length === 0" class="space-switcher-empty">
          {{ t('space.switcher_empty') }}
        </div>
        <button
          v-for="space in filteredSpaces"
          :key="space.spaceId"
          type="button"
          class="space-switcher-item"
          :class="{ 'space-switcher-item--active': space.spaceId === currentSpaceId }"
          @click="selectSpace(space.spaceId)">
          <div class="space-switcher-item__avatar">
            <img
              v-if="space.avatarUrl"
              :src="space.avatarUrl"
              :alt="space.name"
              class="space-switcher-item__avatar-img" />
            <span v-else class="space-switcher-item__avatar-placeholder">
              {{ getInitial(space.name) }}
            </span>
          </div>
          <div class="space-switcher-item__info">
            <div class="space-switcher-item__name">{{ space.name }}</div>
            <div class="space-switcher-item__meta">
              {{ t('space.room_count_value', { count: space.childCount ?? 0 }) }} ·
              {{ t('space.member_count_value', { count: space.memberCount ?? 0 }) }}
            </div>
          </div>
          <svg
            v-if="space.spaceId === currentSpaceId"
            class="space-switcher-item__check"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface SpaceInfo {
  spaceId: string
  name: string
  avatarUrl?: string
  childCount?: number
  memberCount?: number
}

const props = defineProps<{
  spaces: SpaceInfo[]
  currentSpaceId: string
}>()

const emit = defineEmits<{
  select: [spaceId: string]
}>()

const { t } = useI18n()

const isOpen = ref(false)
const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

const currentSpaceName = computed(() => {
  const current = props.spaces.find((s) => s.spaceId === props.currentSpaceId)
  return current?.name || props.currentSpaceId || t('space.title')
})

const filteredSpaces = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.spaces
  return props.spaces.filter((s) => s.name.toLowerCase().includes(q) || s.spaceId.toLowerCase().includes(q))
})

const toggleSwitcher = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    searchQuery.value = ''
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
}

const closeSwitcher = () => {
  isOpen.value = false
  searchQuery.value = ''
}

const selectSpace = (spaceId: string) => {
  if (spaceId !== props.currentSpaceId) {
    emit('select', spaceId)
  }
  closeSwitcher()
}

const getInitial = (name: string): string => {
  return name?.charAt(0)?.toUpperCase() || '?'
}

// 点击外部关闭下拉菜单
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node
  const switcher = document.querySelector('[data-testid="space-switcher"]')
  if (switcher && !switcher.contains(target)) {
    closeSwitcher()
  }
}

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('click', handleClickOutside)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})
</script>

<style scoped lang="scss">
.space-switcher {
  position: relative;
}

.space-switcher-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--tjg-border-default);
  border-radius: var(--tjg-radius-md);
  background: var(--tjg-surface-panel);
  color: var(--tjg-text-primary);
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  cursor: pointer;
  transition:
    background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    border-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
    border-color: var(--tjg-color-primary-200);
  }

  &--open {
    border-color: var(--tjg-color-primary-500);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 2px;
  }
}

.space-switcher-btn__icon {
  flex-shrink: 0;
  color: var(--tjg-text-secondary);
}

.space-switcher-btn__name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.space-switcher-btn__caret {
  flex-shrink: 0;
  color: var(--tjg-text-tertiary);
  transition: transform var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  .space-switcher-btn--open & {
    transform: rotate(180deg);
  }
}

.space-switcher-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 280px;
  max-width: 320px;
  background: var(--tjg-surface-panel);
  border: 1px solid var(--tjg-border-default);
  border-radius: var(--tjg-radius-md);
  box-shadow: var(--tjg-shadow-md);
  z-index: 100;
  overflow: hidden;
}

.space-switcher-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--tjg-border-default);
}

.space-switcher-search__icon {
  flex-shrink: 0;
  color: var(--tjg-text-tertiary);
}

.space-switcher-search__input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--tjg-text-primary);
  font-size: var(--tjg-font-size-sm);
  outline: none;

  &::placeholder {
    color: var(--tjg-text-quaternary);
  }
}

.space-switcher-list {
  max-height: 320px;
  overflow-y: auto;
  padding: 4px;
}

.space-switcher-empty {
  padding: 20px;
  text-align: center;
  color: var(--tjg-text-tertiary);
  font-size: var(--tjg-font-size-sm);
}

.space-switcher-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: 0;
  border-radius: var(--tjg-radius-sm);
  background: transparent;
  color: var(--tjg-text-primary);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
  }

  &--active {
    background: var(--tjg-color-primary-100);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 2px;
  }
}

.space-switcher-item__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: var(--tjg-radius-full);
  overflow: hidden;
  background: var(--tjg-surface-subtle);
}

.space-switcher-item__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.space-switcher-item__avatar-placeholder {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
}

.space-switcher-item__info {
  flex: 1;
  min-width: 0;
}

.space-switcher-item__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  line-height: 1.4;
}

.space-switcher-item__meta {
  margin-top: 2px;
  font-size: var(--tjg-font-size-2xs);
  color: var(--tjg-text-tertiary);
  line-height: 1.3;
}

.space-switcher-item__check {
  flex-shrink: 0;
  color: var(--tjg-color-primary-500);
}

@media (prefers-reduced-motion: reduce) {
  .space-switcher-btn,
  .space-switcher-btn__caret,
  .space-switcher-item {
    transition: none;
  }
}
</style>
