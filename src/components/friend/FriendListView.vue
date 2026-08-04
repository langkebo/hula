<template>
  <nav class="friend-list-view" :aria-label="t('friend.list.title')">
    <div v-if="showStatePanel" class="friend-list-view__state" role="status" :aria-busy="isCapabilityLoading">
      <n-spin :show="isCapabilityLoading" class="h-full">
        <n-empty
          v-if="viewState === 'capability'"
          :description="t('friend.list.capability_unavailable_description')"
          size="large">
          <template #extra>
            <span class="friend-list-view__state-title">
              {{ t('friend.list.capability_unavailable_title') }}
            </span>
          </template>
        </n-empty>
        <n-empty v-else :description="lastFriendError?.message || t('common.error')" size="large">
          <template #extra>
            <n-flex vertical align="center" :size="12">
              <span class="friend-list-view__state-title">{{ t('common.error') }}</span>
              <n-button size="small" @click="handleRetryFriendList">
                {{ t('common.retry') }}
              </n-button>
            </n-flex>
          </template>
        </n-empty>
      </n-spin>
    </div>

    <template v-else>
      <header class="friend-list-view__header p-12px">
        <n-flex vertical :size="12">
          <n-flex align="center" justify="space-between">
            <n-flex align="center" :size="8">
              <span class="text-[var(--text-base)] font-semibold">{{ t('friend.list.title') }}</span>
              <n-badge :value="incomingRequestsCount" :max="99" :show="incomingRequestsCount > 0" />
            </n-flex>
            <n-flex :size="8">
              <n-button quaternary circle size="small" :aria-label="t('menu.add_contact')" @click="handleAddFriend">
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
                :aria-label="t('friend.list.pending_requests', { count: incomingRequestsCount })"
                @click="handleViewFriendRequests">
                <template #icon>
                  <n-icon>
                    <svg><use href="#bell" /></svg>
                  </n-icon>
                </template>
              </n-button>
            </n-flex>
          </n-flex>

          <!-- 待处理好友请求预览区域 -->
          <div v-if="incomingRequestsCount > 0" class="friend-request-preview">
            <n-flex align="center" justify="space-between" class="mb-8px">
              <n-flex align="center" :size="6">
                <svg class="size-14px color-[--tjg-color-primary-500]"><use href="#bell" /></svg>
                <span class="text-[var(--text-sm)] font-medium color-[--tjg-color-primary-500]">
                  {{ t('friend.list.pending_requests', { count: incomingRequestsCount }) }}
                </span>
              </n-flex>
              <n-button text size="tiny" type="primary" @click="handleViewFriendRequests">
                {{ t('friend.list.view_all') }}
              </n-button>
            </n-flex>
            <div class="friend-request-preview__list">
              <FriendRequestCard
                v-for="request in previewIncomingRequests"
                :key="request.userId"
                :request="request"
                :processing="processingRequest === request.userId"
                @accept="handleQuickAccept"
                @reject="handleQuickReject" />
            </div>
          </div>

          <FriendSearchBar
            v-model="searchValue"
            :history="searchHistory"
            :show-history="showSearchHistory"
            :show-global-search-action="true"
            :placeholder="t('friend.list.search')"
            @search="handleSearch"
            @select-history="handleSelectSearchHistory"
            @clear-history="handleClearSearchHistory"
            @global-search="handleGlobalSearch" />
        </n-flex>

        <div v-if="showSearchSummary" class="friend-list-view__search-summary" aria-live="polite">
          <span>{{ searchSummaryText }}</span>
          <button
            v-if="showSearchClearAction"
            type="button"
            class="friend-list-view__search-clear"
            @click="handleClearActiveSearch">
            {{ t('friend.search.clear_current') }}
          </button>
        </div>

        <n-flex :size="4" class="mt-12px">
          <n-button
            v-for="filter in filterOptions"
            :key="filter.value"
            :type="currentFilter === filter.value ? 'primary' : 'default'"
            size="tiny"
            quaternary
            :aria-pressed="currentFilter === filter.value"
            @click="handleFilterChange(filter.value)">
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
              v-else-if="filteredFriends.length > VIRTUAL_SCROLL_THRESHOLD"
              class="friend-items friend-items--virtual"
              :items="filteredFriends"
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
                v-for="friend in filteredFriends"
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
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAriaLive } from '@/composables/common/useAriaLive'
import { useRecentSearchHistory } from '@/composables/common/useRecentSearchHistory'
import { useSearchFeedbackSummary } from '@/composables/common/useSearchFeedbackSummary'
import { triggerGlobalSearch } from '@/composables/search/useSearchShortcut'
import { OnlineEnum } from '@/enums'
import { matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { matrixSpecialFriendService } from '@/services/matrix/friends/MatrixSpecialFriendService'
import { useServerCapability } from '@/services/matrix/MatrixCapabilityService'
import { type FriendRequestItem, type MatrixContact, useContactStore } from '@/stores/domains/chat/contacts'
import type { FriendStatus } from '@/types/matrix-services'
import FriendListItem from './FriendListItem.vue'
import FriendRequestCard from './FriendRequestCard.vue'
import FriendSearchBar from './FriendSearchBar.vue'
import { resolveFriendListViewState } from './friendListViewState'

const FRIEND_SEARCH_HISTORY_STORAGE_KEY = 'tjg-friend-search-history'
/** 列表项超过此阈值时启用虚拟滚动（需求文档 16.1） */
const VIRTUAL_SCROLL_THRESHOLD = 100

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { announce } = useAriaLive()
const { showFeedback } = useActionFeedback()
const contactStore = useContactStore()
const { isLoaded, canUseFriendList } = useServerCapability()
const {
  historyValues: searchHistory,
  rememberTerm,
  clearHistory: clearSearchHistory
} = useRecentSearchHistory(FRIEND_SEARCH_HISTORY_STORAGE_KEY)

const searchValue = ref('')
const appliedSearchValue = ref('')
const isSearchPending = ref(false)
const currentFilter = ref<FriendStatus | 'all'>('all')
const contextMenuRef = ref()
const selectedFriend = ref<MatrixContact | null>(null)
const processingRequest = ref<string | null>(null)

const isLoading = computed(() => contactStore.isLoading)
const isCapabilityLoading = computed(() => !isLoaded.value)
const incomingRequestsCount = computed(() => contactStore.incomingRequestsCount)
const lastFriendError = computed(() => contactStore.lastFriendError)
const hasSearchKeyword = computed(() => appliedSearchValue.value.trim().length > 0)
const showSearchHistory = computed(
  () => !isLoading.value && !showStatePanel.value && !searchValue.value.trim() && searchHistory.value.length > 0
)

// 预览区域最多显示3条好友请求
const previewIncomingRequests = computed(() =>
  contactStore.requestFriendsList.filter((r) => r.direction === 'incoming').slice(0, 3)
)

// 快速接受好友请求
const handleQuickAccept = async (request: FriendRequestItem) => {
  if (!request.userId) return
  processingRequest.value = request.userId
  try {
    await contactStore.acceptFriendRequest(request.userId)
    showFeedback(t('friend.request.success.accept'), 'success')
  } catch {
    showFeedback(t('friend.request.error.accept'), 'error')
  } finally {
    processingRequest.value = null
  }
}

// 快速拒绝好友请求
const handleQuickReject = async (request: FriendRequestItem) => {
  if (!request.userId) return
  processingRequest.value = request.userId
  try {
    await contactStore.rejectFriendRequest(request.userId)
    showFeedback(t('friend.request.success.reject'), 'success')
  } catch {
    showFeedback(t('friend.request.error.reject'), 'error')
  } finally {
    processingRequest.value = null
  }
}

watch(incomingRequestsCount, (count, prevCount) => {
  if (count > (prevCount || 0)) {
    announce(t('friend.list.new_request_announcement', { count: count }), 'assertive')
  }
})

const filterOptions = computed(() => [
  { value: 'all' as const, label: t('friend.filter.all') },
  { value: 'favorite' as FriendStatus, label: t('friend.filter.favorite') },
  { value: 'normal' as FriendStatus, label: t('friend.filter.normal') },
  { value: 'blocked' as FriendStatus, label: t('friend.filter.blocked') },
  { value: 'hidden' as FriendStatus, label: t('friend.filter.hidden') }
])

const normalizeFriendStatus = (status?: FriendStatus) => {
  if (status === 'accepted') {
    return 'normal'
  }

  return status
}

const filteredFriends = computed(() => {
  let friends =
    currentFilter.value === 'all'
      ? [...contactStore.contactsList]
      : contactStore.contactsList.filter((f) => normalizeFriendStatus(f.friendStatus) === currentFilter.value)

  if (appliedSearchValue.value.trim()) {
    const query = appliedSearchValue.value.toLowerCase()
    friends = friends.filter(
      (f) =>
        f.userId.toLowerCase().includes(query) ||
        f.displayName?.toLowerCase().includes(query) ||
        f.name.toLowerCase().includes(query) ||
        f.remark?.toLowerCase().includes(query)
    )
  }

  return friends.sort((a, b) => {
    if (a.friendStatus === 'favorite' && b.friendStatus !== 'favorite') return -1
    if (a.friendStatus !== 'favorite' && b.friendStatus === 'favorite') return 1
    if (a.activeStatus === OnlineEnum.ONLINE && b.activeStatus !== OnlineEnum.ONLINE) return -1
    if (a.activeStatus !== OnlineEnum.ONLINE && b.activeStatus === OnlineEnum.ONLINE) return 1
    return 0
  })
})

const getFilterCount = (status: FriendStatus) => {
  return contactStore.contactsList.filter((f) => normalizeFriendStatus(f.friendStatus) === status).length
}

const viewState = computed(() =>
  resolveFriendListViewState({
    isCapabilityReady: isLoaded.value,
    canUseFriendList: canUseFriendList.value,
    hasError: Boolean(lastFriendError.value),
    hasFriends: contactStore.contactsList.length > 0
  })
)

const showStatePanel = computed(() => viewState.value === 'capability' || viewState.value === 'error')
const {
  showSummary: showSearchSummary,
  showClearAction: showSearchClearAction,
  summaryText: searchSummaryText,
  emptyDescription: searchEmptyDescription
} = useSearchFeedbackSummary({
  searchValue,
  appliedSearchValue,
  isSearching: isSearchPending,
  resultCount: () => filteredFriends.value.length,
  showSummaryWhen: () =>
    !showStatePanel.value && (isSearchPending.value || hasSearchKeyword.value || currentFilter.value !== 'all'),
  showClearActionWhen: () => Boolean(searchValue.value || currentFilter.value !== 'all'),
  searchingText: () => t('friend.search.searching'),
  announce,
  getIdleSummaryText: () => {
    if (hasSearchKeyword.value) {
      return t('friend.search.result_count', {
        count: filteredFriends.value.length,
        keyword: appliedSearchValue.value
      })
    }

    if (currentFilter.value !== 'all') {
      return t('friend.search.filter_result_count', {
        count: filteredFriends.value.length,
        filter: t(`friend.filter.${currentFilter.value}`)
      })
    }

    return ''
  },
  getResultAnnouncementText: () =>
    t('friend.search.result_count', {
      count: filteredFriends.value.length,
      keyword: appliedSearchValue.value
    }),
  getEmptyAnnouncementText: () =>
    t('friend.search.empty_description', {
      keyword: appliedSearchValue.value
    }),
  getEmptyDescription: () =>
    t('friend.search.empty_description', {
      keyword: appliedSearchValue.value
    })
})
const showSearchEmptyState = computed(
  () =>
    filteredFriends.value.length === 0 &&
    hasSearchKeyword.value &&
    viewState.value !== 'error' &&
    viewState.value !== 'capability'
)
const showEmptyState = computed(
  () =>
    filteredFriends.value.length === 0 &&
    !hasSearchKeyword.value &&
    viewState.value !== 'error' &&
    viewState.value !== 'capability'
)

const handleFilterChange = (filter: FriendStatus | 'all') => {
  currentFilter.value = filter
}

const applySearch = (value: string, options?: { remember?: boolean }) => {
  const normalizedValue = value.trim()
  appliedSearchValue.value = normalizedValue
  isSearchPending.value = false

  if (options?.remember !== false) {
    rememberTerm(normalizedValue)
  }
}

const handleSearch = (value: string) => {
  applySearch(value)
}

const handleSelectSearchHistory = (value: string) => {
  searchValue.value = value
  applySearch(value)
}

const handleClearSearchHistory = () => {
  clearSearchHistory()
}

const handleClearActiveSearch = () => {
  searchValue.value = ''
  appliedSearchValue.value = ''
  isSearchPending.value = false
}

watch(searchValue, (value) => {
  isSearchPending.value = value.trim() !== appliedSearchValue.value.trim()
})

const handleRetryFriendList = async () => {
  await contactStore.initialize()
}

// 阶段 2：路由驱动详情视图，selectedUserId 从路由参数派生
const selectedUserId = computed(() => (route.params.userId as string | undefined) ?? '')

const handleSelectFriend = (friend: MatrixContact) => {
  // 路由跳转后由 useRightView 派生 details 视图
  void router.push({ name: 'friend-details', params: { userId: friend.userId } })
}

// FriendListItem 发送消息按钮：复用 handleContextMenuSelect 中的发送消息逻辑
const handleSendMessage = async (friend: MatrixContact) => {
  const dmInfo = await matrixFriendService.getFriendDmRoom(friend.userId)
  if (dmInfo.room_id) {
    const { openMsgSessionByRoomId } = await import('@/composables/chat/openMsgSession')
    await openMsgSessionByRoomId(dmInfo.room_id)
  } else {
    const roomId = await contactStore.startDirectRoom(friend.userId, false)
    if (roomId) {
      const { openMsgSessionByRoomId } = await import('@/composables/chat/openMsgSession')
      await openMsgSessionByRoomId(roomId)
    }
  }
}

// FriendListItem 移除好友按钮：复用 handleContextMenuSelect 中的移除逻辑
const handleRemoveFriend = async (friend: MatrixContact) => {
  await contactStore.removeFromContacts(friend.userId)
}

// 阶段 4：触发添加好友 / 好友申请列表，路由驱动右侧栏视图
const handleAddFriend = () => {
  void router.push({ name: 'friend-add' })
}

const handleViewFriendRequests = () => {
  void router.push({ name: 'friend-requests' })
}

// 阶段 3：点击搜索栏全局搜索按钮，携带当前关键词跳转到 /search
const handleGlobalSearch = (value: string) => {
  triggerGlobalSearch(value)
}

const contextMenuItems = computed(() => {
  const items = [
    { label: t('friend.context.send_message'), icon: 'message' },
    { label: t('friend.context.encrypted_chat'), icon: 'lock' },
    { label: t('friend.context.secret_chat'), icon: 'eye-close' },
    { label: 'divider', icon: '' },
    { label: t('friend.context.set_note'), icon: 'edit' },
    { label: t('friend.context.set_display_name'), icon: 'tag' },
    { label: 'divider', icon: '' },
    { label: t('friend.context.set_favorite'), icon: 'star' },
    { label: t('friend.context.set_normal'), icon: 'user' },
    { label: t('friend.context.set_blocked'), icon: 'block' },
    { label: 'divider', icon: '' },
    { label: t('friend.context.remove'), icon: 'delete' }
  ]
  return items
})

const handleContextMenu = (event: MouseEvent, friend: MatrixContact) => {
  event.preventDefault()
  selectedFriend.value = friend
  contextMenuRef.value?.show(event)
}

const handleContextMenuSelect = async (item: { label: string }) => {
  if (!selectedFriend.value) return

  const friend = selectedFriend.value

  switch (item.label) {
    case t('friend.context.send_message'): {
      const dmInfo = await matrixFriendService.getFriendDmRoom(friend.userId)
      if (dmInfo.room_id) {
        const { openMsgSessionByRoomId } = await import('@/composables/chat/openMsgSession')
        await openMsgSessionByRoomId(dmInfo.room_id)
      } else {
        const roomId = await contactStore.startDirectRoom(friend.userId, false)
        if (roomId) {
          const { openMsgSessionByRoomId } = await import('@/composables/chat/openMsgSession')
          await openMsgSessionByRoomId(roomId)
        }
      }
      break
    }
    case t('friend.context.encrypted_chat'): {
      const roomId = await contactStore.startDirectRoom(friend.userId, true)
      if (roomId) {
        const { openMsgSessionByRoomId } = await import('@/composables/chat/openMsgSession')
        await openMsgSessionByRoomId(roomId)
      }
      break
    }
    case t('friend.context.secret_chat'):
      await handleSetSecretFriend(friend)
      break
    case t('friend.context.set_note'):
      await handleSetNote(friend)
      break
    case t('friend.context.set_display_name'):
      await handleSetDisplayName(friend)
      break
    case t('friend.context.set_favorite'):
      await contactStore.setFriendStatus(friend.userId, 'favorite')
      break
    case t('friend.context.set_normal'):
      await contactStore.setFriendStatus(friend.userId, 'accepted')
      break
    case t('friend.context.set_blocked'):
      await contactStore.setFriendStatus(friend.userId, 'blocked')
      break
    case t('friend.context.remove'):
      await contactStore.removeFromContacts(friend.userId)
      break
  }

  selectedFriend.value = null
}

const handleSetSecretFriend = async (friend: MatrixContact) => {
  try {
    await matrixSpecialFriendService.addSpecialFriend(friend.userId)
    showFeedback(t('friend.secret_chat.success'), 'success')
  } catch (e) {
    showFeedback(String(e), 'error')
  }
}

const handleSetNote = async (friend: MatrixContact) => {
  window.$dialog?.create({
    title: t('friend.context.set_note'),
    content: () =>
      h('div', { style: 'padding: 8px 0' }, [
        h('input', {
          id: 'friend-note-input',
          value: friend.note ?? friend.remark ?? '',
          placeholder: t('friend.detail.note_placeholder'),
          style:
            'width: 100%; padding: 8px 12px; border: 1px solid var(--tjg-border-default); border-radius: 6px; font-size: 14px; outline: none; background: var(--tjg-surface-panel); color: inherit;',
          maxlength: 1000
        })
      ]),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const input = document.querySelector('#friend-note-input') as HTMLInputElement
      const note = input?.value?.trim() ?? ''
      if (note) {
        await contactStore.setFriendNote(friend.userId, note)
      }
    }
  })
}

const handleSetDisplayName = async (friend: MatrixContact) => {
  window.$dialog?.create({
    title: t('friend.context.set_display_name'),
    content: () =>
      h('div', { style: 'padding: 8px 0' }, [
        h('input', {
          id: 'friend-displayname-input',
          value: friend.remark ?? friend.displayName ?? '',
          placeholder: t('friend.detail.display_name_placeholder'),
          style:
            'width: 100%; padding: 8px 12px; border: 1px solid var(--tjg-border-default); border-radius: 6px; font-size: 14px; outline: none; background: var(--tjg-surface-panel); color: inherit;',
          maxlength: 256
        })
      ]),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const input = document.querySelector('#friend-displayname-input') as HTMLInputElement
      const name = input?.value?.trim() ?? ''
      await contactStore.setFriendDisplayName(friend.userId, name)
    }
  })
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

.friend-list-view__header {
  flex-shrink: 0;
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

.friend-list-view__state-title {
  font-size: 14px;
  color: var(--tjg-text-primary);
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

.friend-items {
  padding: 8px;
  margin: 0;
  list-style: none;
}

.friend-items--virtual {
  height: 100%;
}
</style>
