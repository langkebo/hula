<template>
  <nav class="friend-list-view" :aria-label="t('friend.list.title')">
    <div v-if="showStatePanel" class="friend-list-view__state" role="status" :aria-busy="isCapabilityLoading">
      <n-spin :show="isCapabilityLoading" class="h-full">
        <EmptyState
          v-if="viewState === 'capability'"
          illustration="server-unavailable"
          :title="t('friend.list.capability_unavailable_title')"
          :description="t('friend.list.capability_unavailable_description')"
          class="mt-40px">
          <template #actions>
            <n-button size="small" @click="handleRetryFriendList">
              {{ t('common.retry') }}
            </n-button>
          </template>
        </EmptyState>
        <EmptyState
          v-else
          illustration="no-results"
          :title="t('common.error')"
          :description="lastFriendError?.message || t('common.error')"
          class="mt-40px">
          <template #actions>
            <n-button size="small" @click="handleRetryFriendList">
              {{ t('common.retry') }}
            </n-button>
          </template>
        </EmptyState>
      </n-spin>
    </div>

    <template v-else>
      <FriendListHeader
        :title="t('friend.list.title')"
        :request-count="incomingRequestsCount"
        :search-value="searchValue"
        :search-history="searchHistory"
        :show-search-history="showSearchHistory"
        :search-placeholder="t('friend.list.search')"
        :filter-value="currentFilter"
        :filter-options="filterOptions"
        :preview-requests="previewIncomingRequests"
        :processing-request="processingRequest"
        :show-search-summary="showSearchSummary"
        :search-summary-text="searchSummaryText"
        :show-search-clear-action="showSearchClearAction"
        :get-filter-count="getFilterCount"
        @update:search-value="searchValue = $event"
        @update:filter-value="handleFilterChange"
        @click:add="handleAddFriend"
        @click:requests="handleViewFriendRequests"
        @search="handleSearch"
        @select-history="handleSelectSearchHistory"
        @clear-history="handleClearSearchHistory"
        @global-search="handleGlobalSearch"
        @clear-active-search="handleClearActiveSearch"
        @quick-accept="handleQuickAccept"
        @quick-reject="handleQuickReject" />

      <n-divider style="margin: 0" />

      <main class="friend-list-view__main" :aria-busy="isCapabilityLoading">
        <n-spin :show="isCapabilityLoading">
          <n-scrollbar style="height: calc(100vh - 200px)">
            <SkeletonFriendList v-if="isLoading" :rows="6" />
            <EmptyState
              v-else-if="showSearchEmptyState"
              illustration="no-results"
              :title="t('friend.search.empty_title')"
              :description="searchEmptyDescription"
              class="mt-40px">
              <template #actions>
                <n-button size="small" @click="handleClearActiveSearch">
                  {{ t('friend.search.clear_current') }}
                </n-button>
              </template>
            </EmptyState>
            <EmptyState
              v-else-if="showEmptyState"
              illustration="no-friends"
              :title="t('friend.list.empty')"
              class="mt-40px">
              <template #actions>
                <n-button size="small" type="primary" @click="handleAddFriend">
                  {{ t('menu.add_contact') }}
                </n-button>
              </template>
            </EmptyState>
            <!-- 性能优化：列表项超过 100 时使用 RecycleScroller 虚拟滚动（需求文档 16.1） -->
            <RecycleScroller
              v-else-if="displayedFriends.length > VIRTUAL_SCROLL_THRESHOLD"
              class="friend-items friend-items--virtual"
              :items="displayedFriends"
              :item-size="76"
              key-field="userId"
              role="list"
              :aria-label="t('friend.list.friend_list_label')"
              v-slot="{ item }">
              <FriendListItem
                :friend="item"
                :selected="item.userId === selectedUserId"
                :query="appliedSearchValue"
                @select="handleSelectFriend"
                @send-message="handleSendMessage"
                @remove="handleRemoveFriend"
                @more="
                  (payload: { friend: MatrixContact; event: MouseEvent }) =>
                    handleContextMenu(payload.event, payload.friend)
                "
                @contextmenu="
                  (payload: { friend: MatrixContact; event: MouseEvent }) =>
                    handleContextMenu(payload.event, payload.friend)
                " />
            </RecycleScroller>
            <!-- 列表项 ≤ 100 时使用普通 v-for，避免虚拟滚动开销 -->
            <div v-else class="friend-items" role="list" :aria-label="t('friend.list.friend_list_label')">
              <FriendListItem
                v-for="friend in displayedFriends"
                :key="friend.userId"
                :friend="friend"
                :selected="friend.userId === selectedUserId"
                :query="appliedSearchValue"
                @select="handleSelectFriend"
                @send-message="handleSendMessage"
                @remove="handleRemoveFriend"
                @more="
                  (payload: { friend: MatrixContact; event: MouseEvent }) =>
                    handleContextMenu(payload.event, payload.friend)
                "
                @contextmenu="
                  (payload: { friend: MatrixContact; event: MouseEvent }) =>
                    handleContextMenu(payload.event, payload.friend)
                " />
            </div>
          </n-scrollbar>
        </n-spin>
      </main>
    </template>

    <ContextMenu ref="contextMenuRef" :menu="contextMenuItems" @select="handleContextMenuSelect" />
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { RecycleScroller } from 'vue-virtual-scroller'
import ContextMenu from '@/components/common/ContextMenu.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonFriendList from '@/components/common/SkeletonFriendList.vue'
import { triggerGlobalSearch } from '@/composables/search/useSearchShortcut'
import { useServerCapability } from '@/services/matrix/MatrixCapabilityService'
import { type MatrixContact, useContactStore } from '@/stores/domains/chat/contacts'
import { useFriendContextMenu } from './composables/useFriendContextMenu'
import { useFriendFilters } from './composables/useFriendFilters'
import { useFriendRequests } from './composables/useFriendRequests'
import { useFriendSearch } from './composables/useFriendSearch'
import FriendListHeader from './FriendListHeader.vue'
import FriendListItem from './FriendListItem.vue'
import { resolveFriendListViewState } from './friendListViewState'

/** 列表项超过此阈值时启用虚拟滚动（需求文档 16.1） */
const VIRTUAL_SCROLL_THRESHOLD = 100

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const contactStore = useContactStore()
const { isLoaded, canUseFriendList } = useServerCapability()

const contextMenuRef = ref()

// 筛选状态与已筛选（不含搜索关键词）列表
const { currentFilter, filterOptions, filteredFriends, getFilterCount, handleFilterChange } = useFriendFilters()

// 视图级状态
const isLoading = computed(() => contactStore.isLoading)
const isCapabilityLoading = computed(() => !isLoaded.value)
const incomingRequestsCount = computed(() => contactStore.incomingRequestsCount)
const lastFriendError = computed(() => contactStore.lastFriendError)

const viewState = computed(() =>
  resolveFriendListViewState({
    isCapabilityReady: isLoaded.value,
    canUseFriendList: canUseFriendList.value,
    hasError: Boolean(lastFriendError.value),
    hasFriends: contactStore.contactsList.length > 0
  })
)

const showStatePanel = computed(() => viewState.value === 'capability' || viewState.value === 'error')

// 搜索状态与展示列表（在已筛选列表上叠加搜索过滤）
const {
  searchValue,
  appliedSearchValue,
  hasSearchKeyword,
  showSearchHistory,
  searchHistory,
  displayedFriends,
  showSearchSummary,
  searchSummaryText,
  showSearchClearAction,
  searchEmptyDescription,
  handleSearch,
  handleSelectSearchHistory,
  handleClearSearchHistory,
  handleClearActiveSearch
} = useFriendSearch({ filteredFriends, currentFilter, showStatePanel })

const showSearchEmptyState = computed(
  () =>
    displayedFriends.value.length === 0 &&
    hasSearchKeyword.value &&
    viewState.value !== 'error' &&
    viewState.value !== 'capability'
)
const showEmptyState = computed(
  () =>
    displayedFriends.value.length === 0 &&
    !hasSearchKeyword.value &&
    viewState.value !== 'error' &&
    viewState.value !== 'capability'
)

// 右键菜单与好友操作
const { contextMenuItems, handleContextMenu, handleContextMenuSelect, handleSendMessage, handleRemoveFriend } =
  useFriendContextMenu({ contextMenuRef })

// 好友请求预览与快捷操作
const { processingRequest, previewIncomingRequests, handleQuickAccept, handleQuickReject } = useFriendRequests()

// 路由驱动详情视图，selectedUserId 从路由参数派生
const selectedUserId = computed(() => (route.params.userId as string | undefined) ?? '')

const handleSelectFriend = (friend: MatrixContact) => {
  void router.push({ name: 'friend-details', params: { userId: friend.userId } })
}

const handleAddFriend = () => {
  void router.push({ name: 'friend-add' })
}

const handleViewFriendRequests = () => {
  void router.push({ name: 'friend-requests' })
}

const handleGlobalSearch = (value: string) => {
  triggerGlobalSearch(value)
}

const handleRetryFriendList = async () => {
  await contactStore.initialize()
}

onMounted(async () => {
  await contactStore.initialize()
})
</script>

<style scoped lang="scss">
.friend-list-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.friend-list-view__main {
  flex: 1;
  min-height: 0;
}

.friend-list-view__state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.friend-items {
  padding: 8px;
  margin: 0;
  list-style: none;
}

.friend-items--virtual {
  height: 100%;
}
</style>
