<template>
  <nav
    class="space-list-pane border-r border-[--tjg-border-default]"
    data-test="space-list-pane"
    :aria-label="t('space.title')">
    <!-- 搜索栏 -->
    <div class="space-list-pane__search-bar px-12px py-10px">
      <n-input
        v-model:value="searchInputValue"
        :placeholder="t('space.search_placeholder')"
        :aria-label="t('space.search_placeholder')"
        clearable
        class="space-list-pane__search"
        @update:value="handleSearchChange"
        @keydown.esc="handleSearchEsc">
        <template #prefix>
          <svg class="size-16px color-[--tjg-text-tertiary]"><use href="#search" /></svg>
        </template>
        <template #suffix>
          <button
            type="button"
            class="space-list-pane__search-global"
            :aria-label="t('search.title')"
            :title="t('search.title')"
            @click="handleGlobalSearch">
            <svg class="size-16px"><use href="#expand" /></svg>
          </button>
        </template>
      </n-input>
    </div>

    <!-- 筛选条 -->
    <div class="space-list-pane__filter-bar px-12px pb-8px">
      <div class="space-list-pane__filter-tabs" role="tablist">
        <button
          v-for="opt in filterOptions"
          :key="opt.value"
          type="button"
          role="tab"
          :aria-selected="activeFilter === opt.value"
          :class="[
            'space-list-pane__filter-tab',
            { 'space-list-pane__filter-tab--active': activeFilter === opt.value }
          ]"
          @click="activeFilter = opt.value">
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- 空间列表 -->
    <n-scrollbar class="space-list-pane__list flex-1 min-h-0">
      <div class="space-list-pane__list-area p-8px" role="list" :aria-label="t('space.title')">
        <Transition name="space-fade" mode="out-in">
          <!-- 1. loading 骨架屏 -->
          <n-flex v-if="loading" vertical :size="8" class="space-list-pane__skeleton" key="skeleton">
            <div v-for="i in 4" :key="i" class="space-list-pane__skeleton-item">
              <n-skeleton circle :width="36" :height="36" :sharp="false" />
              <n-flex vertical :size="4" class="flex-1 min-w-0">
                <n-skeleton height="13px" width="70%" :sharp="false" style="border-radius: 4px" />
                <n-skeleton height="11px" width="40%" :sharp="false" style="border-radius: 4px" />
              </n-flex>
            </div>
          </n-flex>

          <!-- 2. 列表状态 -->
          <div v-else-if="hasVisibleSpaces" class="space-list-pane__sections" key="list">
            <!-- 性能优化：空间列表超过 100 项时启用虚拟滚动（需求文档 16.1） -->
            <template v-if="allFilteredSpaces.length > VIRTUAL_SCROLL_THRESHOLD">
              <RecycleScroller
                class="space-list-pane__virtual-scroller"
                :items="allFilteredSpaces"
                :item-size="64"
                key-field="spaceId"
                role="list"
                :aria-label="t('space.title')"
                v-slot="{ item }">
                <SpaceListItemCard
                  :space="item"
                  :active="selectedSpaceId === item.spaceId"
                  @click="emit('selectSpace', item.spaceId)"
                  @pin="emit('pinSpace', $event)"
                  @settings="emit('spaceSettings', $event)"
                  @leave="emit('leaveSpace', $event)"
                  @delete="emit('deleteSpace', $event)" />
              </RecycleScroller>
            </template>
            <!-- 列表项 ≤ 100 时使用普通 v-for，保留分组结构 -->
            <template v-else>
              <!-- 我的空间分组 -->
              <div v-if="mySpaces.length" class="space-section">
                <div class="space-section__header">
                  <span class="space-section__title">{{ t('space.section_my_spaces') }}</span>
                  <span class="space-section__count">{{ mySpaces.length }}</span>
                </div>
                <div class="space-section__items" role="group">
                  <TransitionGroup name="space-item-enter">
                    <SpaceListItemCard
                      v-for="space in mySpaces"
                      :key="space.spaceId"
                      :space="space"
                      :active="selectedSpaceId === space.spaceId"
                      @click="emit('selectSpace', space.spaceId)"
                      @pin="emit('pinSpace', $event)"
                      @settings="emit('spaceSettings', $event)"
                      @leave="emit('leaveSpace', $event)"
                      @delete="emit('deleteSpace', $event)" />
                  </TransitionGroup>
                </div>
              </div>

              <!-- 公开空间分组 -->
              <div v-if="publicSpaces.length" class="space-section">
                <div class="space-section__header">
                  <span class="space-section__title">{{ t('space.section_public_spaces') }}</span>
                  <span class="space-section__count">{{ publicSpaces.length }}</span>
                </div>
                <div class="space-section__items" role="group">
                  <TransitionGroup name="space-item-enter">
                    <SpaceListItemCard
                      v-for="space in publicSpaces"
                      :key="space.spaceId"
                      :space="space"
                      :active="selectedSpaceId === space.spaceId"
                      @click="emit('selectSpace', space.spaceId)"
                      @pin="emit('pinSpace', $event)"
                      @settings="emit('spaceSettings', $event)"
                      @leave="emit('leaveSpace', $event)"
                      @delete="emit('deleteSpace', $event)" />
                  </TransitionGroup>
                </div>
              </div>
            </template>
          </div>

          <!-- 3. 空状态 / 搜索无结果 -->
          <div v-else class="space-list-pane__empty" key="empty">
            <EmptyState
              :illustration="searchQuery.trim() ? 'no-results' : 'no-spaces'"
              :title="emptyDescription"
              :action-text="searchQuery.trim() ? '' : t('space.create_space_action')"
              @action="emit('createSpace')" />
          </div>
        </Transition>
      </div>
    </n-scrollbar>

    <!-- 底部快捷操作 -->
    <div class="space-list-pane__footer px-12px py-10px">
      <n-flex :size="8">
        <n-button size="small" type="primary" block class="space-list-pane__footer-btn" @click="emit('createSpace')">
          <template #icon>
            <svg class="size-14px"><use href="#add" /></svg>
          </template>
          {{ t('space.create_space_action') }}
        </n-button>
        <n-button size="small" block class="space-list-pane__footer-btn" @click="handleDiscoverSpaces">
          <template #icon>
            <svg class="size-14px"><use href="#search" /></svg>
          </template>
          {{ t('space.discover_spaces_action') }}
        </n-button>
      </n-flex>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { RecycleScroller } from 'vue-virtual-scroller'
import EmptyState from '@/components/common/EmptyState.vue'
import { triggerGlobalSearch } from '@/composables/search/useSearchShortcut'
import SpaceListItemCard from './SpaceListItemCard.vue'

export type SpaceListItem = {
  spaceId: string
  name: string
  childCount: number
  avatarUrl?: string
  topic?: string
  memberCount?: number
  isPinned?: boolean
  isLowPriority?: boolean
  isPublic?: boolean
  unreadCount?: number
  statusText?: string
  statusTone?: 'neutral' | 'info' | 'warning'
  visibilityText?: string
}

type SpaceFilter = 'all' | 'my' | 'public'

/** 列表项超过此阈值时启用虚拟滚动（需求文档 16.1） */
const VIRTUAL_SCROLL_THRESHOLD = 100

const props = defineProps<{
  spaces: SpaceListItem[]
  selectedSpaceId: string
  loading: boolean
}>()

const emit = defineEmits<{
  selectSpace: [spaceId: string]
  pinSpace: [spaceId: string]
  spaceSettings: [spaceId: string]
  leaveSpace: [spaceId: string]
  deleteSpace: [spaceId: string]
  createSpace: []
}>()

const { t } = useI18n()
const router = useRouter()
// 阶段 9：分离 searchInputValue（即时显示）和 searchQuery（防抖后用于过滤）
const searchInputValue = ref('')
const searchQuery = ref('')
const activeFilter = ref<SpaceFilter>('all')

// Step 2.4：发现空间改为路由跳转右侧栏 search 视图（type=space）
const handleDiscoverSpaces = () => {
  void router.push('/search?type=space')
}

// 阶段 9：300ms 防抖触发内联过滤（需求文档 3.3.6）
const debouncedApplySearch = useDebounceFn((value: string) => {
  searchQuery.value = value
}, 300)

const handleSearchChange = (value: string) => {
  debouncedApplySearch(value)
}

// 阶段 9：Esc 清空搜索框并失焦
const handleSearchEsc = () => {
  searchInputValue.value = ''
  searchQuery.value = ''
}

// 阶段 9：点击全局搜索按钮，携带当前关键词跳转 /search
const handleGlobalSearch = () => {
  triggerGlobalSearch(searchInputValue.value)
}

const filterOptions = computed(() => [
  { value: 'all' as const, label: t('space.filter_all') },
  { value: 'my' as const, label: t('space.filter_my') },
  { value: 'public' as const, label: t('space.filter_public') }
])

const filteredSpaces = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  let list = props.spaces

  // 按筛选条件过滤
  if (activeFilter.value === 'my') {
    list = list.filter((s) => !s.isPublic)
  } else if (activeFilter.value === 'public') {
    list = list.filter((s) => s.isPublic)
  }

  // 按搜索关键词过滤
  if (!q) return list
  return list.filter((s: SpaceListItem) => s.name.toLowerCase().includes(q) || s.spaceId.toLowerCase().includes(q))
})

const mySpaces = computed(() => filteredSpaces.value.filter((s: SpaceListItem) => !s.isPublic))
const publicSpaces = computed(() => filteredSpaces.value.filter((s: SpaceListItem) => s.isPublic))
/** 虚拟滚动用：所有筛选后的空间（合并 my + public） */
const allFilteredSpaces = computed(() => [...mySpaces.value, ...publicSpaces.value])

const hasVisibleSpaces = computed(() => {
  if (activeFilter.value === 'my') return mySpaces.value.length > 0
  if (activeFilter.value === 'public') return publicSpaces.value.length > 0
  return filteredSpaces.value.length > 0
})

const emptyDescription = computed(() => {
  if (searchQuery.value.trim()) return t('space.no_results')
  if (activeFilter.value === 'my') return t('space.no_spaces_yet')
  if (activeFilter.value === 'public') return t('space.empty_spaces')
  return t('space.no_spaces_yet')
})
</script>

<style scoped lang="scss">
.space-list-pane {
  width: 300px;
  min-width: 280px;
  max-width: 360px;
  height: 100%;
  background: var(--tjg-surface-panel);
  display: flex;
  flex-direction: column;
}

/* 搜索栏 */
.space-list-pane__search-bar {
  flex-shrink: 0;
  border-bottom: 1px solid var(--tjg-border-default);
}

/* 阶段 9：搜索栏规范（需求文档 3.3.6）—— 高度 40px，圆角 8px，背景 --tjg-surface-search */
.space-list-pane__search {
  :deep(.n-input) {
    --n-height: 40px;
    --n-font-size: 14px;
    --n-border-radius: 8px;
    background: var(--tjg-surface-search);
  }

  :deep(.n-input__input-el) {
    font-size: 14px;
  }
}

.space-list-pane__search-global {
  background: transparent;
  border: 0;
  border-radius: 4px;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  transition:
    background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
    color: var(--tjg-text-primary);
  }
}

/* 筛选条 */
.space-list-pane__filter-bar {
  flex-shrink: 0;
  border-bottom: 1px solid var(--tjg-border-default);
}

.space-list-pane__filter-tabs {
  display: flex;
  gap: 4px;
  background: var(--tjg-surface-search);
  border-radius: 8px;
  padding: 3px;
}

.space-list-pane__filter-tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--tjg-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: var(--tjg-text-primary);
  }

  &--active {
    background: var(--tjg-surface-panel);
    color: var(--tjg-color-primary-500);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }
}

/* 列表区 */
.space-list-pane__list {
  min-height: 0;
}

.space-list-pane__list-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.space-list-pane__sections {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.space-list-pane__virtual-scroller {
  height: 100%;
  min-height: 200px;
}

/* 分组 */
.space-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.space-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 4px;
}

.space-section__title {
  font-size: 11px;
  font-weight: 600;
  color: var(--tjg-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.space-section__count {
  font-size: 11px;
  color: var(--tjg-text-quaternary);
}

.space-section__items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 骨架屏 */
.space-list-pane__skeleton {
  padding: 8px;
}

.space-list-pane__skeleton-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
}

/* 空状态 */
.space-list-pane__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
}

/* 底部快捷操作 */
.space-list-pane__footer {
  flex-shrink: 0;
  border-top: 1px solid var(--tjg-border-default);
  background: var(--tjg-surface-panel);
}

.space-list-pane__footer-btn {
  :deep(.n-button__content) {
    font-weight: 500;
  }
}

/* 过渡动画 */
.space-fade-enter-active,
.space-fade-leave-active {
  transition: opacity 0.2s ease;
}

.space-fade-enter-from,
.space-fade-leave-to {
  opacity: 0;
}

.space-item-enter-enter-active {
  transition: all 0.25s ease;
}

.space-item-enter-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.space-item-enter-leave-active {
  transition: all 0.2s ease;
}

.space-item-enter-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}
</style>
