<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('friend.add.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="true"
    class="add-friend-dialog"
    style="width: 460px; max-width: 90vw">
    <n-flex vertical :size="16">
      <n-flex align="center" :size="8">
        <div class="flex-1">
          <FriendSearchBar
            v-model="searchValue"
            :history="searchHistory"
            :show-history="showSearchHistory"
            :placeholder="t('friend.add.placeholder')"
            @search="handleSearch"
            @select-history="handleSelectHistory"
            @clear-history="handleClearSearchHistory" />
        </div>
        <n-select v-model:value="searchMode" :options="searchModeOptions" size="large" style="width: 100px" />
      </n-flex>

      <div v-if="showSearchSummary" class="add-friend-dialog__search-summary">
        <span>{{ searchSummaryText }}</span>
        <button
          v-if="showSearchClearAction"
          type="button"
          class="add-friend-dialog__search-clear"
          @click="handleClearActiveSearch">
          {{ t('friend.search.clear_current') }}
        </button>
      </div>

      <n-spin :show="loading">
        <div v-if="searchResult" class="search-result">
          <n-flex align="center" :size="12">
            <n-avatar
              :size="56"
              :src="AvatarUtils.getAvatarUrl(searchResult.avatarUrl)"
              :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
              round />
            <n-flex vertical :size="4" class="flex-1">
              <span class="text-16px font-medium">{{ searchResult.displayName || searchResult.userId }}</span>
              <span class="text-12px text-[--hula-text-secondary]">{{ searchResult.userId }}</span>
            </n-flex>
          </n-flex>

          <n-divider style="margin: 12px 0" />

          <n-flex vertical :size="8">
            <span class="text-12px text-[--hula-text-tertiary]">{{ t('friend.add.message_label') }}</span>
            <n-input
              v-model:value="requestMessage"
              type="textarea"
              :placeholder="t('friend.add.message_placeholder')"
              :maxlength="500"
              :autosize="{ minRows: 2, maxRows: 4 }"
              show-count />
          </n-flex>

          <n-flex justify="end" :size="12" class="mt-16px">
            <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
            <n-button type="primary" :loading="sending" @click="handleSendRequest">
              {{ t('friend.add.send') }}
            </n-button>
          </n-flex>
        </div>

        <n-empty
          v-else-if="hasSearched"
          :description="hasSearchKeyword ? searchEmptyDescription : t('friend.add.not_found')" />

        <div v-else-if="suggestions.length > 0" class="suggestions-section">
          <span class="text-12px text-[--hula-text-tertiary] mb-8px">{{ t('friend.add.suggestions') }}</span>
          <div class="suggestion-list">
            <div
              v-for="suggestion in suggestions"
              :key="suggestion.user_id"
              class="suggestion-item"
              @click="handleSelectSuggestion(suggestion)">
              <n-flex align="center" :size="10">
                <n-avatar
                  :size="36"
                  :src="AvatarUtils.getAvatarUrl(suggestion.avatar_url ?? '')"
                  :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                  round />
                <n-flex vertical :size="2" class="flex-1">
                  <span class="text-13px">{{ suggestion.display_name || suggestion.user_id }}</span>
                  <span class="text-11px text-[--hula-text-tertiary]">{{ suggestion.user_id }}</span>
                </n-flex>
                <n-button size="tiny" type="primary" ghost>
                  {{ t('friend.add.send') }}
                </n-button>
              </n-flex>
            </div>
          </div>
        </div>

        <div v-else class="search-hint">
          <n-icon size="48" color="var(--hula-text-tertiary)">
            <svg><use href="#search" /></svg>
          </n-icon>
          <span class="text-14px text-[--hula-text-tertiary]">{{ t('friend.add.hint') }}</span>
        </div>
      </n-spin>
    </n-flex>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAriaLive } from '@/composables/common/useAriaLive'
import { useRecentSearchHistory } from '@/composables/common/useRecentSearchHistory'
import { useSearchFeedbackSummary } from '@/composables/common/useSearchFeedbackSummary'
import { useFriends } from '@/composables/useFriends'
import { ThemeEnum } from '@/enums'
import { matrixContactService } from '@/services/matrix/user/MatrixContactService'
import { type MatrixContact, useContactStore } from '@/stores/domains/chat/contacts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'
import FriendSearchBar from './FriendSearchBar.vue'

const ADD_FRIEND_SEARCH_HISTORY_STORAGE_KEY = 'hula-add-friend-search-history'
const { t } = useI18n()
const { announce } = useAriaLive()
const { showFeedback } = useActionFeedback()
const contactStore = useContactStore()
const settingStore = useSettingStore()
const { getFriendSuggestions, searchFriendsViaApi } = useFriends()
const {
  historyValues: searchHistory,
  rememberTerm,
  clearHistory: clearSearchHistory
} = useRecentSearchHistory(ADD_FRIEND_SEARCH_HISTORY_STORAGE_KEY)

const visible = defineModel<boolean>('show', { default: false })
const searchValue = ref('')
const appliedSearchValue = ref('')
const searchMode = ref<'fuzzy' | 'exact'>('fuzzy')
const searchResult = ref<MatrixContact | null>(null)
const requestMessage = ref('')
const loading = ref(false)
const sending = ref(false)
const hasSearched = ref(false)
const isSearchPending = ref(false)
const suggestions = ref<Array<{ user_id: string; display_name?: string; avatar_url?: string; reason?: string }>>([])
const searchResultCount = computed(() => {
  if (!hasSearched.value || !appliedSearchValue.value.trim()) {
    return null
  }

  return searchResult.value ? 1 : 0
})
const showSearchHistory = computed(
  () => Boolean(visible.value) && !loading.value && !searchValue.value.trim() && searchHistory.value.length > 0
)

const searchModeOptions = computed(() => [
  { label: t('friend.add.mode_fuzzy'), value: 'fuzzy' },
  { label: t('friend.add.mode_exact'), value: 'exact' }
])

const {
  hasSearchKeyword,
  showSummary: showSearchSummary,
  showClearAction: showSearchClearAction,
  summaryText: searchSummaryText,
  emptyDescription: searchEmptyDescription
} = useSearchFeedbackSummary({
  searchValue,
  appliedSearchValue,
  isSearching: () => loading.value || isSearchPending.value,
  resultCount: searchResultCount,
  searchingText: () => t('friend.search.searching'),
  announce,
  getIdleSummaryText: () => {
    if (searchResult.value) {
      return t('friend.add.result_found', {
        user: searchResult.value.displayName || searchResult.value.userId
      })
    }

    if (hasSearched.value && appliedSearchValue.value.trim()) {
      return t('friend.add.result_empty', {
        keyword: appliedSearchValue.value
      })
    }

    return ''
  },
  getResultAnnouncementText: () =>
    t('friend.add.result_found', {
      user: searchResult.value?.displayName || searchResult.value?.userId || appliedSearchValue.value
    }),
  getEmptyAnnouncementText: () =>
    t('friend.add.result_empty', {
      keyword: appliedSearchValue.value
    }),
  getEmptyDescription: () =>
    t('friend.add.result_empty', {
      keyword: appliedSearchValue.value
    })
})

const loadSuggestions = async () => {
  try {
    const result = await getFriendSuggestions()
    suggestions.value = result.slice(0, 5)
  } catch {
    suggestions.value = []
  }
}

const clearSearchState = () => {
  appliedSearchValue.value = ''
  searchResult.value = null
  requestMessage.value = ''
  hasSearched.value = false
  isSearchPending.value = false
}

const handleSearch = async (value?: string) => {
  const query = (value ?? searchValue.value).trim()
  if (!query) {
    clearSearchState()
    return
  }

  searchValue.value = query
  loading.value = true
  hasSearched.value = true
  appliedSearchValue.value = query
  isSearchPending.value = false
  rememberTerm(query)

  try {
    const searchResults = await searchFriendsViaApi(query, {
      mode: searchMode.value,
      limit: 1
    })

    let foundUserId: string | null = null

    if (searchResults.length > 0) {
      foundUserId = searchResults[0].user_id
    } else {
      // 回退到 MatrixContactService 的多级搜索（exact → fuzzy → user_directory → profile lookup）
      try {
        const fallbackResults = await matrixContactService.searchUsers(query)
        if (fallbackResults.length > 0) {
          foundUserId = fallbackResults[0].userId
        }
      } catch {
        // 回退搜索也失败，忽略
      }
    }

    if (foundUserId) {
      const profile = await contactStore.getUserProfile(foundUserId)
      searchResult.value = profile

      if (await contactStore.isFriend(foundUserId)) {
        showFeedback(t('friend.add.already_friend'), 'info', 'polite')
      }
    } else {
      searchResult.value = null
    }
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : t('friend.add.search_error')
    showFeedback(message, 'error', 'assertive')
    searchResult.value = null
  } finally {
    loading.value = false
  }
}

const handleSelectSuggestion = async (suggestion: { user_id: string }) => {
  searchValue.value = suggestion.user_id
  loading.value = true
  hasSearched.value = true
  appliedSearchValue.value = suggestion.user_id
  isSearchPending.value = false
  rememberTerm(suggestion.user_id)

  try {
    const profile = await contactStore.getUserProfile(suggestion.user_id)
    searchResult.value = profile

    if (await contactStore.isFriend(suggestion.user_id)) {
      showFeedback(t('friend.add.already_friend'), 'info', 'polite')
    }
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : t('friend.add.search_error')
    showFeedback(message, 'error', 'assertive')
    searchResult.value = null
  } finally {
    loading.value = false
  }
}

const handleSendRequest = async () => {
  if (!searchResult.value) return

  if (requestMessage.value.length > 500) {
    showFeedback(t('friend.add.message_too_long'), 'warning', 'assertive')
    return
  }

  sending.value = true
  try {
    const success = await contactStore.sendFriendRequest(searchResult.value.userId, requestMessage.value)
    if (success) {
      const message = t('friend.add.success')
      showFeedback(message, 'success', 'polite')
      visible.value = false
      resetForm()
    }
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : t('friend.add.error')
    showFeedback(message, 'error', 'assertive')
  } finally {
    sending.value = false
  }
}

const handleCancel = () => {
  visible.value = false
  resetForm()
}

const handleSelectHistory = (value: string) => {
  void handleSearch(value)
}

const handleClearSearchHistory = () => {
  clearSearchHistory()
}

const handleClearActiveSearch = () => {
  searchValue.value = ''
  clearSearchState()
}

const resetForm = () => {
  searchValue.value = ''
  clearSearchState()
}

watch(searchValue, (value) => {
  if (!value.trim()) {
    clearSearchState()
    return
  }

  isSearchPending.value = value.trim() !== appliedSearchValue.value.trim()
})

watch(visible, (val) => {
  if (val) {
    loadSuggestions()
  } else {
    resetForm()
  }
})
</script>

<style scoped lang="scss">
.add-friend-dialog {
  :deep(.n-card-header) {
    padding: 16px 20px;
  }

  :deep(.n-card__content) {
    padding: 16px 20px 20px;
  }
}

.search-result {
  padding: 12px;
  border-radius: 8px;
  background: var(--hula-surface-panel);
  border: 1px solid var(--hula-border-default);
}

.add-friend-dialog__search-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--hula-text-tertiary);
}

.add-friend-dialog__search-clear {
  border: none;
  background: transparent;
  color: var(--hula-color-primary-500);
  cursor: pointer;
  padding: 0;
}

.suggestions-section {
  display: flex;
  flex-direction: column;
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggestion-item {
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--hula-surface-list-hover);
  }
}

.search-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 0;
}
</style>
