<template>
  <ListWorkbenchShell class="room-list-page">
    <template #toolbar>
      <MessageSessionToolbar
        :search-keyword="searchKeyword"
        :session-type-filter="sessionTypeFilter"
        :session-engagement-filter="sessionEngagementFilter"
        :session-sort="sessionSort"
        :filtered-count="filteredRoomSessionList.length"
        :total-count="roomSessionList.length"
        :title="t('home.plugins.room_list_short_title')"
        :show-create-action="true"
        :show-join-action="true"
        :create-button-text="t('room.create.create')"
        @update:search-keyword="setSearchKeyword"
        @update:session-type-filter="setSessionTypeFilter"
        @update:session-engagement-filter="setSessionEngagementFilter"
        @update:session-sort="setSessionSort"
        @create-room="handleCreateRoom"
        @join-room="handleJoinRoom" />
    </template>

    <template #default>
      <RoomSessionList
        ref="sessionListRef"
        :session-list="filteredRoomSessionList"
        :sync-loading="syncLoading"
        :session-loading="chatStore.sessionOptions.isLoading"
        :network-banner="networkBanner"
        :empty-description="emptyDescription"
        :get-item-classes="getItemClasses"
        :visible-menu="visibleMenu"
        :visible-special-menu="visibleSpecialMenu"
        :on-msg-click="handleRoomSelect"
        :on-msg-dblclick="handleRoomDblClick"
        :on-menu-show="handleMenuShow"
        :on-retry-network="retrySessions" />
    </template>
  </ListWorkbenchShell>
</template>
<script lang="ts" setup name="roomList">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import ListWorkbenchShell from '@/components/workbench/ListWorkbenchShell.vue'
import MessageSessionToolbar from '@/components/workbench/MessageSessionToolbar.vue'
import type RoomSessionList from '@/components/workbench/RoomSessionList.vue'
import { useMessage } from '@/composables/chat/useMessage'
import { useMitt } from '@/composables/common/useMitt'
import { useTauriListener } from '@/composables/common/useTauriListener'
import { useMessageSessionFilters } from '@/composables/workbench/useMessageSessionFilters'
import { useSessionListState } from '@/composables/workbench/useSessionListState'
import { useSessionPageSync } from '@/composables/workbench/useSessionPageSync'
import { useWorkbenchSessionQuerySync } from '@/composables/workbench/useWorkbenchSessionQuerySync'
import { MittEnum, RoomTypeEnum } from '@/enums'
import { WORKBENCH_SESSION_ENGAGEMENT_FILTERS, WORKBENCH_SESSION_TYPE_FILTERS } from '@/router/spaceNavigation'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { hasTauriRuntime } from '@/utils/AppHarness'

const { t } = useI18n()
const router = useRouter()
const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const { addListener } = useTauriListener()
const { handleMsgClick, handleMsgDelete, handleMsgDblclick, visibleMenu, visibleSpecialMenu } = useMessage()
const {
  chatStore,
  globalStore,
  syncLoading,
  networkBanner,
  retrySessions,
  sessionList,
  handleMenuShow,
  getItemClasses,
  invalidateSessionCache
} = useSessionListState()

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
const sessionListRef = ref<InstanceType<typeof RoomSessionList> | null>(null)
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

/** 单击房间项时在右侧栏展示房间详情，双击直接打开聊天 */
const handleRoomSelect = (item: SessionItem) => {
  // 阶段 2：路由驱动详情视图，跳转后由 useRightView 派生 details 视图
  void router.push({ name: 'room-details', params: { roomId: item.roomId } })
}

const handleRoomDblClick = (item: SessionItem) => {
  void handleMsgClick(item)
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

// 阶段 4：创建/加入房间通过路由跳转，由右侧栏 createRoom/joinRoom 视图承载
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
    const index = filteredRoomSessionList.value.findIndex((item) => item.roomId === e.roomId)
    if (index !== -1) {
      await sessionListRef.value?.scrollToIndex(index)
    }
  })
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/message';

/* TJG 原型规范：房间列表面板使用 center-bg-color (#1b1b1b in dark) */
.room-list-page {
  background: var(--center-bg-color);
}

#image-no-data {
  @apply size-full mt-60px text-[--hula-text-primary] text-14px;
}
</style>
