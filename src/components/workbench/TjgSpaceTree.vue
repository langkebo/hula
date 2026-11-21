<template>
  <div class="tjg-space-tree">
    <div v-if="isInitialLoading" class="tjg-space-tree__loading"><n-spin size="small" /></div>

    <div v-else-if="loadFailed" data-test="space-tree-error">
      <ErrorState compact :title="t('common.load_failed')" :retry-text="t('common.retry')" @retry="retryLoad" />
    </div>

    <EmptyState v-else-if="isEmpty" compact :description="t('space.empty_tree')" />

    <div v-else class="tjg-space-tree__list" :role="treeRole" :aria-label="treeAriaLabel" @keydown="handleKeyDown">
      <div
        v-for="(room, index) in rooms"
        :key="room.spaceId"
        role="treeitem"
        :aria-expanded="room.childCount > 0 ? expandedIds.has(room.spaceId) : undefined"
        :aria-selected="selectedSpaceId === room.spaceId"
        :aria-level="currentDepth + 1"
        :aria-posinset="index + 1"
        :aria-setsize="rooms.length"
        :tabindex="selectedSpaceId === room.spaceId || (!selectedSpaceId && index === 0) ? 0 : -1"
        :data-id="room.spaceId"
        class="tjg-space-tree__item"
        :style="{ paddingLeft: `${currentDepth * 16 + 8}px` }"
        @click="handleSelect(room)">
        <div class="tjg-space-tree__item-content" :class="{ 'is-selected': selectedSpaceId === room.spaceId }">
          <div class="tjg-space-tree__item-icon">
            <button
              v-if="room.childCount > 0"
              type="button"
              class="tjg-space-tree__expand-button"
              :aria-label="expandedIds.has(room.spaceId) ? t('space.collapse') : t('space.expand')"
              :aria-expanded="expandedIds.has(room.spaceId)"
              @click.stop="toggleExpand(room.spaceId)">
              <svg class="size-14px" aria-hidden="true" :class="{ 'is-expanded': expandedIds.has(room.spaceId) }">
                <use href="#down"></use>
              </svg>
            </button>
            <div v-else class="w-14px" />
          </div>

          <n-avatar
            round
            :size="24"
            v-bind="room.avatarUrl ? { src: room.avatarUrl } : {}"
            :fallback-src="fallbackAvatar"
            class="tjg-space-tree__item-avatar" />

          <span class="tjg-space-tree__item-name">{{ room.name }}</span>

          <div class="tjg-space-tree__item-meta">
            <n-tag v-if="room.childCount > 0" size="tiny" round :bordered="false">{{ room.childCount }}</n-tag>
          </div>
        </div>
        <Transition name="tjg-space-tree-child-expand">
          <TjgSpaceTree
            v-if="expandedIds.has(room.spaceId)"
            :space-id="room.spaceId"
            :depth="currentDepth + 1"
            nested
            :selected-space-id="selectedSpaceId"
            :suggested-only="suggestedOnly"
            :loader="loader"
            @select="handleSelect" />
        </Transition>
      </div>
    </div>

    <!-- 加载更多：按钮不能放在 role=tree/group 内，否则违反 aria-required-children -->
    <div
      v-if="nextBatch && rooms.length > 0"
      class="tjg-space-tree__load-more"
      :style="{ paddingLeft: `${currentDepth * 16 + 32}px` }"
      @click="loadMore">
      <n-button text size="tiny" :loading="loadingMore">{{ t('common.load_more') }}</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ErrorState from '@/components/common/ErrorState.vue'
import type { SpaceInfo } from '@/composables/space'
import { type TjgSpaceTreeProps, useTjgSpaceTree } from './useTjgSpaceTree'

const props = defineProps<TjgSpaceTreeProps>()

const emit = defineEmits<{
  select: [room: SpaceInfo]
}>()

const { t } = useI18n()

const {
  rooms,
  loadFailed,
  isInitialLoading,
  isEmpty,
  loadingMore,
  nextBatch,
  expandedIds,
  currentDepth,
  treeRole,
  treeAriaLabel,
  fallbackAvatar,
  retryLoad,
  toggleExpand,
  handleSelect,
  loadMore,
  handleKeyDown
} = useTjgSpaceTree(props, emit)
</script>

<style scoped lang="scss">
.tjg-space-tree {
  width: 100%;
}

.tjg-space-tree__loading {
  padding: 20px;
  display: flex;
  justify-content: center;
}

.tjg-space-tree__item-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  transition: background-color var(--tjg-motion-duration-normal) ease;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    opacity: 0;
    pointer-events: none;
    background: linear-gradient(
      110deg,
      transparent 0%,
      color-mix(in srgb, var(--tjg-color-primary-100) 60%, transparent) 42%,
      transparent 78%
    );
    transform: translateX(-110%);
  }

  &.is-selected {
    background: var(--tjg-surface-sidebar-selected);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--tjg-color-primary-500) 15%, transparent);
    animation: tjg-space-tree-pulse 1.2s ease-out 1;

    &::after {
      opacity: 0.9;
      animation: tjg-space-tree-shimmer 1.15s linear infinite;
    }
  }

  &:hover {
    background: var(--tjg-surface-sidebar-hover);
  }
}

.tjg-space-tree__item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  color: var(--tjg-text-tertiary);

  svg {
    transition: transform var(--tjg-motion-duration-normal) ease;
    &.is-expanded {
      transform: rotate(0);
    }
    &:not(.is-expanded) {
      transform: rotate(-90deg);
    }
  }
}

.tjg-space-tree__expand-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: inherit;
}

.tjg-space-tree__item-avatar {
  flex-shrink: 0;
}

.tjg-space-tree__item-name {
  flex: 1;
  font-size: 13px;
  color: var(--tjg-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tjg-space-tree__item-meta {
  flex-shrink: 0;
}

.tjg-space-tree__load-more {
  padding: 8px 12px;
  cursor: pointer;
}

.tjg-space-tree-child-expand-enter-active,
.tjg-space-tree-child-expand-leave-active {
  transition:
    color var(--tjg-motion-duration-normal, var(--tjg-motion-duration-normal)) var(--tjg-motion-ease-standard, ease),
    background-color var(--tjg-motion-duration-normal, var(--tjg-motion-duration-normal))
      var(--tjg-motion-ease-standard, ease),
    border-color var(--tjg-motion-duration-normal, var(--tjg-motion-duration-normal))
      var(--tjg-motion-ease-standard, ease),
    box-shadow var(--tjg-motion-duration-normal, var(--tjg-motion-duration-normal))
      var(--tjg-motion-ease-standard, ease),
    opacity var(--tjg-motion-duration-normal, var(--tjg-motion-duration-normal)) var(--tjg-motion-ease-standard, ease),
    transform var(--tjg-motion-duration-normal, var(--tjg-motion-duration-normal)) var(--tjg-motion-ease-standard, ease);
}

.tjg-space-tree-child-expand-enter-from,
.tjg-space-tree-child-expand-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@keyframes tjg-space-tree-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--tjg-color-primary-300-alpha) 80%, transparent);
  }
  50% {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--tjg-color-primary-300-alpha) 20%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}

@keyframes tjg-space-tree-shimmer {
  from {
    transform: translateX(-110%);
  }
  to {
    transform: translateX(110%);
  }
}
</style>
