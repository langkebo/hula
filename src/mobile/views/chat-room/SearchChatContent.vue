<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_chat.search')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="p-16px">
          <van-search v-model="searchQuery" :placeholder="t('mobile_chat.search_placeholder')" shape="round" />

          <div v-if="!trimmedQuery" class="flex flex-col items-center mt-20px">
            <div class="mb-16px text-14px text-gray-400">{{ t('mobile_chat.quick_search') }}</div>
            <div class="grid grid-cols-3 gap-12px w-full max-w-300px">
              <van-button plain type="primary" size="small" icon="friends-o">{{ t('mobile_chat.members') }}</van-button>
              <van-button plain type="primary" size="small" icon="calendar-o">{{ t('mobile_chat.date') }}</van-button>
              <van-button
                plain
                type="primary"
                size="small"
                icon="photo-o"
                @click="router.push({ name: 'mobileMediaViewer' })">
                {{ t('mobile_chat.media') }}
              </van-button>
              <van-button plain type="primary" size="small" icon="description">{{ t('mobile_chat.files') }}</van-button>
              <van-button plain type="primary" size="small" icon="link-o">{{ t('mobile_chat.links') }}</van-button>
              <van-button plain type="primary" size="small" icon="music-o">{{ t('mobile_chat.audio') }}</van-button>
            </div>
          </div>

          <div v-else class="mt-12px">
            <div v-if="isSearching" class="flex justify-center py-30px">
              <van-loading size="20px" />
            </div>
            <div v-else-if="searchError" class="flex flex-col items-center gap-8px py-30px">
              <span class="text-12px text-[--tjg-text-tertiary]">{{ t('mobile_chat.search_failed') }}</span>
              <van-button size="small" plain @click="runSearch">{{ t('common.retry') }}</van-button>
            </div>
            <MobileAsyncState
              v-else-if="isEmptyResults"
              state="empty"
              :empty-text="t('mobile_chat.search_empty')"
              min-height="160px" />
            <div v-else class="flex flex-col gap-12px">
              <div
                v-for="item in results"
                :key="item.eventId"
                class="rounded-8px bg-[--tjg-surface-subtle] px-12px py-10px">
                <div class="flex items-center justify-between gap-8px text-12px text-[--tjg-text-tertiary]">
                  <span class="truncate">{{ senderName(item.sender) }}</span>
                  <span class="flex-shrink-0">{{ formatTime(item.timestamp) }}</span>
                </div>
                <p class="mt-4px text-14px text-[--tjg-text-primary] break-words line-clamp-3">
                  {{ messageBody(item) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import MobileAsyncState from '@/mobile/components/common/MobileAsyncState.vue'
import { matrixSearchService, type SearchResult } from '@/services/matrix/MatrixSearchService'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SearchChatContent')
const router = useRouter()
const { t } = useI18n()
const globalStore = useGlobalStore()
const groupStore = useGroupStore()

const searchQuery = ref('')
const results = ref<SearchResult[]>([])
const isSearching = ref(false)
const searchError = ref<unknown>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const trimmedQuery = computed(() => searchQuery.value.trim())

/** 已搜过但无结果：交给 MobileAsyncState 统一渲染 */
const isEmptyResults = computed(() => results.value.length === 0)

const senderName = (sender: string) => groupStore.getUserInfo(sender)?.name || sender

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString()

const messageBody = (item: SearchResult) => {
  const body = item.content?.body
  return typeof body === 'string' && body ? body : t('mobile_chat.search_unsupported')
}

const runSearch = async (): Promise<void> => {
  const query = trimmedQuery.value
  const roomId = globalStore.currentSessionRoomId
  if (!query || !roomId) {
    results.value = []
    searchError.value = null
    isSearching.value = false
    return
  }

  isSearching.value = true
  searchError.value = null
  try {
    const { results: found } = await matrixSearchService.searchRoomMessages(roomId, query)
    // 请求期间用户可能已改动关键字或切换房间，过期结果直接丢弃
    if (query !== trimmedQuery.value || roomId !== globalStore.currentSessionRoomId) return
    results.value = found
  } catch (err) {
    logger.error('Room search failed:', err)
    if (query !== trimmedQuery.value || roomId !== globalStore.currentSessionRoomId) return
    results.value = []
    searchError.value = err
  } finally {
    if (query === trimmedQuery.value) {
      isSearching.value = false
    }
  }
}

watch(trimmedQuery, () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (!trimmedQuery.value) {
    results.value = []
    searchError.value = null
    isSearching.value = false
    return
  }
  debounceTimer = setTimeout(() => void runSearch(), 300)
})

onBeforeUnmount(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
})
</script>
