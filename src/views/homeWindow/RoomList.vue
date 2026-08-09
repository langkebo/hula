<template>
  <ListWorkbenchShell class="room-list-page" role="main" :aria-label="t('home.plugins.room_list')">
    <template #toolbar>
      <MessageSessionToolbar
        :search-keyword="searchKeyword"
        :session-type-filter="sessionTypeFilter"
        :session-engagement-filter="sessionEngagementFilter"
        :session-sort="sessionSort"
        :filtered-count="filteredRoomSessionList.length"
        :total-count="roomSessionList.length"
        :title="t('home.plugins.room_list_short_title')"
        :aria-label="t('home.plugins.room_list_short_title')"
        :show-create-action="true"
        :show-join-action="true"
        :create-button-text="t('room.create.create')"
        @update:search-keyword="setSearchKeyword"
        @update:session-type-filter="setSessionTypeFilter"
        @update:session-engagement-filter="setSessionEngagementFilter"
        @update:session-sort="setSessionSort"
        @create-room="handleCreateRoom"
        @join-room="handleJoinRoom"
        @search-submit="handleSearchSubmit" />
    </template>

    <template #default>
      <div class="room-list-page__content flex flex-col h-full">
        <div
          class="room-list-page__tabs flex items-center justify-between px-[--tjg-space-3] py-[--tjg-space-2] border-b border-[--tjg-border-muted]">
          <RoomMembershipTabs v-model="membershipFilter" :joined-count="joinedCount" :created-count="createdCount" />
        </div>

        <RoomCardGrid
          :rooms="filteredRoomCardViewModels"
          :loading="syncLoading || chatStore.sessionOptions.isLoading"
          :empty-description="emptyDescription"
          @preview="handleCardPreview"
          @message="handleCardMessage"
          @info="handleCardInfo"
          @settings="handleCardSettings"
          @pin="handleCardPin" />
      </div>
    </template>
  </ListWorkbenchShell>
</template>
<script lang="ts" setup name="roomList">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import RoomCardGrid from '@/components/room/RoomCardGrid.vue'
import RoomMembershipTabs from '@/components/room/RoomMembershipTabs.vue'
import ListWorkbenchShell from '@/components/workbench/ListWorkbenchShell.vue'
import MessageSessionToolbar from '@/components/workbench/MessageSessionToolbar.vue'
import { useMessage } from '@/composables/chat/useMessage'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { useTauriListener } from '@/composables/common/useTauriListener'
import { useRoomCardViewModels } from '@/composables/room/useRoomCardViewModels'
import { useRoomMembershipFilter } from '@/composables/room/useRoomMembershipFilter'
import { useMessageSessionFilters } from '@/composables/workbench/useMessageSessionFilters'
import { useSessionListState } from '@/composables/workbench/useSessionListState'
import { useSessionPageSync } from '@/composables/workbench/useSessionPageSync'
import { useWorkbenchSessionQuerySync } from '@/composables/workbench/useWorkbenchSessionQuerySync'
import { MittEnum, RoomTypeEnum } from '@/enums'
import { WORKBENCH_SESSION_ENGAGEMENT_FILTERS, WORKBENCH_SESSION_TYPE_FILTERS } from '@/router/spaceNavigation'
import { matrixSessionService } from '@/services/matrix/auth/MatrixSessionService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { hasTauriRuntime } from '@/utils/AppHarness'

const { t } = useI18n()
const router = useRouter()
const { showFeedback } = useActionFeedback()
const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const { addListener } = useTauriListener()
const { handleMsgClick, handleMsgDelete } = useMessage()
const { chatStore, globalStore, syncLoading, sessionList, invalidateSessionCache } = useSessionListState()

const roomSessionList = computed(() => sessionList.value.filter((item) => item.type === RoomTypeEnum.GROUP))
const {
  searchKeyword,
  sessionTypeFilter,
  sessionEngagementFilter,
  sessionSort,
  filteredSessionList: filteredRoomSessionList,
  ensureSessionVisible,
  setSearchKeyword,
  setSessionTypeFilter,
  setSessionEngagementFilter,
  setSessionSort
} = useMessageSessionFilters(roomSessionList)

const groupStore = useGroupStore()
const currentUserId = matrixClientService.getUserId()

const { roomCardViewModels } = useRoomCardViewModels(filteredRoomSessionList, {
  groupInfoMap: groupStore.groupInfoMap,
  loadGroupInfo: groupStore.loadGroupInfo
})

const membershipFilterableRooms = computed(() =>
  roomCardViewModels.value.map((vm) => ({
    roomId: vm.roomId,
    membership: 'join' as const,
    creator: groupStore.groupInfoMap[vm.roomId]?.creator ?? null
  }))
)

const { activeFilter: membershipFilter, filteredRooms: membershipFilteredRooms } = useRoomMembershipFilter(
  membershipFilterableRooms,
  { currentUserId }
)

const filteredRoomCardViewModels = computed(() => {
  const filteredIds = new Set(membershipFilteredRooms.value.map((r) => r.roomId))
  return roomCardViewModels.value.filter((vm) => filteredIds.has(vm.roomId))
})

const joinedCount = computed(
  () => membershipFilterableRooms.value.filter((r) => r.membership === 'join' && r.creator !== currentUserId).length
)
const createdCount = computed(() => membershipFilterableRooms.value.filter((r) => r.creator === currentUserId).length)

const ROOM_LIST_ROUTE_NAME = 'room'

const emptyDescription = computed(() => {
  if (
    searchKeyword.value.trim() ||
    sessionTypeFilter.value !== WORKBENCH_SESSION_TYPE_FILTERS.all ||
    sessionEngagementFilter.value !== WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all
  ) {
    return t('space.empty_filtered_sessions')
  }

  return t('space.empty_sessions')
})

const findSessionItem = (roomId: string): SessionItem | undefined => {
  return roomSessionList.value.find((item) => item.roomId === roomId)
}

/** P2：进入聊天界面（卡片单击和消息按钮共用） */
const enterChat = (roomId: string) => {
  const item = findSessionItem(roomId)
  if (item) {
    void handleMsgClick(item)
  }
}

/** 单击卡片 → 进入聊天界面 */
const handleCardPreview = (roomId: string) => {
  enterChat(roomId)
}

/** 点击消息按钮 → 进入聊天界面 */
const handleCardMessage = (roomId: string) => {
  enterChat(roomId)
}

/** 点击信息按钮 → 打开房间详情 */
const handleCardInfo = (roomId: string) => {
  void router.push({ name: 'room-details', params: { roomId } })
}

/** 点击设置按钮 → 打开房间详情并进入设置模式 */
const handleCardSettings = (roomId: string) => {
  void router.push({ name: 'room-details', params: { roomId }, query: { mode: 'settings' } })
}

/** P2：搜索框 Enter → 打开首个匹配结果的聊天 */
const handleSearchSubmit = () => {
  const firstRoom = filteredRoomCardViewModels.value[0]
  if (firstRoom) {
    enterChat(firstRoom.roomId)
  }
}

/** 点击置顶按钮 → 切换置顶状态 */
const handleCardPin = async (roomId: string) => {
  const item = findSessionItem(roomId)
  if (!item) return
  try {
    await matrixSessionService.setSessionTop(roomId, !item.top)
    chatStore.updateSession(roomId, { top: !item.top })
    showFeedback(item.top ? t('message.message_menu.unpin_success') : t('message.message_menu.pin_success'), 'success')
  } catch {
    showFeedback(item.top ? t('message.message_menu.unpin_fail') : t('message.message_menu.pin_fail'), 'error')
  }
}

useSessionPageSync({ activePath: '/room', handleMsgClick })
useWorkbenchSessionQuerySync({
  routeName: ROOM_LIST_ROUTE_NAME,
  searchKeyword,
  sessionTypeFilter,
  sessionEngagementFilter,
  sessionSort,
  setSearchKeyword,
  setSessionTypeFilter,
  setSessionEngagementFilter,
  setSessionSort
})

const handleCreateRoom = () => {
  void router.push({ name: 'room-create' })
}

const handleJoinRoom = () => {
  void router.push({ name: 'room-join' })
}

onBeforeMount(async () => {
  useMitt.emit(MittEnum.LOCATE_SESSION, { roomId: globalStore.currentSessionRoomId })
})

onMounted(async () => {
  if (appWindow && appWindow.label === 'home') {
    await addListener(
      appWindow.listen('search_to_msg', (event: { payload: { uid: string; roomType: number } }) => {
        void import('@/composables/chat/openMsgSession').then(({ openMsgSession }) => {
          openMsgSession(event.payload.uid, event.payload.roomType)
        })
      }),
      'search_to_msg'
    )
  }
  useMitt.on(MittEnum.UPDATE_SESSION_LAST_MSG, (payload?: { roomId?: string }) => {
    invalidateSessionCache(payload?.roomId)
  })
  useMitt.on(MittEnum.DELETE_SESSION, async (roomId: string) => {
    await handleMsgDelete(roomId)
  })
  useMitt.on(MittEnum.LOCATE_SESSION, async (e: { roomId: string }) => {
    ensureSessionVisible(e.roomId)
  })
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/message';

.room-list-page {
  background: var(--tjg-surface-panel);
}

.room-list-page__content {
  min-height: 0;
}

#image-no-data {
  @apply size-full mt-60px text-[--tjg-text-primary] text-[length:var(--tjg-font-size-base)];
}
</style>
