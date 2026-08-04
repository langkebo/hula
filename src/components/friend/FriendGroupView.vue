<template>
  <div class="friend-group-view">
    <n-flex vertical :size="12" class="p-12px">
      <n-flex align="center" justify="space-between">
        <span class="text-16px font-semibold">{{ t('friend.group.title') }}</span>
        <n-button quaternary circle size="small" @click="showCreateDialog = true">
          <template #icon>
            <n-icon>
              <svg><use href="#plus" /></svg>
            </n-icon>
          </template>
        </n-button>
      </n-flex>

      <FriendSearchBar
        v-model="searchValue"
        :history="searchHistory"
        :show-history="showSearchHistory"
        :placeholder="t('friend.group.search')"
        @search="handleSearch"
        @select-history="handleSelectHistory"
        @clear-history="handleClearSearchHistory" />

      <div v-if="showSearchSummary" class="friend-group-view__search-summary">
        <span>{{ searchSummaryText }}</span>
        <button
          v-if="showSearchClearAction"
          type="button"
          class="friend-group-view__search-clear"
          @click="handleClearActiveSearch">
          {{ t('friend.search.clear_current') }}
        </button>
      </div>
    </n-flex>

    <n-divider style="margin: 0" />

    <n-spin :show="loading">
      <n-scrollbar style="height: calc(100vh - 200px)">
        <n-empty
          v-if="filteredGroups.length === 0"
          :description="hasSearchKeyword ? searchEmptyDescription : t('friend.group.empty')"
          class="mt-40px" />
        <div v-else class="group-items">
          <div
            v-for="group in filteredGroups"
            :key="group.group_id"
            class="group-item"
            @click="handleSelectGroup(group)"
            @contextmenu="handleContextMenu($event, group)">
            <n-flex align="center" :size="12">
              <div class="w-44px h-44px rounded-8px bg-[--tjg-surface-panel] flex items-center justify-center">
                <svg class="size-24px text-[--tjg-text-primary]"><use href="#folder" /></svg>
              </div>
              <n-flex vertical :size="4" class="flex-1 truncate">
                <span class="text-14px truncate">{{ group.name }}</span>
                <span class="text-(12px [--tjg-text-tertiary])">
                  {{ t('friend.group.member_count', { count: group.member_count ?? 0 }) }}
                </span>
              </n-flex>
            </n-flex>
          </div>
        </div>
      </n-scrollbar>
    </n-spin>

    <n-modal v-model:show="showCreateDialog" :title="t('friend.group.create')" preset="dialog">
      <n-input v-model:value="newGroupName" :placeholder="t('friend.group.name_placeholder')" />
      <template #action>
        <n-flex justify="end" :size="12">
          <n-button @click="showCreateDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="creating" :disabled="!newGroupName.trim()" @click="handleCreateGroup">
            {{ t('common.confirm') }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>

    <n-modal v-model:show="showRenameDialog" :title="t('friend.group.rename')" preset="dialog">
      <n-input v-model:value="renameValue" :placeholder="t('friend.group.name_placeholder')" />
      <template #action>
        <n-flex justify="end" :size="12">
          <n-button @click="showRenameDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="renaming" :disabled="!renameValue.trim()" @click="handleRenameGroup">
            {{ t('common.confirm') }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>

    <n-dropdown
      :x="contextMenuX"
      :y="contextMenuY"
      :show="showContextMenu"
      :options="contextMenuOptions"
      placement="bottom-start"
      @select="handleContextAction"
      @clickoutside="showContextMenu = false" />
  </div>
</template>

<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAriaLive } from '@/composables/common/useAriaLive'
import { useRecentSearchHistory } from '@/composables/common/useRecentSearchHistory'
import { useSearchFeedbackSummary } from '@/composables/common/useSearchFeedbackSummary'
import { type FriendGroup, useFriends } from '@/composables/useFriends'
import FriendSearchBar from './FriendSearchBar.vue'

const FRIEND_GROUP_SEARCH_HISTORY_STORAGE_KEY = 'tjg-friend-group-search-history'
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { announce } = useAriaLive()
const { getFriendGroups, createFriendGroup, renameFriendGroup, deleteFriendGroup } = useFriends()
const {
  historyValues: searchHistory,
  rememberTerm,
  clearHistory: clearSearchHistory
} = useRecentSearchHistory(FRIEND_GROUP_SEARCH_HISTORY_STORAGE_KEY)

const loading = ref(false)
const groups = ref<FriendGroup[]>([])
const searchValue = ref('')
const appliedSearchValue = ref('')
const isSearchPending = ref(false)
const showCreateDialog = ref(false)
const newGroupName = ref('')
const creating = ref(false)
const showRenameDialog = ref(false)
const renameValue = ref('')
const renaming = ref(false)
const selectedGroup = ref<FriendGroup | null>(null)
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const showSearchHistory = computed(() => !loading.value && !searchValue.value.trim() && searchHistory.value.length > 0)

const filteredGroups = computed(() => {
  if (!appliedSearchValue.value.trim()) return groups.value
  return groups.value.filter((g) => g.name.toLowerCase().includes(appliedSearchValue.value.toLowerCase()))
})

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
  resultCount: () => filteredGroups.value.length,
  searchingText: () => t('friend.search.searching'),
  announce,
  getIdleSummaryText: () => {
    if (!appliedSearchValue.value.trim()) {
      return ''
    }

    return t('friend.group.result_count', {
      count: filteredGroups.value.length,
      keyword: appliedSearchValue.value
    })
  },
  getResultAnnouncementText: () =>
    t('friend.group.result_count', {
      count: filteredGroups.value.length,
      keyword: appliedSearchValue.value
    }),
  getEmptyAnnouncementText: () => t('friend.group.empty_search'),
  getEmptyDescription: () => t('friend.group.empty_search')
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
  if (!value.trim()) {
    isSearchPending.value = false
    return
  }

  isSearchPending.value = value.trim() !== appliedSearchValue.value.trim()
})

const contextMenuOptions = computed(() => [
  { label: t('friend.group.rename'), key: 'rename' },
  { label: t('friend.group.delete'), key: 'delete' }
])

async function loadGroups() {
  loading.value = true
  try {
    groups.value = await getFriendGroups()
  } catch {
    showFeedback(t('friend.group.load_failed'), 'error')
  } finally {
    loading.value = false
  }
}

async function handleCreateGroup() {
  creating.value = true
  try {
    await createFriendGroup(newGroupName.value.trim())
    showFeedback(t('friend.group.create_success'), 'success')
    showCreateDialog.value = false
    newGroupName.value = ''
    await loadGroups()
  } catch {
    showFeedback(t('friend.group.create_failed'), 'error')
  } finally {
    creating.value = false
  }
}

async function handleRenameGroup() {
  if (!selectedGroup.value) return
  renaming.value = true
  try {
    await renameFriendGroup(selectedGroup.value.group_id, renameValue.value.trim())
    showFeedback(t('friend.group.rename_success'), 'success')
    showRenameDialog.value = false
    await loadGroups()
  } catch {
    showFeedback(t('friend.group.rename_failed'), 'error')
  } finally {
    renaming.value = false
  }
}

async function handleDeleteGroup(groupId: string) {
  try {
    await deleteFriendGroup(groupId)
    showFeedback(t('friend.group.delete_success'), 'success')
    await loadGroups()
  } catch {
    showFeedback(t('friend.group.delete_failed'), 'error')
  }
}

function handleSelectGroup(group: FriendGroup) {
  selectedGroup.value = group
}

function handleContextMenu(e: MouseEvent, group: FriendGroup) {
  e.preventDefault()
  selectedGroup.value = group
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
  showContextMenu.value = true
}

function handleContextAction(key: string) {
  showContextMenu.value = false
  if (!selectedGroup.value) return
  if (key === 'rename') {
    renameValue.value = selectedGroup.value.name
    showRenameDialog.value = true
  } else if (key === 'delete') {
    handleDeleteGroup(selectedGroup.value.group_id)
  }
}

onMounted(() => {
  loadGroups()
})
</script>

<style scoped>
.friend-group-view__search-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--tjg-text-tertiary);
}

.friend-group-view__search-clear {
  border: none;
  background: transparent;
  color: var(--tjg-color-primary-500);
  cursor: pointer;
  padding: 0;
}

.group-item {
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background-color 0.2s;
}
.group-item:hover {
  background-color: var(--tjg-fill-hover);
}
</style>
