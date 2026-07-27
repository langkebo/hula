<template>
  <div class="search-pane flex-1 min-h-0 flex flex-col">
    <!-- 搜索输入区 -->
    <div class="search-pane__input-area px-20px py-16px border-b border-[--hula-border-layout-divider]">
      <n-input
        ref="inputRef"
        :value="query"
        clearable
        :placeholder="t('search.placeholder')"
        :aria-label="t('search.placeholder')"
        class="search-pane__input"
        @update:value="handleInput"
        @keydown.esc="handleEsc">
        <template #prefix>
          <svg class="size-16px color-[--hula-text-tertiary]"><use href="#search" /></svg>
        </template>
      </n-input>
      <p v-if="appliedQuery" class="search-pane__meta text-(12px --hula-text-tertiary) mt-8px">
        {{ isLoading ? t('search.searching') : t('search.result_count', { count: totalCount }) }}
      </p>
    </div>

    <!-- 结果区 -->
    <n-scrollbar class="search-pane__results flex-1 min-h-0">
      <!-- 空状态 -->
      <div v-if="!hasQuery" class="search-pane__empty flex-center flex-col gap-16px py-60px">
        <svg class="size-48px opacity-40 color-[--hula-text-quaternary]"><use href="#search" /></svg>
        <p class="text-(13px --hula-text-tertiary)">{{ t('search.empty_hint') }}</p>
      </div>

      <!-- 加载骨架 -->
      <div v-else-if="isLoading && !hasResults" class="search-pane__loading px-20px py-16px">
        <n-skeleton v-for="i in 5" :key="i" height="48px" class="mb-8px" :sharp="false" style="border-radius: 8px" />
      </div>

      <!-- 错误状态 -->
      <div v-else-if="status === 'error'" class="search-pane__error flex-center flex-col gap-12px py-60px">
        <svg class="size-40px color-[--hula-color-danger-500]"><use href="#warning" /></svg>
        <p class="text-(13px --hula-color-danger-500)">{{ t('search.error') }}</p>
      </div>

      <!-- 无结果 -->
      <div v-else-if="!hasResults" class="search-pane__no-results flex-center flex-col gap-12px py-60px">
        <svg class="size-40px opacity-40 color-[--hula-text-quaternary]"><use href="#search" /></svg>
        <p class="text-(13px --hula-text-tertiary)">{{ t('search.no_results', { query: appliedQuery }) }}</p>
      </div>

      <!-- 分组结果 -->
      <div v-else class="search-pane__sections px-12px py-12px">
        <!-- 空间分组（type=space 模式） -->
        <section v-if="isSpaceMode && spaces.length" class="search-pane__section">
          <h3 class="search-pane__section-title">
            {{ t('search.section_spaces') }}
            <span class="search-pane__section-count">{{ spaces.length }}</span>
          </h3>
          <ul class="search-pane__list" role="list">
            <li v-for="space in spaces" :key="space.spaceId" class="search-pane__item" role="listitem">
              <n-avatar :size="36" :src="AvatarUtils.getAvatarUrl(space.avatarUrl || '')" />
              <div class="search-pane__item-info min-w-0 flex-1">
                <p class="search-pane__item-name text-(14px --hula-text-primary) truncate">
                  <template v-for="(seg, i) in highlightSegments(space.name)" :key="i">
                    <mark v-if="seg.matched" class="search-pane__mark">{{ seg.text }}</mark>
                    <template v-else>{{ seg.text }}</template>
                  </template>
                </p>
                <p class="search-pane__item-sub text-(12px --hula-text-tertiary) truncate">
                  {{ t('search.space_members', { count: space.memberCount }) }}
                </p>
              </div>
              <n-button size="small" type="primary" secondary @click="handleJoinSpace(space.spaceId)">
                {{ t('search.join_space') }}
              </n-button>
            </li>
          </ul>
        </section>

        <!-- 用户分组（type=all 模式） -->
        <section v-if="!isSpaceMode && results.users.length" class="search-pane__section">
          <h3 class="search-pane__section-title">
            {{ t('search.section_users') }}
            <span class="search-pane__section-count">{{ results.users.length }}</span>
          </h3>
          <ul class="search-pane__list" role="list">
            <li
              v-for="user in results.users"
              :key="user.userId"
              class="search-pane__item"
              role="listitem"
              tabindex="0"
              @click="handleUserClick(user)"
              @keydown.enter="handleUserClick(user)">
              <n-avatar round :size="36" :src="AvatarUtils.getAvatarUrl(user.avatarUrl || '')" />
              <div class="search-pane__item-info min-w-0 flex-1">
                <p class="search-pane__item-name text-(14px --hula-text-primary) truncate">
                  <template v-for="(seg, i) in highlightSegments(user.displayName || user.userId)" :key="i">
                    <mark v-if="seg.matched" class="search-pane__mark">{{ seg.text }}</mark>
                    <template v-else>{{ seg.text }}</template>
                  </template>
                </p>
                <p class="search-pane__item-sub text-(12px --hula-text-tertiary) truncate">{{ user.userId }}</p>
              </div>
              <svg class="search-pane__item-icon size-16px color-[--hula-text-quaternary]">
                <use href="#right-bar" />
              </svg>
            </li>
          </ul>
        </section>

        <!-- 房间分组（type=all 模式） -->
        <section v-if="!isSpaceMode && results.rooms.length" class="search-pane__section">
          <h3 class="search-pane__section-title">
            {{ t('search.section_rooms') }}
            <span class="search-pane__section-count">{{ results.rooms.length }}</span>
          </h3>
          <ul class="search-pane__list" role="list">
            <li
              v-for="room in results.rooms"
              :key="room.roomId"
              class="search-pane__item"
              role="listitem"
              tabindex="0"
              @click="handleRoomClick(room)"
              @keydown.enter="handleRoomClick(room)">
              <n-avatar :size="36" :src="AvatarUtils.getAvatarUrl(room.avatarUrl || '')" />
              <div class="search-pane__item-info min-w-0 flex-1">
                <p class="search-pane__item-name text-(14px --hula-text-primary) truncate">
                  <template v-for="(seg, i) in highlightSegments(room.roomName)" :key="i">
                    <mark v-if="seg.matched" class="search-pane__mark">{{ seg.text }}</mark>
                    <template v-else>{{ seg.text }}</template>
                  </template>
                </p>
                <p class="search-pane__item-sub text-(12px --hula-text-tertiary) truncate">
                  {{ t('search.room_members', { count: room.memberCount }) }}
                </p>
              </div>
              <svg class="search-pane__item-icon size-16px color-[--hula-text-quaternary]">
                <use href="#right-bar" />
              </svg>
            </li>
          </ul>
        </section>

        <!-- 消息分组（type=all 模式） -->
        <section v-if="!isSpaceMode && results.messages.length" class="search-pane__section">
          <h3 class="search-pane__section-title">
            {{ t('search.section_messages') }}
            <span class="search-pane__section-count">{{ results.messages.length }}</span>
          </h3>
          <ul class="search-pane__list" role="list">
            <li
              v-for="msg in results.messages"
              :key="msg.eventId"
              class="search-pane__item"
              role="listitem"
              tabindex="0"
              @click="handleMessageClick(msg)"
              @keydown.enter="handleMessageClick(msg)">
              <div class="search-pane__msg-avatar flex-center size-36px rounded-8px bg-[--hula-surface-list-hover]">
                <svg class="size-16px color-[--hula-text-tertiary]"><use href="#message" /></svg>
              </div>
              <div class="search-pane__item-info min-w-0 flex-1">
                <p class="search-pane__item-name text-(13px --hula-text-primary) truncate">
                  {{ msg.roomName || msg.roomId }}
                </p>
                <p class="search-pane__item-sub text-(12px --hula-text-tertiary) truncate">
                  {{ extractMessagePreview(msg) }}
                </p>
              </div>
              <span class="search-pane__item-time text-(11px --hula-text-quaternary) shrink-0">
                {{ formatMessageTime(msg.timestamp) }}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { type HighlightSegment, highlightSearchMatch } from '@/components/friend/highlightSearchMatch'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useGlobalSearch } from '@/composables/search/useGlobalSearch'
import type { RoomSearchResult, SearchResult, UserSearchResult } from '@/services/matrix/MatrixSearchService'
import type { SpaceInfo } from '@/services/matrix/room/MatrixSpaceService'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SearchPane')

const props = defineProps<{
  /** 外部传入的初始搜索词（来自路由 query.q） */
  initialQuery?: string
  /** 搜索类型：'all' 全分类（用户+房间+消息），'space' 仅空间 */
  type?: 'all' | 'space'
}>()

const emit = defineEmits<{
  /** 用户点击结果项时通知父级（可选，用于关闭面板等） */
  select: [type: 'user' | 'room' | 'message' | 'space', id: string]
}>()

const { t } = useI18n()
const router = useRouter()
const { showFeedback } = useActionFeedback()
const inputRef = ref<{ focus?: () => void; input?: HTMLInputElement } | null>(null)

const isSpaceMode = computed(() => props.type === 'space')

// 全局搜索（type='all'）
const globalSearch = useGlobalSearch()

// 空间搜索（type='space'）
const spaces = ref<SpaceInfo[]>([])
const spaceStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')

// 竞态保护：每次发起搜索时递增 epoch，返回结果时若不匹配则丢弃，
// 避免过期响应覆盖最新结果（与 useGlobalSearch 实现一致，参考需求文档 16.1）
let spaceRequestEpoch = 0
let spaceAbortController: AbortController | null = null

// 统一派生状态：根据模式切换数据源
const query = globalSearch.query
const appliedQuery = globalSearch.appliedQuery
const results = globalSearch.results
const status = computed(() => (isSpaceMode.value ? spaceStatus.value : globalSearch.status.value))
const isLoading = computed(() => status.value === 'loading')
const hasQuery = globalSearch.hasQuery
const hasResults = computed(() => (isSpaceMode.value ? spaces.value.length > 0 : globalSearch.hasResults.value))
const totalCount = computed(() => (isSpaceMode.value ? spaces.value.length : globalSearch.totalCount.value))

/** 取消当前进行中的空间搜索请求，使其结果不会被应用 */
const abortSpaceInFlight = () => {
  if (spaceAbortController) {
    spaceAbortController.abort()
    spaceAbortController = null
  }
}

const executeSpaceSearch = useDebounceFn(async (rawQuery: string) => {
  const trimmed = rawQuery.trim()
  if (!trimmed) {
    abortSpaceInFlight()
    spaceRequestEpoch++
    spaces.value = []
    spaceStatus.value = 'idle'
    appliedQuery.value = ''
    return
  }

  // 取消前一次请求
  abortSpaceInFlight()
  const myEpoch = ++spaceRequestEpoch
  spaceAbortController = new AbortController()
  const signal = spaceAbortController.signal

  appliedQuery.value = trimmed
  spaceStatus.value = 'loading'
  try {
    const result = await matrixSpaceService.searchSpaces(trimmed, 20)
    // 检查请求是否已被取消（过期）
    if (signal.aborted || myEpoch !== spaceRequestEpoch) {
      logger.debug(`[SearchPane] 空间搜索请求已被取消，丢弃结果: "${trimmed}"`)
      return
    }
    spaces.value = result
    spaceStatus.value = 'success'
  } catch (err) {
    if (signal.aborted || myEpoch !== spaceRequestEpoch) {
      return
    }
    logger.error('space search failed', err)
    spaces.value = []
    spaceStatus.value = 'error'
  }
}, 300)

const search = (value: string) => {
  query.value = value
  if (isSpaceMode.value) {
    void executeSpaceSearch(value)
  } else {
    globalSearch.search(value)
  }
}

const clear = () => {
  abortSpaceInFlight()
  spaceRequestEpoch++
  globalSearch.clear()
  spaces.value = []
  spaceStatus.value = 'idle'
}

const highlightSegments = (text: string): HighlightSegment[] => {
  return highlightSearchMatch(text || '', appliedQuery.value)
}

const extractMessagePreview = (msg: SearchResult): string => {
  const body = msg.content?.body
  if (typeof body === 'string') return body
  return ''
}

const formatMessageTime = (ts: number): string => {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const handleInput = (value: string) => {
  search(value)
}

const handleEsc = () => {
  clear()
}

const handleUserClick = (user: UserSearchResult) => {
  emit('select', 'user', user.userId)
  void router.push({ name: 'friend-details', params: { userId: user.userId } })
}

const handleRoomClick = (room: RoomSearchResult) => {
  emit('select', 'room', room.roomId)
  void router.push({ name: 'room-details', params: { roomId: room.roomId } })
}

const handleMessageClick = (msg: SearchResult) => {
  emit('select', 'message', msg.eventId)
  void router.push(`/message/${msg.roomId}`)
}

const handleJoinSpace = async (spaceId: string) => {
  try {
    await matrixSpaceService.joinSpace(spaceId)
    showFeedback(t('search.join_success'), 'success')
  } catch (err) {
    logger.error('join space failed', err)
    showFeedback(t('search.join_failed'), 'error')
  }
}

const focusInput = () => {
  nextTick(() => {
    const el = inputRef.value?.input
    if (el) {
      el.focus()
    }
  })
}

watch(
  () => props.initialQuery,
  (value) => {
    if (value && value !== query.value) {
      search(value)
    }
  },
  { immediate: true }
)

onMounted(() => {
  focusInput()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/mixins/liquid-glass' as *;

.search-pane {
  &__input-area {
    // 阶段 9：玻璃质感（需求文档 3.4.5b）—— 搜索结果面板使用 16px / 90% / 150%
    @include liquid-glass(16px, 0.9, 1.5);
    border-radius: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--hula-border-layout-divider) 50%, transparent);
  }

  &__input {
    :deep(.n-input__input-el) {
      font-size: 14px;
    }
  }

  &__section {
    margin-bottom: 16px;
  }

  &__section-title {
    align-items: center;
    color: var(--hula-text-secondary);
    display: flex;
    font-size: 12px;
    font-weight: 600;
    gap: 8px;
    letter-spacing: 0.04em;
    margin: 0 0 8px;
    padding: 0 8px;
    text-transform: uppercase;
  }

  &__section-count {
    background: var(--hula-surface-list-hover);
    border-radius: var(--hula-radius-full);
    color: var(--hula-text-tertiary);
    font-size: 11px;
    font-weight: 500;
    min-width: 20px;
    padding: 1px 6px;
    text-align: center;
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  &__item {
    align-items: center;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    gap: 10px;
    padding: 8px 10px;
    transition: background-color 0.15s ease;

    &:hover,
    &:focus-visible {
      background: var(--hula-surface-list-hover);
      outline: none;
    }
  }

  &__item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__mark {
    background: var(--hula-color-warning-100);
    border-radius: 2px;
    color: inherit;
    padding: 0 1px;
  }
}
</style>
