<template>
  <div class="workbench-search-pane">
    <div class="workbench-search-pane__header">
      <span class="text-13px font-600">{{ t('search.title') }}</span>
      <button type="button" class="workbench-search-pane__close" @click="emit('close')">
        {{ t('common.close') }}
      </button>
    </div>

    <div class="workbench-search-pane__input">
      <n-input
        ref="searchInputRef"
        v-model:value="searchQuery"
        size="small"
        :placeholder="t('search.placeholder')"
        clearable
        @input="handleSearch">
        <template #prefix>
          <svg class="size-14px"><use href="#search" /></svg>
        </template>
      </n-input>
    </div>

    <div class="workbench-search-pane__filters">
      <n-radio-group v-model:value="searchType" size="small" @update:value="handleSearch">
        <n-radio-button value="all">{{ t('search.all') }}</n-radio-button>
        <n-radio-button value="messages">{{ t('search.messages') }}</n-radio-button>
        <n-radio-button value="rooms">{{ t('search.rooms') }}</n-radio-button>
        <n-radio-button value="users">{{ t('search.users') }}</n-radio-button>
      </n-radio-group>
    </div>

    <div class="workbench-search-pane__content">
      <n-scrollbar style="max-height: 360px">
        <div v-if="isSearching" class="workbench-search-pane__loading">
          <n-spin size="small" />
        </div>

        <template v-else-if="searchQuery.trim()">
          <div
            v-if="messageResults.length > 0 && ['all', 'messages'].includes(searchType)"
            class="workbench-search-pane__section">
            <div class="workbench-search-pane__section-header">
              <span class="workbench-search-pane__section-title">{{ t('search.messages') }}</span>
              <span class="workbench-search-pane__section-count">{{ messageResults.length }}</span>
            </div>
            <div
              v-for="result in messageResults"
              :key="result.eventId"
              class="workbench-search-pane__result"
              @click="handleMessageClick(result)">
              <n-avatar round :size="28" :src="result.avatarUrl" :fallback-src="defaultAvatar" />
              <div class="workbench-search-pane__result-info">
                <div class="workbench-search-pane__result-header">
                  <span class="workbench-search-pane__result-name">{{ result.name }}</span>
                  <span class="workbench-search-pane__result-room">{{ result.roomName }}</span>
                </div>
                <div class="workbench-search-pane__result-preview" v-safe-html="result.previewHtml" />
              </div>
            </div>
          </div>

          <div
            v-if="roomResults.length > 0 && ['all', 'rooms'].includes(searchType)"
            class="workbench-search-pane__section">
            <div class="workbench-search-pane__section-header">
              <span class="workbench-search-pane__section-title">{{ t('search.rooms') }}</span>
              <span class="workbench-search-pane__section-count">{{ roomResults.length }}</span>
            </div>
            <div
              v-for="result in roomResults"
              :key="result.roomId"
              class="workbench-search-pane__result"
              @click="handleRoomClick(result)">
              <n-avatar round :size="28" :src="result.avatarUrl" :fallback-src="defaultAvatar" />
              <div class="workbench-search-pane__result-info">
                <span class="workbench-search-pane__result-name">{{ result.name }}</span>
                <span class="workbench-search-pane__result-meta">{{ result.memberCount }}</span>
              </div>
            </div>
          </div>

          <div
            v-if="userResults.length > 0 && ['all', 'users'].includes(searchType)"
            class="workbench-search-pane__section">
            <div class="workbench-search-pane__section-header">
              <span class="workbench-search-pane__section-title">{{ t('search.users') }}</span>
              <span class="workbench-search-pane__section-count">{{ userResults.length }}</span>
            </div>
            <div
              v-for="result in userResults"
              :key="result.userId"
              class="workbench-search-pane__result"
              @click="handleUserClick(result)">
              <n-avatar round :size="28" :src="result.avatarUrl" :fallback-src="defaultAvatar" />
              <div class="workbench-search-pane__result-info">
                <span class="workbench-search-pane__result-name">{{ result.name }}</span>
                <span class="workbench-search-pane__result-meta">{{ result.userId }}</span>
              </div>
            </div>
          </div>

          <div v-if="!hasResults" class="workbench-search-pane__empty">
            <span class="text-12px color-[--hula-text-tertiary]">{{ t('search.no_results') }}</span>
          </div>
        </template>

        <template v-else>
          <div v-if="recentSearches.length > 0" class="workbench-search-pane__recent">
            <div class="workbench-search-pane__section-header">
              <span class="workbench-search-pane__section-title">{{ t('search.recent') }}</span>
              <button type="button" class="workbench-search-pane__clear-btn" @click="clearRecentSearches">
                {{ t('search.clear') }}
              </button>
            </div>
            <n-flex :size="6" wrap>
              <n-tag
                v-for="(query, index) in recentSearches"
                :key="index"
                round
                size="small"
                class="cursor-pointer"
                @click="searchQuery = query">
                {{ query }}
              </n-tag>
            </n-flex>
          </div>
        </template>
      </n-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import type { InputInst } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import {
  type SearchResult as MatrixSearchResult,
  matrixSearchService,
  type RoomSearchResult,
  type UserSearchResult
} from '@/services/matrix/MatrixSearchService'
import { useSpotlightStore } from '@/stores/domains/widget/spotlight'
import { formatTimestamp } from '@/utils/ComputedTime'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('WorkbenchSearchPane')

type SpotlightMessageResult = MatrixSearchResult & {
  name: string
  avatarUrl?: string
  previewHtml: string
}

type SpotlightRoomResult = RoomSearchResult & {
  name: string
}

type SpotlightUserResult = UserSearchResult & {
  name: string
}

const emit = defineEmits<{
  close: []
  'message-selected': [roomId: string, eventId: string]
  'room-selected': [roomId: string]
  'user-selected': [userId: string]
}>()

const { t } = useI18n()
const spotlightStore = useSpotlightStore()
const searchInputRef = ref<InputInst | null>(null)
const searchQuery = ref('')
const searchType = ref<'all' | 'messages' | 'rooms' | 'users'>('all')
const isSearching = ref(false)
const messageResults = ref<SpotlightMessageResult[]>([])
const roomResults = ref<SpotlightRoomResult[]>([])
const userResults = ref<SpotlightUserResult[]>([])
const defaultAvatar = '/logoD.png'

const recentSearches = computed(() => spotlightStore.recentSearches)

const hasResults = computed(() => {
  return messageResults.value.length > 0 || roomResults.value.length > 0 || userResults.value.length > 0
})

const getMessagePreviewHtml = (result: MatrixSearchResult) => {
  const body = result.content.body
  return typeof body === 'string' ? body : ''
}

const handleSearch = useDebounceFn(async () => {
  const query = searchQuery.value.trim()
  if (!query) {
    messageResults.value = []
    roomResults.value = []
    userResults.value = []
    return
  }

  isSearching.value = true
  try {
    const [messagesResult, roomsResult, usersResult] = await Promise.allSettled([
      searchType.value === 'all' || searchType.value === 'messages'
        ? matrixSearchService.searchMessages(query, { source: 'hybrid' })
        : Promise.resolve([]),
      searchType.value === 'all' || searchType.value === 'rooms'
        ? matrixSearchService.searchRooms(query)
        : Promise.resolve([]),
      searchType.value === 'all' || searchType.value === 'users'
        ? matrixSearchService.searchUsers(query)
        : Promise.resolve([])
    ])

    const messages = messagesResult.status === 'fulfilled' ? messagesResult.value : []
    const rooms = roomsResult.status === 'fulfilled' ? roomsResult.value : []
    const users = usersResult.status === 'fulfilled' ? usersResult.value : []

    messageResults.value = messages.map((result) => ({
      ...result,
      name: result.sender,
      previewHtml: getMessagePreviewHtml(result)
    }))
    roomResults.value = rooms.map((result) => ({
      ...result,
      name: result.roomName
    }))
    userResults.value = users.map((result) => ({
      ...result,
      name: result.displayName || result.userId
    }))

    spotlightStore.addRecentSearch(query)
  } catch (error) {
    logger.error('Search failed:', error)
  } finally {
    isSearching.value = false
  }
}, 300)

const handleMessageClick = (result: SpotlightMessageResult) => {
  emit('message-selected', result.roomId, result.eventId)
}

const handleRoomClick = (result: SpotlightRoomResult) => {
  emit('room-selected', result.roomId)
}

const handleUserClick = (result: SpotlightUserResult) => {
  emit('user-selected', result.userId)
}

const clearRecentSearches = () => {
  spotlightStore.clearRecentSearches()
}

onMounted(() => {
  nextTick(() => {
    searchInputRef.value?.focus()
  })
})
</script>

<style scoped lang="scss">
.workbench-search-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.workbench-search-pane__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.workbench-search-pane__close {
  border: 0;
  background: transparent;
  color: var(--hula-text-tertiary);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
    color: var(--hula-text-primary);
  }
}

.workbench-search-pane__input {
  margin-bottom: 8px;
}

.workbench-search-pane__filters {
  margin-bottom: 12px;

  :deep(.n-radio-group) {
    flex-wrap: wrap;
  }

  :deep(.n-radio-button) {
    font-size: 11px;
  }
}

.workbench-search-pane__content {
  flex: 1;
  min-height: 0;
}

.workbench-search-pane__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
}

.workbench-search-pane__section {
  margin-bottom: 12px;
}

.workbench-search-pane__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 4px;
}

.workbench-search-pane__section-title {
  color: var(--hula-text-tertiary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.workbench-search-pane__section-count {
  color: var(--hula-text-tertiary);
  font-size: 11px;
}

.workbench-search-pane__result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--hula-fill-hover);
  }
}

.workbench-search-pane__result-info {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.workbench-search-pane__result-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.workbench-search-pane__result-name {
  overflow: hidden;
  color: var(--hula-text-primary);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workbench-search-pane__result-room,
.workbench-search-pane__result-meta {
  overflow: hidden;
  color: var(--hula-text-tertiary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workbench-search-pane__result-preview {
  overflow: hidden;
  color: var(--hula-text-tertiary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;

  :deep(mark) {
    background: var(--color-primary-active);
    color: inherit;
  }
}

.workbench-search-pane__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
}

.workbench-search-pane__recent {
  padding: 4px 0;
}

.workbench-search-pane__clear-btn {
  border: 0;
  background: transparent;
  color: var(--hula-color-primary-500);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.8;
  }
}
</style>
