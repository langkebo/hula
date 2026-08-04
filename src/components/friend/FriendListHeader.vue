<template>
  <header class="friend-list-view__header p-12px">
    <n-flex vertical :size="12">
      <n-flex align="center" justify="space-between">
        <n-flex align="center" :size="8">
          <span class="text-[var(--text-base)] font-semibold">{{ title }}</span>
          <n-badge :value="requestCount" :max="99" :show="requestCount > 0" />
        </n-flex>
        <n-flex :size="8">
          <n-button quaternary circle size="small" :aria-label="t('menu.add_contact')" @click="$emit('click:add')">
            <template #icon>
              <n-icon>
                <svg><use href="#plus" /></svg>
              </n-icon>
            </template>
          </n-button>
          <n-button
            quaternary
            circle
            size="small"
            :aria-label="t('friend.list.pending_requests', { count: requestCount })"
            @click="$emit('click:requests')">
            <template #icon>
              <n-icon>
                <svg><use href="#bell" /></svg>
              </n-icon>
            </template>
          </n-button>
        </n-flex>
      </n-flex>

      <!-- 待处理好友请求预览区域 -->
      <div v-if="requestCount > 0" class="friend-request-preview">
        <n-flex align="center" justify="space-between" class="mb-8px">
          <n-flex align="center" :size="6">
            <svg class="size-14px color-[--tjg-color-primary-500]"><use href="#bell" /></svg>
            <span class="text-[var(--text-sm)] font-medium color-[--tjg-color-primary-500]">
              {{ t('friend.list.pending_requests', { count: requestCount }) }}
            </span>
          </n-flex>
          <n-button text size="tiny" type="primary" @click="$emit('click:requests')">
            {{ t('friend.list.view_all') }}
          </n-button>
        </n-flex>
        <div class="friend-request-preview__list">
          <FriendRequestCard
            v-for="request in previewRequests"
            :key="request.userId"
            :request="request"
            :processing="processingRequest === request.userId"
            @accept="$emit('quick-accept', $event)"
            @reject="$emit('quick-reject', $event)" />
        </div>
      </div>

      <FriendSearchBar
        :model-value="searchValue"
        :history="searchHistory"
        :show-history="showSearchHistory"
        :show-global-search-action="true"
        :placeholder="searchPlaceholder"
        @update:model-value="$emit('update:searchValue', $event)"
        @search="$emit('search', $event)"
        @select-history="$emit('select-history', $event)"
        @clear-history="$emit('clear-history')"
        @global-search="$emit('global-search', $event)" />
    </n-flex>

    <div v-if="showSearchSummary" class="friend-list-view__search-summary" aria-live="polite">
      <span>{{ searchSummaryText }}</span>
      <button
        v-if="showSearchClearAction"
        type="button"
        class="friend-list-view__search-clear"
        @click="$emit('clear-active-search')">
        {{ t('friend.search.clear_current') }}
      </button>
    </div>

    <n-flex :size="4" class="mt-12px">
      <n-button
        v-for="filter in filterOptions"
        :key="filter.value"
        data-test="filter-button"
        :type="filterValue === filter.value ? 'primary' : 'default'"
        size="tiny"
        quaternary
        :aria-pressed="filterValue === filter.value"
        @click="$emit('update:filterValue', filter.value)">
        {{ filter.label }}
        <n-badge
          v-if="filter.value !== 'all'"
          :value="getFilterCount(filter.value)"
          :max="99"
          :show="getFilterCount(filter.value) > 0"
          type="info"
          class="ml-4px" />
      </n-button>
    </n-flex>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { FriendRequestItem } from '@/stores/domains/chat/contacts'
import type { FriendStatus } from '@/types/matrix-services'
import FriendRequestCard from './FriendRequestCard.vue'
import FriendSearchBar from './FriendSearchBar.vue'

defineProps<{
  title: string
  requestCount: number
  searchValue: string
  searchHistory: string[]
  showSearchHistory: boolean
  searchPlaceholder: string
  filterValue: FriendStatus | 'all'
  filterOptions: Array<{ label: string; value: FriendStatus | 'all' }>
  /** 待处理好友请求预览列表（最多 3 条） */
  previewRequests: FriendRequestItem[]
  /** 当前正在处理的好友请求 userId（用于禁用按钮/loading 状态） */
  processingRequest: string | null
  /** 是否显示搜索结果摘要条 */
  showSearchSummary: boolean
  /** 搜索结果摘要文本 */
  searchSummaryText: string
  /** 是否显示"清除当前搜索"按钮 */
  showSearchClearAction: boolean
  /** 计算指定筛选状态下的好友数量 */
  getFilterCount: (status: FriendStatus | 'all') => number
}>()

defineEmits<{
  'update:searchValue': [value: string]
  'update:filterValue': [value: FriendStatus | 'all']
  'click:add': []
  'click:requests': []
  search: [value: string]
  'select-history': [value: string]
  'clear-history': []
  'global-search': [value: string]
  'clear-active-search': []
  'quick-accept': [request: FriendRequestItem]
  'quick-reject': [request: FriendRequestItem]
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.friend-list-view__header {
  flex-shrink: 0;
}

.friend-list-view__search-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--tjg-text-tertiary);
  margin-top: 8px;
}

.friend-list-view__search-clear {
  border: none;
  background: transparent;
  color: var(--tjg-color-primary-500);
  cursor: pointer;
  padding: 0;
}

.friend-request-preview {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--tjg-color-primary-50);
  border: 1px solid var(--tjg-color-primary-100);
}

.friend-request-preview__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
