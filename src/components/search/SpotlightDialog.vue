<template>
  <n-modal
    v-model:show="visible"
    :style="{ width: '600px', maxWidth: '90vw' }"
    :bordered="false"
    :mask-closable="true"
    @update:show="$emit('update:visible', $event)">
    <div class="spotlight-dialog">
      <div class="search-header">
        <n-input
          ref="searchInputRef"
          v-model:value="searchQuery"
          size="large"
          :placeholder="t('search.placeholder')"
          clearable
          @input="handleSearch">
          <template #prefix>
            <svg class="size-20px">
              <use href="#search"></use>
            </svg>
          </template>
        </n-input>
      </div>

      <div class="search-filters">
        <n-radio-group v-model:value="searchType" @update:value="handleSearch">
          <n-radio-button value="all">{{ t('search.all') }}</n-radio-button>
          <n-radio-button value="messages">{{ t('search.messages') }}</n-radio-button>
          <n-radio-button value="rooms">{{ t('search.rooms') }}</n-radio-button>
          <n-radio-button value="users">{{ t('search.users') }}</n-radio-button>
        </n-radio-group>
      </div>

      <div class="search-content">
        <n-scrollbar style="max-height: 400px">
          <div v-if="isSearching" class="loading-state">
            <n-spin size="medium" />
          </div>

          <template v-else-if="searchQuery.trim()">
            <div v-if="messageResults.length > 0 && ['all', 'messages'].includes(searchType)" class="result-section">
              <div class="section-header">
                <span class="section-title">{{ t('search.messages') }}</span>
                <span class="section-count">{{ messageResults.length }}</span>
              </div>
              <div
                v-for="result in messageResults"
                :key="result.eventId"
                class="result-item"
                @click="handleMessageClick(result)">
                <div class="result-avatar">
                  <n-avatar round :size="36" :src="result.avatarUrl" :fallback-src="defaultAvatar" />
                </div>
                <div class="result-info">
                  <div class="result-header">
                    <span class="result-name">{{ result.name }}</span>
                    <span class="result-room">{{ result.roomName }}</span>
                  </div>
                  <div class="result-preview" v-html="result.content?.body" />
                </div>
                <div class="result-time">
                  {{ formatTime(result.timestamp) }}
                </div>
              </div>
            </div>

            <div v-if="roomResults.length > 0 && ['all', 'rooms'].includes(searchType)" class="result-section">
              <div class="section-header">
                <span class="section-title">{{ t('search.rooms') }}</span>
                <span class="section-count">{{ roomResults.length }}</span>
              </div>
              <div
                v-for="result in roomResults"
                :key="result.roomId"
                class="result-item"
                @click="handleRoomClick(result)">
                <div class="result-avatar">
                  <n-avatar round :size="36" :src="result.avatarUrl" :fallback-src="defaultAvatar" />
                </div>
                <div class="result-info">
                  <span class="result-name">{{ result.name }}</span>
                  <span v-if="result.isEncrypted" class="encrypted-badge">
                    <svg class="size-12px">
                      <use href="#lock"></use>
                    </svg>
                  </span>
                </div>
              </div>
            </div>

            <div v-if="userResults.length > 0 && ['all', 'users'].includes(searchType)" class="result-section">
              <div class="section-header">
                <span class="section-title">{{ t('search.users') }}</span>
                <span class="section-count">{{ userResults.length }}</span>
              </div>
              <div
                v-for="result in userResults"
                :key="result.userId"
                class="result-item"
                @click="handleUserClick(result)">
                <div class="result-avatar">
                  <n-avatar round :size="36" :src="result.avatarUrl" :fallback-src="defaultAvatar" />
                </div>
                <div class="result-info">
                  <span class="result-name">{{ result.name }}</span>
                  <span class="result-userId">{{ result.userId }}</span>
                </div>
              </div>
            </div>

            <div v-if="!hasResults" class="empty-state">
              <svg class="size-48px color-#909090">
                <use href="#search"></use>
              </svg>
              <span class="empty-text">{{ t('search.no_results') }}</span>
            </div>
          </template>

          <template v-else>
            <div class="recent-searches" v-if="recentSearches.length > 0">
              <div class="section-header">
                <span class="section-title">{{ t('search.recent') }}</span>
                <n-button text size="tiny" @click="clearRecentSearches">
                  {{ t('search.clear') }}
                </n-button>
              </div>
              <n-tag
                v-for="(query, index) in recentSearches"
                :key="index"
                round
                class="recent-tag"
                @click="searchQuery = query">
                {{ query }}
              </n-tag>
            </div>
          </template>
        </n-scrollbar>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { matrixSearchService } from '@/services/matrix'
import { useSpotlightStore } from '@/stores/spotlight'
import { formatTimestamp } from '@/utils/ComputedTime'
import { useDebounceFn } from '@vueuse/core'
import { createLogger } from '@/utils/Logger'
const logger = createLogger('SpotlightDialog')

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'message-selected', roomId: string, eventId: string): void
  (e: 'room-selected', roomId: string): void
  (e: 'user-selected', userId: string): void
}>()

const { t } = useI18n()
const spotlightStore = useSpotlightStore()
const searchInputRef = ref()
const searchQuery = ref('')
const searchType = ref<'all' | 'messages' | 'rooms' | 'users'>('all')
const isSearching = ref(false)
const messageResults = ref<any[]>([])
const roomResults = ref<any[]>([])
const userResults = ref<any[]>([])
const defaultAvatar = '/logoD.png'

const recentSearches = computed(() => spotlightStore.recentSearches)

const hasResults = computed(() => {
  return messageResults.value.length > 0 || roomResults.value.length > 0 || userResults.value.length > 0
})

const formatTime = (timestamp?: number) => {
  if (!timestamp) return ''
  return formatTimestamp(timestamp, true)
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
    const [messages, rooms, users] = await Promise.all([
      searchType.value === 'all' || searchType.value === 'messages'
        ? matrixSearchService.searchMessages(query)
        : Promise.resolve([]),
      searchType.value === 'all' || searchType.value === 'rooms'
        ? matrixSearchService.searchRooms(query)
        : Promise.resolve([]),
      searchType.value === 'all' || searchType.value === 'users'
        ? matrixSearchService.searchUsers(query)
        : Promise.resolve([])
    ])

    messageResults.value = messages
    roomResults.value = rooms
    userResults.value = users

    spotlightStore.addRecentSearch(query)
  } catch (error) {
    logger.error('搜索失败:', error)
  } finally {
    isSearching.value = false
  }
}, 300)

const handleMessageClick = (result: any) => {
  emit('message-selected', result.roomId, result.eventId)
  emit('update:visible', false)
}

const handleRoomClick = (result: any) => {
  emit('room-selected', result.roomId)
  emit('update:visible', false)
}

const handleUserClick = (result: any) => {
  emit('user-selected', result.userId)
  emit('update:visible', false)
}

const clearRecentSearches = () => {
  spotlightStore.clearRecentSearches()
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      nextTick(() => {
        searchInputRef.value?.focus()
      })
    } else {
      searchQuery.value = ''
      messageResults.value = []
      roomResults.value = []
      userResults.value = []
    }
  }
)
</script>

<style scoped lang="scss">
.spotlight-dialog {
  @apply flex flex-col bg-[--bg-color] rounded-12px overflow-hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.search-header {
  @apply p-16px;
}

.search-filters {
  @apply px-16px pb-12px;
}

.search-content {
  @apply flex-1 min-h-0;
}

.loading-state {
  @apply flex-center py-40px;
}

.result-section {
  @apply flex flex-col;
}

.section-header {
  @apply flex items-center justify-between px-16px py-8px bg-[--right-chat-reply-color];
}

.section-title {
  @apply text-12px font-medium color-#909090;
}

.section-count {
  @apply text-12px color-#909090;
}

.result-item {
  @apply flex items-center gap-12px px-16px py-10px cursor-pointer transition-all;

  &:hover {
    background: var(--emoji-hover);
  }
}

.result-avatar {
  @apply flex-shrink-0;
}

.result-info {
  @apply flex flex-col gap-4px flex-1 min-w-0;
}

.result-header {
  @apply flex items-center gap-8px;
}

.result-name {
  @apply text-14px font-medium truncate;
}

.result-room {
  @apply text-12px color-#909090 truncate;
}

.result-preview {
  @apply text-12px color-#909090 truncate;

  :deep(mark) {
    background: rgba(19, 152, 127, 0.3);
    color: inherit;
  }
}

.result-time {
  @apply text-12px color-#909090 flex-shrink-0;
}

.encrypted-badge {
  @apply flex-center color-#13987f;
}

.result-userId {
  @apply text-12px color-#909090;
}

.empty-state {
  @apply flex flex-col items-center justify-center py-40px gap-12px;
}

.empty-text {
  @apply text-14px color-#909090;
}

.recent-searches {
  @apply flex flex-col gap-8px px-16px py-12px;
}

.recent-tag {
  @apply cursor-pointer;

  &:hover {
    background: var(--emoji-hover);
  }
}
</style>
