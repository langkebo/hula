<template>
  <ListWorkbenchShell class="message-list-page">
    <template #toolbar>
      <MessageSessionToolbar
        :search-keyword="searchKeyword"
        :session-type-filter="sessionTypeFilter"
        :session-sort="sessionSort"
        :filtered-count="filteredSessionList.length"
        :total-count="sessionList.length"
        @update:search-keyword="setSearchKeyword"
        @update:session-type-filter="setSessionTypeFilter"
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
        :on-retry-network="retryWorkbenchSessions" />
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
import { useWorkbenchSessionQuerySync } from '@/composables/workbench/useWorkbenchSessionQuerySync'
import { MittEnum, MsgEnum, RoomTypeEnum, UserType } from '@/enums'
import { openMsgSession } from '@/hooks/session/openMsgSession'
import { useMessage } from '@/hooks/useMessage.ts'
import { useMitt } from '@/hooks/useMitt'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useReplaceMsg } from '@/hooks/useReplaceMsg.ts'
import { useTauriListener } from '@/hooks/useTauriListener'
import { WORKBENCH_SESSION_TYPE_FILTERS } from '@/router/spaceNavigation'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useBotStore } from '@/stores/domains/user/bot'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { formatTimestamp } from '@/utils/ComputedTime.ts'
import { useTimerManager } from '@/utils/TimerManager'

const { t } = useI18n()
const timerManager = useTimerManager()
const route = useRoute()
const MESSAGE_ROUTE_NAME = 'message'

const appWindow = WebviewWindow.getCurrent()
const chatStore = useChatStore()
const globalStore = useGlobalStore()
const groupStore = useGroupStore()
const botStore = useBotStore()
const { addListener } = useTauriListener()
const { syncLoading } = storeToRefs(chatStore)
const botDisplayText = computed(() => botStore.displayText)
const { checkRoomAtMe, getMessageSenderName, formatMessageContent } = useReplaceMsg()
const { handleMsgClick, handleMsgDelete, handleMsgDblclick, visibleMenu, visibleSpecialMenu } = useMessage()
// 跟踪当前显示右键菜单的会话ID
const activeContextMenuRoomId = ref<string | null>(null)
const networkStatus = useNetworkStatus()
const networkBanner = computed(() => {
  if (!networkStatus.browserOnline.value) {
    return { text: t('home.chat_main.network_offline'), retryable: false }
  }

  if (networkStatus.isWsConnecting.value) {
    return { text: t('home.chat_main.network_connecting'), retryable: false }
  }

  if (networkStatus.wsOnline.value === false) {
    return { text: t('home.chat_main.network_ws_offline'), retryable: true }
  }

  return null
})

const retryWorkbenchSessions = async () => {
  if (chatStore.syncLoading || chatStore.sessionOptions.isLoading) return

  chatStore.syncLoading = true
  try {
    await chatStore.getSessionList(true)
  } finally {
    chatStore.syncLoading = false
  }
}
// 未读清空的定时器
let clearUnreadTimer: number | null = null

type SessionMsgCacheItem = { msg: string; isAtMe: boolean; time: number; senderName: string }

// 缓存每个会话的格式化消息，避免重复计算
const sessionMsgCache = reactive<Record<string, SessionMsgCacheItem>>({})
// 当会话最后一条消息需要强制刷新时递增，配合 mitt 事件触发重算
const sessionCacheRefreshKey = ref(0)

// 会话列表
const sessionList = computed(() => {
  // 依赖 refreshKey，确保外部缓存失效时触发重算
  sessionCacheRefreshKey.value

  return (
    chatStore.sessionList
      .map((item) => {
        // 获取最新的头像
        let latestAvatar = item.avatar
        if (item.type === RoomTypeEnum.SINGLE && item.detailId) {
          latestAvatar = groupStore.getUserInfo(item.detailId)?.avatar || item.avatar
        }

        // 获取群聊备注名称（如果有）
        let displayName = item.name
        if (item.type === RoomTypeEnum.GROUP && item.remark) {
          displayName = item.remark
        }

        // 获取该会话的所有消息用于检查@我
        const messages = chatStore.chatMessageListByRoomId(item.roomId)

        // 优化：使用缓存的消息，或者计算新的消息
        let displayMsg = ''
        let isAtMe = false

        const lastMsg = messages[messages.length - 1]
        const cacheKey = item.roomId
        const cached = sessionMsgCache[cacheKey]
        const sendTime = lastMsg?.message?.sendTime || 0

        // 如果有消息且缓存不存在或已过期，重新计算
        if (lastMsg) {
          const senderName = getMessageSenderName(lastMsg, '', item.roomId, item.type)
          const shouldRefreshCache = !cached || cached.time < sendTime || cached.senderName !== senderName

          if (shouldRefreshCache) {
            isAtMe = checkRoomAtMe(
              item.roomId,
              item.type,
              globalStore.currentSessionRoomId!,
              messages,
              item.unreadCount
            )
            // 获取纯文本消息内容（不包含 @我 标记）
            displayMsg = formatMessageContent(lastMsg, item.type, senderName, item.roomId)

            // 如果是群系统消息（如成员加入），不再前置发送者昵称
            if (item.type === RoomTypeEnum.GROUP && lastMsg.message?.type === MsgEnum.SYSTEM && displayMsg) {
              const separatorIndex = displayMsg.indexOf(':')
              if (separatorIndex > -1) {
                displayMsg = displayMsg.slice(separatorIndex + 1)
              }
            }

            // 更新缓存（只缓存纯文本消息内容）
            sessionMsgCache[cacheKey] = {
              msg: displayMsg,
              isAtMe,
              time: sendTime,
              senderName
            }
          } else {
            displayMsg = cached.msg
            isAtMe = item.unreadCount > 0 ? cached.isAtMe : false
          }
        } else if (cached) {
          // 使用缓存的值，但如果未读数为0，强制isAtMe为false
          displayMsg = cached.msg
          isAtMe = item.unreadCount > 0 ? cached.isAtMe : false
        }

        if (item.account === UserType.BOT) {
          displayMsg = botDisplayText.value || displayMsg
        }

        return {
          ...item,
          avatar: latestAvatar,
          name: displayName,
          lastMsg: displayMsg || t('message.message_list.default_last_msg'),
          lastMsgTime: formatTimestamp(item?.activeTime),
          isAtMe
        }
      })
      // 添加排序逻辑：先按置顶状态排序，再按活跃时间排序
      .sort((a, b) => {
        // 1. 先按置顶状态排序（置顶的排在前面）
        if (a.top && !b.top) return -1
        if (!a.top && b.top) return 1

        // 2. 在相同置顶状态下，按最后活跃时间降序排序（最新的排在前面）
        return b.activeTime - a.activeTime
      })
  )
})

const {
  searchKeyword,
  sessionTypeFilter,
  sessionSort,
  filteredSessionList,
  setSearchKeyword,
  setSessionTypeFilter,
  setSessionSort,
  ensureSessionVisible
} = useMessageSessionFilters(sessionList)

const sessionListRef = ref<InstanceType<typeof RoomSessionList> | null>(null)
const emptyDescription = computed(() => {
  if (searchKeyword.value.trim() || sessionTypeFilter.value !== WORKBENCH_SESSION_TYPE_FILTERS.all) {
    return t('space.empty_filtered_sessions')
  }

  return t('space.empty_sessions')
})
useWorkbenchSessionQuerySync({
  routeName: MESSAGE_ROUTE_NAME,
  searchKeyword,
  sessionTypeFilter,
  sessionSort,
  setSearchKeyword,
  setSessionTypeFilter,
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

// 处理右键菜单显示状态变化
const handleMenuShow = (roomId: string, isShow: boolean) => {
  activeContextMenuRoomId.value = isShow ? roomId : null
}

// 判断对应样式
const getItemClasses = (item: SessionItem) => {
  const isCurrentSession = globalStore.currentSessionRoomId === item.roomId
  const isContextMenuActive = activeContextMenuRoomId.value === item.roomId

  return {
    active: isCurrentSession,
    'active-bot': isCurrentSession && item.account === UserType.BOT,
    'active-shield': Boolean(isCurrentSession && item.shield),
    'bg-[--hula-surface-search] rounded-12px relative': Boolean(item.top),
    'context-menu-active': isContextMenuActive,
    'context-menu-active-shield': Boolean(item.shield && isContextMenuActive),
    'active-context-menu': isContextMenuActive && isCurrentSession
  }
}

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
    Reflect.deleteProperty(sessionMsgCache, roomId)
    sessionCacheRefreshKey.value++
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
