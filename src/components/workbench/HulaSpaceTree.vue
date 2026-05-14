<template>
  <div class="hula-space-tree">
    <div v-if="loading && !rooms.length" class="hula-space-tree__loading">
      <n-spin size="small" />
    </div>

    <div v-else-if="!rooms.length && !loading" class="hula-space-tree__empty">
      <n-empty :description="t('space.empty_tree')" />
    </div>

    <div v-else class="hula-space-tree__list">
      <div
        v-for="room in rooms"
        :key="room.spaceId"
        class="hula-space-tree__item"
        :style="{ paddingLeft: `${currentDepth * 16 + 8}px` }">
        <div
          class="hula-space-tree__item-content"
          :class="{ 'is-selected': selectedSpaceId === room.spaceId }"
          @click="handleSelect(room)">
          <div class="hula-space-tree__item-icon">
            <svg
              v-if="room.childCount > 0"
              class="size-14px"
              :class="{ 'is-expanded': expandedIds.has(room.spaceId) }"
              @click.stop="toggleExpand(room.spaceId)">
              <use href="#down"></use>
            </svg>
            <div v-else class="w-14px" />
          </div>

          <n-avatar
            round
            :size="24"
            :src="room.avatarUrl"
            :fallback-src="fallbackAvatar"
            class="hula-space-tree__item-avatar" />

          <span class="hula-space-tree__item-name">{{ room.name }}</span>

          <div class="hula-space-tree__item-meta">
            <n-tag v-if="room.childCount > 0" size="tiny" round :bordered="false">
              {{ room.childCount }}
            </n-tag>
          </div>
        </div>

        <!-- 递归渲染子空间 -->
        <Transition name="hula-space-tree-child-expand">
          <HulaSpaceTree
            v-if="expandedIds.has(room.spaceId)"
            :space-id="room.spaceId"
            :depth="currentDepth + 1"
            :selected-space-id="selectedSpaceId"
            @select="handleSelect" />
        </Transition>
      </div>

      <!-- 加载更多 -->
      <div
        v-if="nextBatch"
        class="hula-space-tree__load-more"
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
import { ThemeEnum } from '@/enums'
import { matrixSpaceService, type SpaceInfo } from '@/services/matrix/room/MatrixSpaceService'
import { useSettingStore } from '@/stores/domains/settings/setting'

const props = defineProps<{
  spaceId?: string
  depth?: number
  selectedSpaceId?: string
}>()

const emit = defineEmits<{
  select: [room: SpaceInfo]
}>()

const { t } = useI18n()
const settingStore = useSettingStore()
const currentDepth = computed(() => props.depth ?? 0)

const rooms = ref<SpaceInfo[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const nextBatch = ref<string | undefined>(undefined)
const expandedIds = ref<Set<string>>(new Set())

const fallbackAvatar = computed(() => (settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'))

const loadData = async (from?: string) => {
  if (!props.spaceId) return

  if (from) {
    loadingMore.value = true
  } else {
    loading.value = true
  }

  try {
    const result = await matrixSpaceService.getSpaceHierarchy(props.spaceId, {
      limit: 20,
      from,
      maxDepth: 1
    })

    if (from) {
      rooms.value = [...rooms.value, ...(result.rooms as unknown as SpaceInfo[])]
    } else {
      rooms.value = result.rooms as unknown as SpaceInfo[]
    }
    nextBatch.value = result.next_batch
  } catch (err) {
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
.hula-space-tree {
  width: 100%;
}

.hula-space-tree__loading,
.hula-space-tree__empty {
  padding: 20px;
  display: flex;
  justify-content: center;
}

.hula-space-tree__item-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 0.2s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
  }
}

.hula-space-tree__item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  color: var(--hula-text-tertiary);

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

.hula-space-tree__item-avatar {
  flex-shrink: 0;
}

.hula-space-tree__item-name {
  flex: 1;
  font-size: 13px;
  color: var(--hula-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hula-space-tree__item-meta {
  flex-shrink: 0;
}

.hula-space-tree__load-more {
  padding: 8px 12px;
  cursor: pointer;
}

.hula-space-tree__item-content {
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
      color-mix(in srgb, var(--hula-color-primary-100) 60%, transparent) 42%,
      transparent 78%
    );
    transform: translateX(-110%);
  }

  &.is-selected {
    background: var(--hula-surface-sidebar-selected);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--hula-color-primary-500) 15%, transparent);
    animation: hula-space-tree-pulse 1.2s ease-out 1;

    &::after {
      opacity: 0.9;
      animation: hula-space-tree-shimmer 1.15s linear infinite;
    }
  }

  &:hover {
    background: var(--hula-surface-sidebar-hover);
  }
}

.hula-space-tree-child-expand-enter-active,
.hula-space-tree-child-expand-leave-active {
  transition: all var(--hula-motion-duration-normal, 0.2s) var(--hula-motion-ease-standard, ease);
}

.hula-space-tree-child-expand-enter-from,
.hula-space-tree-child-expand-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@keyframes hula-space-tree-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--hula-color-primary-300-alpha) 80%, transparent);
  }
  50% {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--hula-color-primary-300-alpha) 20%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}

@keyframes hula-space-tree-shimmer {
  from {
    transform: translateX(-110%);
  }
  to {
    transform: translateX(110%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hula-space-tree__item-content,
  .hula-space-tree__item-icon svg,
  .hula-space-tree-child-expand-enter-active,
  .hula-space-tree-child-expand-leave-active {
    transition: none !important;
  }

  .hula-space-tree__item-content.is-selected,
  .hula-space-tree__item-content.is-selected::after {
    animation: none !important;
  }
}
</style>
