<template>
  <div class="add-friend-pane flex-1 min-h-0 flex flex-col">
    <!-- 草稿恢复提示 -->
    <Transition name="hint-fade">
      <div v-if="showRestoredHint" class="add-friend-pane__hint" role="status" aria-live="polite">
        <svg class="size-14px"><use href="#info"></use></svg>
        <span>{{ t('common.draft_restored', '已恢复上次编辑内容') }}</span>
      </div>
    </Transition>

    <div class="px-20px py-16px">
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

      <div v-if="showSearchSummary" class="add-friend-pane__search-summary">
        <span>{{ searchSummaryText }}</span>
        <button
          v-if="showSearchClearAction"
          type="button"
          class="add-friend-pane__search-clear"
          @click="handleClearActiveSearch">
          {{ t('friend.search.clear_current') }}
        </button>
      </div>
    </div>

    <n-divider style="margin: 0" />

    <n-scrollbar class="flex-1 min-h-0">
      <div class="px-20px py-16px">
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
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAriaLive } from '@/composables/common/useAriaLive'
import { useRecentSearchHistory } from '@/composables/common/useRecentSearchHistory'
import { useSearchFeedbackSummary } from '@/composables/common/useSearchFeedbackSummary'
import { useFriends } from '@/composables/useFriends'
import { ThemeEnum } from '@/enums'
import { matrixContactService } from '@/services/matrix/user/MatrixContactService'
import { type MatrixContact, useContactStore } from '@/stores/domains/chat/contacts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useRightViewDraftStore } from '@/stores/domains/widget/rightViewDraft'
import { AvatarUtils } from '@/utils/AvatarUtils'
import FriendSearchBar from './FriendSearchBar.vue'

const ADD_FRIEND_SEARCH_HISTORY_STORAGE_KEY = 'hula-add-friend-search-history'
const RESTORED_HINT_DURATION = 3000

const { t } = useI18n()
const route = useRoute()
const { announce } = useAriaLive()
const { showFeedback } = useActionFeedback()
const contactStore = useContactStore()
const settingStore = useSettingStore()
const draftStore = useRightViewDraftStore()
const { getFriendSuggestions, searchFriendsViaApi } = useFriends()
const {
  historyValues: searchHistory,
  rememberTerm,
  clearHistory: clearSearchHistory
} = useRecentSearchHistory(ADD_FRIEND_SEARCH_HISTORY_STORAGE_KEY)

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
const showRestoredHint = ref(false)

const searchResultCount = computed(() => {
  if (!hasSearched.value || !appliedSearchValue.value.trim()) {
    return null
  }

  return searchResult.value ? 1 : 0
})
const showSearchHistory = computed(() => !loading.value && !searchValue.value.trim() && searchHistory.value.length > 0)

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
      try {
        const fallbackResults = await matrixContactService.searchUsers(query)
        if (fallbackResults.length > 0) {
          foundUserId = fallbackResults[0].userId
        }
      } catch {
        // 忽略回退错误
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
      showFeedback(t('friend.add.success'), 'success', 'polite')
      // 提交成功后清除草稿并返回上一视图
      draftStore.clearAddFriend()
      const { default: router } = await import('@/router')
      void router.back()
    }
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : t('friend.add.error')
    showFeedback(message, 'error', 'assertive')
  } finally {
    sending.value = false
  }
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

// 自动同步草稿到 store
watch([searchValue, searchMode, requestMessage], () => {
  draftStore.saveAddFriend({
    searchValue: searchValue.value,
    searchMode: searchMode.value,
    requestMessage: requestMessage.value
  })
})

watch(searchValue, (value) => {
  if (!value.trim()) {
    clearSearchState()
    return
  }

  isSearchPending.value = value.trim() !== appliedSearchValue.value.trim()
})

// 挂载时恢复草稿
onMounted(() => {
  const draft = draftStore.addFriend
  const hasDraft =
    draft.searchValue.trim().length > 0 || draft.requestMessage.trim().length > 0 || draft.searchMode !== 'fuzzy'

  if (hasDraft) {
    searchValue.value = draft.searchValue
    searchMode.value = draft.searchMode
    requestMessage.value = draft.requestMessage
    showRestoredHint.value = true
    draftStore.setRestoredHint('addFriend')
    setTimeout(() => {
      showRestoredHint.value = false
      if (draftStore.restoredHint === 'addFriend') {
        draftStore.setRestoredHint(null)
      }
    }, RESTORED_HINT_DURATION)
  }

  // 支持从路由 query 预填目标 uid（如消息右键"添加好友"、用户卡片"添加好友"按钮）
  const queryUid = typeof route.query.uid === 'string' ? route.query.uid.trim() : ''
  if (queryUid && !searchValue.value) {
    void handleSearch(queryUid)
  }

  void loadSuggestions()
})
</script>

<style scoped lang="scss">
.add-friend-pane {
  background: var(--hula-surface-panel);
}

.add-friend-pane__hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: var(--hula-color-primary-50, rgba(59, 130, 246, 0.08));
  color: var(--hula-color-primary-600, var(--hula-color-primary-500));
  font-size: 12px;
  border-bottom: 1px solid var(--hula-color-primary-100, rgba(59, 130, 246, 0.15));
}

.hint-fade-enter-active,
.hint-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.hint-fade-enter-from,
.hint-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.search-result {
  padding: 12px;
  border-radius: 8px;
  background: var(--hula-surface-panel);
  border: 1px solid var(--hula-border-default);
}

.add-friend-pane__search-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--hula-text-tertiary);
  margin-top: 8px;
}

.add-friend-pane__search-clear {
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
