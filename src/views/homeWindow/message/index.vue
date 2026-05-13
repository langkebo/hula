<template>
  <ListWorkbenchShell class="message-list-page">
    <template #toolbar>
      <MessageSessionToolbar
        :search-keyword="searchKeyword"
        :session-type-filter="sessionTypeFilter"
        :session-engagement-filter="sessionEngagementFilter"
        :session-sort="sessionSort"
        :filtered-count="filteredSessionList.length"
        :total-count="sessionList.length"
        @update:search-keyword="setSearchKeyword"
        @update:session-type-filter="setSessionTypeFilter"
        @update:session-engagement-filter="setSessionEngagementFilter"
        @update:session-sort="setSessionSort" />
    </template>

    <template #default>
      <RoomSessionList
        ref="sessionListRef"
        :session-list="filteredSessionList"
        :sync-loading="syncLoading"
        :session-loading="chatStore.sessionOptions.isLoading"
        :network-banner="networkBanner"
        :empty-description="emptyDescription"
        :get-item-classes="getItemClasses"
        :visible-menu="visibleMenu"
        :visible-special-menu="visibleSpecialMenu"
        :on-msg-click="handleMsgClick"
        :on-msg-dblclick="handleMsgDblclick"
        :on-menu-show="handleMenuShow"
        :on-retry-network="retrySessions" />
    </template>
  </ListWorkbenchShell>
</template>
<script lang="ts" setup name="message">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useI18n } from 'vue-i18n'
import ListWorkbenchShell from '@/components/workbench/ListWorkbenchShell.vue'
import MessageSessionToolbar from '@/components/workbench/MessageSessionToolbar.vue'
import type RoomSessionList from '@/components/workbench/RoomSessionList.vue'
import { useMessageSessionFilters } from '@/composables/workbench/useMessageSessionFilters'
import { useSessionListState } from '@/composables/workbench/useSessionListState'
import { useWorkbenchSessionQuerySync } from '@/composables/workbench/useWorkbenchSessionQuerySync'
import { MittEnum, RoomTypeEnum } from '@/enums' // Removed MsgEnum, UserType
import { openMsgSession } from '@/hooks/session/openMsgSession'
import { useMessage } from '@/hooks/useMessage.ts'
import { useMitt } from '@/hooks/useMitt'
import { useTauriListener } from '@/hooks/useTauriListener'
import { WORKBENCH_SESSION_ENGAGEMENT_FILTERS, WORKBENCH_SESSION_TYPE_FILTERS } from '@/router/spaceNavigation'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useTimerManager } from '@/utils/TimerManager'

const { t } = useI18n()
const timerManager = useTimerManager()
const route = useRoute()
const MESSAGE_ROUTE_NAME = 'message'

const appWindow = WebviewWindow.getCurrent()
const chatStore = useChatStore()
const globalStore = useGlobalStore()
const groupStore = useGroupStore()
const { addListener } = useTauriListener()
const { handleMsgClick, handleMsgDelete, handleMsgDblclick, visibleMenu, visibleSpecialMenu } = useMessage()

const {
  sessionList,
  syncLoading,
  networkBanner,
  retrySessions,
  handleMenuShow,
  getItemClasses,
  invalidateSessionCache
} = useSessionListState()

const {
  searchKeyword,
  sessionTypeFilter,
  sessionEngagementFilter,
  sessionSort,
  filteredSessionList,
  setSearchKeyword,
  setSessionTypeFilter,
  setSessionEngagementFilter,
  setSessionSort,
  ensureSessionVisible
} = useMessageSessionFilters(sessionList)

const sessionListRef = ref<InstanceType<typeof RoomSessionList> | null>(null)
let clearUnreadTimer: number | null = null // Moved this up

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
useWorkbenchSessionQuerySync({
  routeName: MESSAGE_ROUTE_NAME,
  searchKeyword,
  sessionTypeFilter,
  sessionEngagementFilter,
  sessionSort,
  setSearchKeyword,
  setSessionTypeFilter,
  setSessionEngagementFilter,
  setSessionSort
})

watch(
  () => chatStore.currentSessionInfo,
  async (newVal) => {
    if (newVal) {
      ensureSessionVisible(newVal.roomId)
      // 避免重复调用：如果新会话与当前会话相同，跳过处理，不然会触发两次
      if (newVal.roomId === globalStore.currentSessionRoomId) {
        return
      }

      // 判断是否是群聊
      if (newVal.type === RoomTypeEnum.GROUP) {
        const sessionItem = {
          ...newVal,
          memberNum: groupStore.countInfo?.memberNum,
          remark: groupStore.countInfo?.remark,
          myName: groupStore.countInfo?.myName
        }
        handleMsgClick(sessionItem)
      } else {
        // 非群聊直接传递原始信息
        const sessionItem = newVal as SessionItem
        handleMsgClick(sessionItem)
      }
    }
  },
  { immediate: true }
)

// 监听路由变化：当切换回/message页面且有选中会话时，延迟2秒后清空未读并上报
watch(
  () => route.path,
  async (newPath) => {
    // 清理之前的定时器
    if (clearUnreadTimer) {
      clearTimeout(clearUnreadTimer)
      clearUnreadTimer = null
    }

    // 只在路由切换到/message时处理
    if (newPath === '/message') {
      // 检查是否有选中的会话
      const currentRoomId = globalStore.currentSessionRoomId
      if (currentRoomId) {
        const session = chatStore.getSession(currentRoomId)
        // 如果选中的会话有未读数，则延迟2秒后清空并上报
        if (session?.unreadCount && session.unreadCount > 0) {
          clearUnreadTimer = timerManager.setTimeout(() => {
            chatStore.markSessionRead(currentRoomId)
            clearUnreadTimer = null
          }, 2000)
        }
      }
    }
  },
  { immediate: true }
)

onBeforeMount(async () => {
  // 从联系人页面切换回消息页面的时候自动定位到选中的会话
  useMitt.emit(MittEnum.LOCATE_SESSION, { roomId: globalStore.currentSessionRoomId })
})

onMounted(async () => {
  // SysNTF 通知处理

  // 会话切换已通过 openMsgSession 中的防抖优化
  if (appWindow.label === 'home') {
    await addListener(
      appWindow.listen('search_to_msg', (event: { payload: { uid: string; roomType: number } }) => {
        openMsgSession(event.payload.uid, event.payload.roomType)
      }),
      'search_to_msg'
    )
  }
  useMitt.on(MittEnum.UPDATE_SESSION_LAST_MSG, (payload?: { roomId?: string }) => {
    const roomId = payload?.roomId
    if (!roomId) return
    invalidateSessionCache(roomId)
  })
  useMitt.on(MittEnum.DELETE_SESSION, async (roomId: string) => {
    await handleMsgDelete(roomId)
  })
  useMitt.on(MittEnum.LOCATE_SESSION, async (e: { roomId: string }) => {
    ensureSessionVisible(e.roomId)
    const index = filteredSessionList.value.findIndex((item) => item.roomId === e.roomId)
    if (index !== -1) {
      await sessionListRef.value?.scrollToIndex(index)
    }
  })
})

onUnmounted(() => {
  // 清理未读清空的定时器，避免内存泄漏
  if (clearUnreadTimer) {
    clearTimeout(clearUnreadTimer)
    clearUnreadTimer = null
  }
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/message';

.message-list-page {
  background: var(--hula-surface-panel);
}

#image-no-data {
  @apply size-full mt-60px text-[--hula-text-primary] text-14px;
}
</style>
