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
          <svg class="size-16px color-[--tjg-text-tertiary]" aria-hidden="true"><use href="#search" /></svg>
        </template>
        <template #suffix>
          <button
            type="button"
            class="space-list-pane__search-global"
            :aria-label="t('search.title')"
            :title="t('search.title')"
            @click="handleGlobalSearch">
            <svg class="size-16px" aria-hidden="true"><use href="#expand" /></svg>
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

    <!-- 空间列表（骨架屏 / 分组列表 / 空态） -->
    <SpaceListBody
      :loading="loading"
      :my-spaces="mySpaces"
      :public-spaces="publicSpaces"
      :all-filtered-spaces="allFilteredSpaces"
      :has-visible-spaces="hasVisibleSpaces"
      :selected-space-id="selectedSpaceId"
      :empty-description="emptyDescription"
      :is-searching="isSearching"
      @select-space="emit('selectSpace', $event)"
      @pin-space="emit('pinSpace', $event)"
      @space-settings="emit('spaceSettings', $event)"
      @leave-space="emit('leaveSpace', $event)"
      @delete-space="emit('deleteSpace', $event)"
      @create-space="emit('createSpace')" />

    <!-- 底部快捷操作 -->
    <div class="space-list-pane__footer px-12px py-10px">
      <n-flex :size="8">
        <n-button size="small" type="primary" block class="space-list-pane__footer-btn" @click="emit('createSpace')">
          <template #icon>
            <svg class="size-14px" aria-hidden="true"><use href="#add" /></svg>
          </template>
          {{ t('space.create_space_action') }}
        </n-button>
        <n-button size="small" block class="space-list-pane__footer-btn" @click="handleDiscoverSpaces">
          <template #icon>
            <svg class="size-14px" aria-hidden="true"><use href="#search" /></svg>
          </template>
          {{ t('space.discover_spaces_action') }}
        </n-button>
      </n-flex>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { NButton, NFlex, NInput } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { triggerGlobalSearch } from '@/composables/search/useSearchShortcut'
import SpaceListBody from './SpaceListBody.vue'

export type SpaceListItem = {
  spaceId: string
  name: string
  childCount: number
  avatarUrl?: string | undefined
  topic?: string | undefined
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

const isSearching = computed(() => Boolean(searchQuery.value.trim()))

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
  transition:
    color var(--tjg-motion-duration-fast) ease,
    background-color var(--tjg-motion-duration-fast) ease,
    border-color var(--tjg-motion-duration-fast) ease,
    box-shadow var(--tjg-motion-duration-fast) ease,
    opacity var(--tjg-motion-duration-fast) ease,
    transform var(--tjg-motion-duration-fast) ease;

  &:hover {
    color: var(--tjg-text-primary);
  }

  &--active {
    background: var(--tjg-surface-panel);
    color: var(--tjg-color-primary-600);
    box-shadow: var(--tjg-shadow-sm);

    [data-theme='dark'] & {
      color: var(--tjg-color-primary-300);
    }
  }
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
</style>
