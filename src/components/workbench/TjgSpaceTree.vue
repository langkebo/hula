<template>
  <div class="tjg-space-tree" :role="treeRole" :aria-label="treeAriaLabel" @keydown="handleKeyDown">
    <div v-if="loading && !rooms.length" class="tjg-space-tree__loading">
      <n-spin size="small" />
    </div>

    <div v-else-if="!rooms.length && !loading" class="tjg-space-tree__empty">
      <n-empty :description="t('space.empty_tree')" />
    </div>

    <div v-else class="tjg-space-tree__list">
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
              :aria-expanded="expandedIds.has(room.spaceId)"
              @click.stop="toggleExpand(room.spaceId)">
              <svg class="size-14px" :class="{ 'is-expanded': expandedIds.has(room.spaceId) }">
                <use href="#down"></use>
              </svg>
            </button>
            <div v-else class="w-14px" />
          </div>

          <n-avatar
            round
            :size="24"
            :src="room.avatarUrl"
            :fallback-src="fallbackAvatar"
            class="tjg-space-tree__item-avatar" />

          <span class="tjg-space-tree__item-name">{{ room.name }}</span>

          <div class="tjg-space-tree__item-meta">
            <n-tag v-if="room.childCount > 0" size="tiny" round :bordered="false">
              {{ room.childCount }}
            </n-tag>
          </div>
        </div>

        <!-- 递归渲染子空间 -->
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

      <!-- 加载更多 -->
      <div
        v-if="nextBatch"
        class="tjg-space-tree__load-more"
        :style="{ paddingLeft: `${currentDepth * 16 + 32}px` }"
        @click="loadMore">
        <n-button text size="tiny" :loading="loadingMore">
          {{ t('common.load_more') }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { type SpaceInfo, useSpace } from '@/composables/space'
import { ThemeEnum } from '@/enums'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'

const props = defineProps<{
  spaceId?: string
  depth?: number
  nested?: boolean
  selectedSpaceId?: string
  suggestedOnly?: boolean
  loader?: (options: {
    spaceId: string
    from?: string
    limit?: number
    maxDepth?: number
    suggestedOnly?: boolean
  }) => Promise<{ rooms: SpaceInfo[]; next_batch?: string }>
}>()

const emit = defineEmits<{
  select: [room: SpaceInfo]
}>()

const logger = createLogger('TjgSpaceTree')
const { t } = useI18n()
const settingStore = useSettingStore()
const { getHierarchy } = useSpace(() => props.spaceId!)
const currentDepth = computed(() => props.depth ?? 0)
const treeRole = computed(() => (props.nested ? 'group' : 'tree'))
const treeAriaLabel = computed(() => (props.nested ? undefined : t('space.space_tree_label')))

const rooms = ref<SpaceInfo[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const nextBatch = ref<string | undefined>(undefined)
const expandedIds = ref<Set<string>>(new Set())

const fallbackAvatar = computed(() => (settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'))
const loadHierarchy = async (options: {
  spaceId: string
  from?: string
  limit?: number
  maxDepth?: number
  suggestedOnly?: boolean
}): Promise<{ rooms: SpaceInfo[]; next_batch?: string }> => {
  if (props.loader) {
    return await props.loader(options)
  }

  const result = await getHierarchy({
    from: options.from,
    limit: options.limit,
    maxDepth: options.maxDepth,
    suggestedOnly: options.suggestedOnly
  })

  return {
    rooms: result.rooms as unknown as SpaceInfo[],
    next_batch: result.next_batch
  }
}

const loadData = async (from?: string) => {
  if (!props.spaceId) return

  if (from) {
    loadingMore.value = true
  } else {
    loading.value = true
  }

  try {
    const result = await loadHierarchy({
      spaceId: props.spaceId,
      limit: 20,
      from,
      maxDepth: 1,
      suggestedOnly: props.suggestedOnly
    })

    if (from) {
      rooms.value = [...rooms.value, ...result.rooms]
    } else {
      rooms.value = result.rooms
    }
    nextBatch.value = result.next_batch
  } catch (err) {
    logger.warn('加载空间房间列表失败:', err)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const toggleExpand = (id: string) => {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
}

const handleSelect = (room: SpaceInfo) => {
  emit('select', room)
}

const loadMore = () => {
  if (nextBatch.value) {
    void loadData(nextBatch.value)
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement
  const currentItem = target.closest('[role="treeitem"]') as HTMLElement
  if (!currentItem) return

  switch (event.key) {
    case 'ArrowUp': {
      event.preventDefault()
      const prev = currentItem.previousElementSibling as HTMLElement
      if (prev?.focus) prev.focus()
      break
    }
    case 'ArrowDown': {
      event.preventDefault()
      const next = currentItem.nextElementSibling as HTMLElement
      if (next?.focus) next.focus()
      break
    }
    case 'ArrowRight': {
      event.preventDefault()
      const roomId = currentItem.dataset.id
      if (roomId && !expandedIds.value.has(roomId)) {
        toggleExpand(roomId)
      }
      break
    }
    case 'ArrowLeft': {
      event.preventDefault()
      const roomId = currentItem.dataset.id
      if (roomId && expandedIds.value.has(roomId)) {
        toggleExpand(roomId)
      }
      break
    }
    case 'Enter':
    case ' ': {
      event.preventDefault()
      const roomId = currentItem.dataset.id
      const room = rooms.value.find((r) => r.spaceId === roomId)
      if (room) handleSelect(room)
      break
    }
  }
}

onMounted(() => {
  void loadData()
})

// 监听 spaceId 变化重新加载
watch(
  () => props.spaceId,
  () => {
    rooms.value = []
    nextBatch.value = undefined
    expandedIds.value.clear()
    void loadData()
  }
)
</script>

<style scoped lang="scss">
.tjg-space-tree {
  width: 100%;
}

.tjg-space-tree__loading,
.tjg-space-tree__empty {
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
  transition: background-color 0.2s ease;

  &:hover {
    background: var(--tjg-surface-list-hover);
  }
}

.tjg-space-tree__item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  color: var(--tjg-text-tertiary);

  svg {
    transition: transform 0.2s ease;
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

.tjg-space-tree__item-content {
  position: relative;
  overflow: hidden;
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

.tjg-space-tree-child-expand-enter-active,
.tjg-space-tree-child-expand-leave-active {
  transition: all var(--tjg-motion-duration-normal, 0.2s) var(--tjg-motion-ease-standard, ease);
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

@media (prefers-reduced-motion: reduce) {
  .tjg-space-tree__item-content,
  .tjg-space-tree__item-icon svg,
  .tjg-space-tree-child-expand-enter-active,
  .tjg-space-tree-child-expand-leave-active {
    transition: none !important;
  }

  .tjg-space-tree__item-content.is-selected,
  .tjg-space-tree__item-content.is-selected::after {
    animation: none !important;
  }
}
</style>
