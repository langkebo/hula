<template>
  <div class="tjg-aurora flex flex-col h-full">
    <NavBar :title="t('mobile_tabbar.items.rooms')">
      <template #right>
        <van-icon
          name="add-o"
          size="22"
          class="relative color-[--tjg-text-primary] after:absolute after:-inset-11px after:content-['']"
          :data-testid="'mobile-rooms-add'"
          @click="showCreateMenu = true" />
      </template>
    </NavBar>

    <!-- 搜索栏 -->
    <div class="px-16px py-8px">
      <van-search
        v-model="searchText"
        :placeholder="t('mobile_rooms.search_placeholder')"
        shape="round"
        background="transparent" />
    </div>

    <!-- 筛选：仅展示当前数据能支撑的选项 -->
    <div class="px-16px pb-8px flex gap-8px overflow-x-auto room-filter-row">
      <button
        v-for="filter in availableFilters"
        :key="filter"
        type="button"
        class="room-filter-chip"
        :class="{ 'room-filter-chip--active': activeFilter === filter }"
        :data-testid="`mobile-rooms-filter-${filter}`"
        :aria-pressed="activeFilter === filter"
        @click="activeFilter = filter">
        {{ filterLabels[filter] }}
      </button>
    </div>

    <!-- 加载状态 -->
    <van-loading v-if="loading" size="24px" class="flex justify-center py-40px" />

    <!-- 加载失败：给出重试出口，而不是伪装成「暂无群聊」 -->
    <van-empty v-else-if="loadError" :description="t('mobile_rooms.load_failed')">
      <van-button round type="primary" :data-testid="'mobile-rooms-retry'" @click="retryLoad">
        {{ t('common.retry') }}
      </van-button>
    </van-empty>

    <!-- 空状态 -->
    <van-empty v-else-if="filteredRooms.length === 0" :description="emptyDescription">
      <van-button
        v-if="roomList.length === 0 && !hasActiveConditions"
        round
        type="primary"
        :data-testid="'mobile-rooms-create-first'"
        @click="showCreateMenu = true">
        {{ t('mobile_rooms.create_first') }}
      </van-button>
    </van-empty>

    <!-- 房间列表 -->
    <van-pull-refresh v-else v-model="refreshing" @refresh="onRefresh" class="flex-1 min-h-0">
      <SmartVirtualList
        class="rooms-glass-list h-full overflow-y-auto overflow-x-hidden"
        :items="filteredRooms"
        :item-height="80"
        :buffer="6"
        key-field="roomId">
        <template #default="{ item: room }">
          <van-swipe-cell>
            <MobileRoomCard
              :item="room"
              :summary-text="room.summary || t('mobile_rooms.no_message')"
              :time-label="formatRoomActiveTime(room.activeTime, t('menu.yesterday'))"
              :members-label="t('mobile_rooms.members')"
              :encrypted-label="t('mobile_rooms.encrypted')"
              @click="enterRoom(room.roomId)" />
            <template #right>
              <van-button square type="danger" class="h-full" @click="handleLeaveRoom(room.roomId)">
                {{ t('mobile_rooms.leave_room') }}
              </van-button>
            </template>
          </van-swipe-cell>
        </template>
      </SmartVirtualList>
    </van-pull-refresh>

    <!-- 创建菜单弹出层 -->
    <van-action-sheet
      v-model:show="showCreateMenu"
      :actions="createActions"
      :cancel-text="t('common.cancel')"
      @select="onCreateSelect" />

    <!-- 加入房间 Dialog -->
    <van-dialog
      v-model:show="showJoinDialog"
      :title="t('mobile_rooms.join_room')"
      show-cancel-button
      :confirm-button-text="t('common.confirm')"
      :cancel-button-text="t('common.cancel')"
      :before-close="beforeCloseJoinRoom">
      <van-field
        v-model="joinRoomId"
        :placeholder="t('mobile_rooms.join_room_prompt')"
        class="mx-16px my-12px rounded-8px" />
    </van-dialog>

    <!-- 公开房间搜索 Dialog -->
    <van-dialog
      v-model:show="showPublicSearchDialog"
      :title="t('mobile_rooms.search_public_rooms')"
      show-cancel-button
      :confirm-button-text="t('mobile_rooms.search_btn')"
      :cancel-button-text="t('common.cancel')"
      :before-close="beforeClosePublicSearch">
      <van-field
        v-model="publicSearchQuery"
        :placeholder="t('mobile_rooms.search_public_rooms_placeholder')"
        class="mx-16px mb-8px mt-12px rounded-8px" />
      <div v-if="publicSearchLoading" class="flex justify-center py-20px">
        <van-loading size="20px" />
      </div>
      <div v-else-if="publicSearchResults.length > 0" class="px-16px pb-12px max-h-300px overflow-y-auto">
        <div
          v-for="result in publicSearchResults"
          :key="result.roomId"
          class="flex items-center gap-8px py-8px border-b border-[--tjg-border-default]">
          <div class="flex-1 min-w-0">
            <div class="text-14px font-medium truncate">{{ result.roomName || result.roomId }}</div>
            <div class="text-12px text-[--tjg-text-tertiary] truncate">{{ result.roomId }}</div>
          </div>
          <van-button size="small" type="primary" plain @click="joinPublicRoom(result.roomId)">
            {{ t('mobile_rooms.join_room') }}
          </van-button>
        </div>
      </div>
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { showConfirmDialog, showToast } from 'vant'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import MobileRoomCard from '@/mobile/components/rooms/MobileRoomCard.vue'
import SmartVirtualList from '@/mobile/components/virtual-scroll/SmartVirtualList.vue'
import {
  buildRoomCardModels,
  filterRoomCards,
  formatRoomActiveTime,
  type RoomFilter,
  type RoomListSource,
  type RoomSessionSnapshot,
  resolveAvailableRoomFilters
} from '@/mobile/views/rooms/roomListModel'
import { matrixSearchService } from '@/services/matrix/MatrixSearchService'
import { matrixRoomCreationService } from '@/services/matrix/room/CreationService'
import { matrixRoomMembershipService } from '@/services/matrix/room/MembershipService'
import { matrixRoomQueryFacade } from '@/services/matrix/room/RoomFacade'
import type { Room } from '@/services/matrix/sdk'
import { type SessionItem, useSessionStore } from '@/stores/domains/chat/chat/session'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileRooms')

interface PublicRoomResult {
  roomId: string
  roomName?: string | undefined
  avatarUrl?: string | undefined
  memberCount?: number | undefined
}

const { t } = useI18n()
const router = useRouter()
const sessionStore = useSessionStore()
const userStore = useUserStore()

const searchText = ref('')
const activeFilter = ref<RoomFilter>('all')
const loading = ref(true)
const loadError = ref(false)
const refreshing = ref(false)
const showCreateMenu = ref(false)
const roomList = ref<RoomListSource[]>([])

const showJoinDialog = ref(false)
const joinRoomId = ref('')
const showPublicSearchDialog = ref(false)
const publicSearchQuery = ref('')
const publicSearchResults = ref<PublicRoomResult[]>([])
const publicSearchLoading = ref(false)

const createActions = computed(() => [
  { name: t('mobile_rooms.create_room'), value: 'create' },
  { name: t('mobile_rooms.join_room'), value: 'join' },
  { name: t('mobile_rooms.search_public_rooms'), value: 'search' }
])

const filterLabels = computed<Record<RoomFilter, string>>(() => ({
  all: t('mobile_rooms.filter_all'),
  public: t('mobile_rooms.filter_public'),
  private: t('mobile_rooms.filter_private'),
  owned: t('mobile_rooms.filter_owned')
}))

const toSessionSnapshot = (session: SessionItem): RoomSessionSnapshot => ({
  unreadCount: session.unreadCount,
  activeTime: session.activeTime,
  text: session.text
})

const sessionSnapshot = computed<Record<string, RoomSessionSnapshot>>(() => {
  const snapshot: Record<string, RoomSessionSnapshot> = {}
  for (const session of sessionStore.sessionList) {
    snapshot[session.roomId] = toSessionSnapshot(session)
  }
  for (const [roomId, session] of Object.entries(sessionStore.sessionMap)) {
    snapshot[roomId] = toSessionSnapshot(session)
  }
  return snapshot
})

const roomCards = computed(() =>
  buildRoomCardModels(roomList.value, sessionSnapshot.value, (userId) => userStore.isMe(userId))
)

const availableFilters = computed(() => resolveAvailableRoomFilters(roomCards.value))

// 数据刷新后若当前筛选项已不可用（例如创建者信息缺失），回退到「全部」，避免出现无选中项的空列表。
watch(availableFilters, (filters) => {
  if (!filters.includes(activeFilter.value)) {
    activeFilter.value = 'all'
  }
})

const filteredRooms = computed(() => filterRoomCards(roomCards.value, searchText.value, activeFilter.value))

const hasActiveConditions = computed(() => searchText.value.trim().length > 0 || activeFilter.value !== 'all')

const emptyDescription = computed(() =>
  hasActiveConditions.value ? t('mobile_rooms.no_search_result') : t('mobile_rooms.no_rooms')
)

function mapRoomToSource(room: Room): RoomListSource {
  const members = room.getJoinedMembers()
  return {
    roomId: room.roomId,
    name: room.name || t('mobile_rooms.unnamed_room'),
    avatarUrl: room.getMxcAvatarUrl?.() ?? '',
    memberCount: room.getJoinedMemberCount?.() ?? members.length,
    joinRule: String(room.getJoinRule?.() ?? 'invite'),
    isEncrypted: Boolean(room.currentState?.getStateEvents?.('m.room.encryption', '')),
    creatorId: room.getCreator?.() ?? null,
    memberNames: members.map((member) => member.name || member.userId)
  }
}

async function fetchRooms() {
  try {
    const rooms = await matrixRoomQueryFacade.getRooms()
    roomList.value = rooms.map(mapRoomToSource)
    loadError.value = false
  } catch (e) {
    logger.error('Failed to fetch rooms:', e)
    loadError.value = true
    showToast({ type: 'fail', message: t('mobile_rooms.load_failed') })
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function retryLoad() {
  loading.value = true
  loadError.value = false
  fetchRooms()
}

function onRefresh() {
  refreshing.value = true
  fetchRooms()
}

function enterRoom(roomId: string) {
  router.push({ name: 'mobileChatMain', params: { roomId } })
}

async function onCreateSelect(action: { value: string }) {
  showCreateMenu.value = false

  switch (action.value) {
    case 'create':
      await handleCreateRoom()
      break
    case 'join':
      joinRoomId.value = ''
      showJoinDialog.value = true
      break
    case 'search':
      publicSearchQuery.value = ''
      publicSearchResults.value = []
      showPublicSearchDialog.value = true
      break
  }
}

async function handleCreateRoom() {
  try {
    await showConfirmDialog({
      title: t('mobile_rooms.create_room'),
      message: t('mobile_rooms.create_room_prompt')
    })
    showToast({ type: 'loading', message: t('mobile_rooms.creating'), forbidClick: true })
    await matrixRoomCreationService.createRoom({})
    showToast({ type: 'success', message: t('mobile_rooms.create_success') })
    await fetchRooms()
  } catch (e) {
    if (String(e) !== 'cancel') {
      logger.error('Create room failed:', e)
      showToast({
        type: 'fail',
        message: e instanceof Error ? e.message : String(e) || t('mobile_rooms.create_failed')
      })
    }
  }
}

async function beforeCloseJoinRoom(action: string): Promise<boolean> {
  if (action === 'cancel') {
    showJoinDialog.value = false
    return true
  }

  const roomId = joinRoomId.value.trim()
  if (!roomId) {
    showToast({ type: 'fail', message: t('mobile_rooms.join_room_prompt') })
    return false
  }

  try {
    showToast({ type: 'loading', message: t('mobile_rooms.joining'), forbidClick: true })
    await matrixRoomMembershipService.joinRoom(roomId)
    showToast({ type: 'success', message: t('mobile_rooms.join_success') })
    showJoinDialog.value = false
    await fetchRooms()
    return true
  } catch (e) {
    logger.error('Join room failed:', e)
    showToast({ type: 'fail', message: e instanceof Error ? e.message : String(e) || t('mobile_rooms.join_failed') })
    return false
  }
}

async function beforeClosePublicSearch(action: string): Promise<boolean> {
  if (action === 'cancel') {
    showPublicSearchDialog.value = false
    return true
  }

  const query = publicSearchQuery.value.trim()
  if (!query) {
    return true // Allow closing empty dialog
  }

  publicSearchLoading.value = true
  try {
    const result = await matrixSearchService.searchPublicRooms(query)
    publicSearchResults.value = result || []
  } catch (e) {
    logger.error('Public room search failed:', e)
    showToast({ type: 'fail', message: e instanceof Error ? e.message : String(e) || t('mobile_rooms.search_failed') })
  } finally {
    publicSearchLoading.value = false
  }
  return false // Keep dialog open to show results
}

async function joinPublicRoom(roomId: string) {
  try {
    showToast({ type: 'loading', message: t('mobile_rooms.joining'), forbidClick: true })
    await matrixRoomMembershipService.joinRoom(roomId)
    showToast({ type: 'success', message: t('mobile_rooms.join_success') })
    showPublicSearchDialog.value = false
    await fetchRooms()
  } catch (e) {
    logger.error('Join public room failed:', e)
    showToast({ type: 'fail', message: e instanceof Error ? e.message : String(e) || t('mobile_rooms.join_failed') })
  }
}

async function handleLeaveRoom(roomId: string) {
  try {
    await showConfirmDialog({
      title: t('mobile_rooms.leave_room'),
      message: t('mobile_rooms.leave_room_confirm')
    })
    showToast({ type: 'loading', message: t('mobile_rooms.leaving'), forbidClick: true })
    await matrixRoomMembershipService.leaveRoom(roomId)
    showToast({ type: 'success', message: t('mobile_rooms.leave_success') })
    await fetchRooms()
  } catch (e) {
    if (e !== 'cancel') {
      logger.error('Leave room failed:', e)
      showToast({ type: 'fail', message: e instanceof Error ? e.message : String(e) || t('mobile_rooms.leave_failed') })
    }
  }
}

fetchRooms()
</script>

<style scoped lang="scss">
/* 筛选 chip：沿用设计 token，避免硬编码颜色 */
.room-filter-row {
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.room-filter-chip {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: var(--tjg-radius-full, 999px);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
  background: var(--tjg-surface-input);
  transition: background-color 0.15s ease;

  &--active {
    color: var(--tjg-text-inverse);
    background: var(--tjg-color-primary-500);
  }
}

/* 房间列表：整条列表作为一块玻璃面，单行保持透明避免长列表逐行模糊掉帧 */
.rooms-glass-list {
  margin: 0 12px 12px;
  border-radius: var(--tjg-radius-xl);
  background: var(--tjg-glass-row-bg);
  border: var(--tjg-glass-border-soft);
  box-shadow: var(--tjg-glass-inner-highlight);
  overflow-y: auto;
}
</style>
