<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('friend.request.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="true"
    class="friend-request-dialog"
    style="width: 400px; max-width: 90vw">
    <FriendSearchBar
      v-model="searchValue"
      :history="searchHistory"
      :show-history="showSearchHistory"
      :placeholder="t('friend.request.search')"
      @search="handleSearch"
      @select-history="handleSelectHistory"
      @clear-history="handleClearSearchHistory" />
    <div v-if="showSearchSummary" class="friend-request-dialog__search-summary">
      <span>{{ searchSummaryText }}</span>
      <button
        v-if="showSearchClearAction"
        type="button"
        class="friend-request-dialog__search-clear"
        @click="handleClearActiveSearch">
        {{ t('friend.search.clear_current') }}
      </button>
    </div>
    <n-tabs v-model:value="activeTab" type="line" animated>
      <n-tab-pane name="incoming" :tab="t('friend.request.incoming')">
        <template #tab>
          <n-badge :value="incomingRequests.length" :max="99" :show="incomingRequests.length > 0">
            <span>{{ t('friend.request.incoming') }}</span>
          </n-badge>
        </template>
        <n-scrollbar style="max-height: 400px">
          <n-empty
            v-if="filteredIncomingRequests.length === 0"
            :description="hasSearchKeyword ? searchEmptyDescription : t('friend.request.empty.incoming')" />
          <div v-else class="request-list">
            <div v-for="request in filteredIncomingRequests" :key="request.userId" class="request-item">
              <n-flex align="center" :size="12">
                <n-avatar
                  :size="48"
                  :src="AvatarUtils.getAvatarUrl(request.avatarUrl)"
                  :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                  round />
                <div class="flex flex-col flex-1 min-w-0">
                  <span class="text-14px font-medium truncate">{{ request.displayName || request.userId }}</span>
                  <span class="text-12px text-[--hula-text-tertiary]">@{{ request.userId }}</span>
                  <span v-if="request.message" class="text-12px text-[--hula-text-quaternary] truncate">
                    {{ request.message }}
                  </span>
                </div>
              </n-flex>
              <n-flex :size="8" class="mt-8px">
                <n-button
                  type="primary"
                  size="small"
                  :loading="processing === request.userId"
                  @click="handleAccept(request)">
                  {{ t('friend.request.accept') }}
                </n-button>
                <n-button size="small" :loading="processing === request.userId" @click="handleReject(request)">
                  {{ t('friend.request.reject') }}
                </n-button>
              </n-flex>
            </div>
          </div>
        </n-scrollbar>
      </n-tab-pane>

      <n-tab-pane name="outgoing" :tab="t('friend.request.outgoing')">
        <n-scrollbar style="max-height: 400px">
          <n-empty
            v-if="filteredOutgoingRequests.length === 0"
            :description="hasSearchKeyword ? searchEmptyDescription : t('friend.request.empty.outgoing')" />
          <div v-else class="request-list">
            <div v-for="request in filteredOutgoingRequests" :key="request.userId" class="request-item">
              <n-flex align="center" :size="12">
                <n-avatar
                  :size="48"
                  :src="AvatarUtils.getAvatarUrl(request.avatarUrl)"
                  :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                  round />
                <div class="flex flex-col flex-1 min-w-0">
                  <span class="text-14px font-medium truncate">{{ request.displayName || request.userId }}</span>
                  <span class="text-12px text-[--hula-text-tertiary]">@{{ request.userId }}</span>
                  <span v-if="request.message" class="text-12px text-[--hula-text-quaternary] truncate">
                    {{ request.message }}
                  </span>
                </div>
              </n-flex>
              <n-flex :size="8" class="mt-8px">
                <n-button size="small" :loading="processing === request.userId" @click="handleCancel(request)">
                  {{ t('friend.request.cancel') }}
                </n-button>
              </n-flex>
            </div>
          </div>
        </n-scrollbar>
      </n-tab-pane>
    </n-tabs>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAriaLive } from '@/composables/common/useAriaLive'
import { useRecentSearchHistory } from '@/composables/common/useRecentSearchHistory'
import { useSearchFeedbackSummary } from '@/composables/common/useSearchFeedbackSummary'
import { ThemeEnum } from '@/enums'
import { type FriendRequestItem, useContactStore } from '@/stores/domains/chat/contacts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'
import FriendSearchBar from './FriendSearchBar.vue'

const FRIEND_REQUEST_SEARCH_HISTORY_STORAGE_KEY = 'hula-friend-request-search-history'
const { t } = useI18n()
const { announce } = useAriaLive()
const { showFeedback } = useActionFeedback()
const contactStore = useContactStore()
const settingStore = useSettingStore()
const {
  historyValues: searchHistory,
  rememberTerm,
  clearHistory: clearSearchHistory
} = useRecentSearchHistory(FRIEND_REQUEST_SEARCH_HISTORY_STORAGE_KEY)

const visible = defineModel<boolean>('show', { default: false })
const activeTab = ref<'incoming' | 'outgoing'>('incoming')
const processing = ref<string | null>(null)
const searchValue = ref('')
const appliedSearchValue = ref('')
const isSearchPending = ref(false)

const incomingRequests = computed(() => contactStore.requestFriendsList.filter((r) => r.direction === 'incoming'))

const outgoingRequests = computed(() => contactStore.requestFriendsList.filter((r) => r.direction === 'outgoing'))
const showSearchHistory = computed(
  () => Boolean(visible.value) && !searchValue.value.trim() && searchHistory.value.length > 0
)

const matchesRequestSearch = (request: FriendRequestItem) => {
  const query = appliedSearchValue.value.trim().toLowerCase()
  if (!query) {
    return true
  }

  return [request.userId, request.displayName, request.message]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => value.toLowerCase().includes(query))
}

const filteredIncomingRequests = computed(() => incomingRequests.value.filter(matchesRequestSearch))
const filteredOutgoingRequests = computed(() => outgoingRequests.value.filter(matchesRequestSearch))
const totalMatchedRequestCount = computed(
  () => filteredIncomingRequests.value.length + filteredOutgoingRequests.value.length
)

const {
  hasSearchKeyword,
  showSummary: showSearchSummary,
  showClearAction: showSearchClearAction,
  summaryText: searchSummaryText,
  emptyDescription: searchEmptyDescription
} = useSearchFeedbackSummary({
  searchValue,
  appliedSearchValue,
  isSearching: isSearchPending,
  resultCount: totalMatchedRequestCount,
  searchingText: () => t('friend.search.searching'),
  announce,
  getIdleSummaryText: () => {
    if (!appliedSearchValue.value.trim()) {
      return ''
    }

    return t('friend.request.result_count', {
      count: totalMatchedRequestCount.value,
      keyword: appliedSearchValue.value
    })
  },
  getResultAnnouncementText: () =>
    t('friend.request.result_count', {
      count: totalMatchedRequestCount.value,
      keyword: appliedSearchValue.value
    }),
  getEmptyAnnouncementText: () => t('friend.request.empty.search'),
  getEmptyDescription: () => t('friend.request.empty.search')
})

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

const handleSelectHistory = (value: string) => {
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

const handleAccept = async (request: FriendRequestItem) => {
  if (!request.userId) return
  processing.value = request.userId
  try {
    await contactStore.acceptFriendRequest(request.userId)
    showFeedback(t('friend.request.success.accept'), 'success')
  } catch {
    showFeedback(t('friend.request.error.accept'), 'error')
  } finally {
    processing.value = null
  }
}

const handleReject = async (request: FriendRequestItem) => {
  if (!request.userId) return
  processing.value = request.userId
  try {
    await contactStore.rejectFriendRequest(request.userId)
    showFeedback(t('friend.request.success.reject'), 'success')
  } catch {
    showFeedback(t('friend.request.error.reject'), 'error')
  } finally {
    processing.value = null
  }
}

const handleCancel = async (request: FriendRequestItem) => {
  if (!request.userId) return
  processing.value = request.userId
  try {
    await contactStore.cancelFriendRequest(request.userId)
    showFeedback(t('friend.request.success.cancel'), 'success')
  } catch {
    showFeedback(t('friend.request.error.cancel'), 'error')
  } finally {
    processing.value = null
  }
}

watch(visible, (val) => {
  if (val) {
    contactStore.loadFriendRequests()
    return
  }

  searchValue.value = ''
  appliedSearchValue.value = ''
  isSearchPending.value = false
})
</script>

<style scoped lang="scss">
.friend-request-dialog {
  :deep(.n-card-header) {
    padding: 16px 20px;
  }

  :deep(.n-card__content) {
    padding: 0 20px 20px;
  }
}

.friend-request-dialog__search-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--hula-text-tertiary);
}

.friend-request-dialog__search-clear {
  border: none;
  background: transparent;
  color: var(--hula-color-primary-500);
  cursor: pointer;
  padding: 0;
}

.request-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 0;
}

.request-item {
  padding: 12px;
  border-radius: 8px;
  background: var(--hula-surface-panel);
  border: 1px solid var(--hula-border-default);
}
</style>
