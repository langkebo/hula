<template>
  <div class="flex flex-col h-full bg-[--center-bg-color]">
    <NavBar :title="t('mobile_tabbar.items.rooms')">
      <template #right>
        <van-icon
          name="add-o"
          size="22"
          class="color-[--hula-text-primary]"
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
        background="transparent"
        @search="onSearch" />
    </div>

    <!-- 加载状态 -->
    <van-loading v-if="loading" size="24px" class="flex justify-center py-40px" />

    <!-- 空状态 -->
    <van-empty
      v-else-if="!loading && roomList.length === 0"
      :description="searchText ? t('mobile_rooms.no_search_result') : t('mobile_rooms.no_rooms')">
      <van-button
        v-if="!searchText"
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
        class="h-full overflow-y-auto overflow-x-hidden"
        :items="roomList"
        :item-height="72"
        :buffer="6"
        key-field="roomId">
        <template #default="{ item: room }">
          <van-swipe-cell>
            <div
              :data-testid="`mobile-room-item-${room.roomId}`"
              class="flex items-center gap-12px px-16px py-12px tap-highlight"
              @click="enterRoom(room.roomId)">
              <img
                class="size-48px rounded-12px object-cover flex-shrink-0"
                :src="room.avatarUrl || '/logo.png'"
                :alt="room.name"
                loading="lazy"
                decoding="async"
                @error="($event.target as HTMLImageElement).src = '/logo.png'" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-6px">
                  <span class="text-15px font-500 text-[--hula-text-primary] truncate">{{ room.name }}</span>
                  <span
                    v-if="room.isEncrypted"
                    class="text-12px color-[--hula-color-success-500]"
                    :aria-label="t('mobile_rooms.encrypted')">
                    &#x1F512;
                  </span>
                </div>
                <div class="text-12px text-[--hula-text-tertiary] truncate mt-2px">
                  {{ room.topic || t('mobile_rooms.no_topic') }}
                </div>
              </div>
              <div class="flex flex-col items-end gap-4px flex-shrink-0">
                <span class="text-11px text-[--hula-text-tertiary]">
                  {{ room.memberCount }} {{ t('mobile_rooms.members') }}
                </span>
                <van-icon
                  v-if="room.joinRule === 'public'"
                  name="friends-o"
                  size="14"
                  class="color-[--hula-text-tertiary]"
                  :aria-label="t('mobile_rooms.public_room')" />
              </div>
            </div>
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
          class="flex items-center gap-8px py-8px border-b border-[--hula-border-default]">
          <div class="flex-1 min-w-0">
            <div class="text-14px font-medium truncate">{{ result.roomName || result.roomId }}</div>
            <div class="text-12px text-[--hula-text-tertiary] truncate">{{ result.roomId }}</div>
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
import SmartVirtualList from '@/mobile/components/virtual-scroll/SmartVirtualList.vue'
import { matrixSearchService } from '@/services/matrix/MatrixSearchService'
import { matrixRoomCreationService } from '@/services/matrix/room/CreationService'
import { matrixRoomMembershipService } from '@/services/matrix/room/MembershipService'
import { matrixRoomQueryFacade } from '@/services/matrix/room/QueryFacade'
import type { Room } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileRooms')

interface RoomItem {
  roomId: string
  name: string
  avatarUrl: string
  topic: string
  memberCount: number
  joinRule: string
  isEncrypted: boolean
}

const { t } = useI18n()
const router = useRouter()

const searchText = ref('')
const loading = ref(true)
const refreshing = ref(false)
const showCreateMenu = ref(false)
const roomList = ref<RoomItem[]>([])

const showJoinDialog = ref(false)
const joinRoomId = ref('')
const showPublicSearchDialog = ref(false)
const publicSearchQuery = ref('')
const publicSearchResults = ref<any[]>([])
const publicSearchLoading = ref(false)

const createActions = computed(() => [
  { name: t('mobile_rooms.create_room'), value: 'create' },
  { name: t('mobile_rooms.join_room'), value: 'join' },
  { name: t('mobile_rooms.search_public_rooms'), value: 'search' }
])

function mapRoomToItem(room: Room): RoomItem {
  return {
    roomId: room.roomId,
    name: room.name || t('mobile_rooms.unnamed_room'),
    avatarUrl: room.getMxcAvatarUrl?.() ?? '',
    topic: (room.currentState?.getStateEvents?.('m.room.topic', '')?.getContent?.()?.topic as string | undefined) ?? '',
    memberCount: room.getJoinedMemberCount?.() ?? 0,
    joinRule: room.getJoinRule?.() ?? 'invite',
    isEncrypted: room.currentState?.getStateEvents?.('m.room.encryption', '') !== null
  }
}

async function fetchRooms() {
  try {
    const rooms = await matrixRoomQueryFacade.getRooms()
    roomList.value = rooms.map(mapRoomToItem)
  } catch (e) {
    logger.error('Failed to fetch rooms:', e)
    showToast({ type: 'fail', message: t('mobile_rooms.load_failed') })
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onSearch() {
  if (!searchText.value.trim()) {
    fetchRooms()
    return
  }
  loading.value = true
  matrixSearchService
    .searchRooms(searchText.value.trim())
    .then((results) => {
      roomList.value = results.map((r) => ({
        roomId: r.roomId,
        name: r.roomName || t('mobile_rooms.unnamed_room'),
        avatarUrl: r.avatarUrl ?? '',
        topic: '',
        memberCount: r.memberCount,
        joinRule: 'invite',
        isEncrypted: false
      }))
    })
    .catch((e) => {
      logger.error('Room search failed:', e)
      showToast({ type: 'fail', message: t('mobile_rooms.search_failed') })
    })
    .finally(() => {
      loading.value = false
    })
}

function onRefresh() {
  refreshing.value = true
  fetchRooms()
}

function enterRoom(roomId: string) {
  router.push(`/mobile/chatRoom/chatMain/${roomId}`)
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
  } catch (e: any) {
    if (e !== 'cancel') {
      logger.error('Create room failed:', e)
      showToast({ type: 'fail', message: e?.message || t('mobile_rooms.create_failed') })
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
  } catch (e: any) {
    logger.error('Join room failed:', e)
    showToast({ type: 'fail', message: e?.message || t('mobile_rooms.join_failed') })
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
  } catch (e: any) {
    logger.error('Public room search failed:', e)
    showToast({ type: 'fail', message: e?.message || t('mobile_rooms.search_failed') })
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
  } catch (e: any) {
    logger.error('Join public room failed:', e)
    showToast({ type: 'fail', message: e?.message || t('mobile_rooms.join_failed') })
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
  } catch (e: any) {
    if (e !== 'cancel') {
      logger.error('Leave room failed:', e)
      showToast({ type: 'fail', message: e?.message || t('mobile_rooms.leave_failed') })
    }
  }
}

fetchRooms()
</script>

<style scoped lang="scss">
.tap-highlight {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;

  &:active {
    background-color: var(--hula-bg-pressed);
  }
}
</style>
