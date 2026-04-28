import { MsgEnum, RoomTypeEnum, UserType } from '@/enums'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useReplaceMsg } from '@/hooks/useReplaceMsg.ts'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useBotStore } from '@/stores/domains/user/bot'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { formatTimestamp } from '@/utils/ComputedTime.ts'
import { useI18n } from 'vue-i18n'

type SessionMsgCacheItem = { msg: string; isAtMe: boolean; time: number; senderName: string }

export const useSessionListState = () => {
  const { t } = useI18n()
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()
  const botStore = useBotStore()
  const networkStatus = useNetworkStatus()
  const { syncLoading } = storeToRefs(chatStore)
  const botDisplayText = computed(() => botStore.displayText)
  const { checkRoomAtMe, getMessageSenderName, formatMessageContent } = useReplaceMsg()
  const activeContextMenuRoomId = ref<string | null>(null)
  const sessionMsgCache = reactive<Record<string, SessionMsgCacheItem>>({})
  const sessionCacheRefreshKey = ref(0)

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

  const retrySessions = async () => {
    if (chatStore.syncLoading || chatStore.sessionOptions.isLoading) return

    chatStore.syncLoading = true
    try {
      await chatStore.getSessionList(true)
    } finally {
      chatStore.syncLoading = false
    }
  }

  const sessionList = computed(() => {
    sessionCacheRefreshKey.value

    return chatStore.sessionList
      .map((item) => {
        let latestAvatar = item.avatar
        if (item.type === RoomTypeEnum.SINGLE && item.detailId) {
          latestAvatar = groupStore.getUserInfo(item.detailId)?.avatar || item.avatar
        }

        let displayName = item.name
        if (item.type === RoomTypeEnum.GROUP && item.remark) {
          displayName = item.remark
        }

        const messages = chatStore.chatMessageListByRoomId(item.roomId)

        let displayMsg = ''
        let isAtMe = false

        const lastMsg = messages[messages.length - 1]
        const cacheKey = item.roomId
        const cached = sessionMsgCache[cacheKey]
        const sendTime = lastMsg?.message?.sendTime || 0

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
            displayMsg = formatMessageContent(lastMsg, item.type, senderName, item.roomId)

            if (item.type === RoomTypeEnum.GROUP && lastMsg.message?.type === MsgEnum.SYSTEM && displayMsg) {
              const separatorIndex = displayMsg.indexOf(':')
              if (separatorIndex > -1) {
                displayMsg = displayMsg.slice(separatorIndex + 1)
              }
            }

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
      .sort((a, b) => {
        if (a.top && !b.top) return -1
        if (!a.top && b.top) return 1

        return b.activeTime - a.activeTime
      })
  })

  const selectedSession = computed(() => {
    if (!globalStore.currentSessionRoomId) return null
    return sessionList.value.find((item) => item.roomId === globalStore.currentSessionRoomId) ?? null
  })

  const handleMenuShow = (roomId: string, isShow: boolean) => {
    activeContextMenuRoomId.value = isShow ? roomId : null
  }

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

  const invalidateSessionCache = (roomId?: string) => {
    if (!roomId) return
    Reflect.deleteProperty(sessionMsgCache, roomId)
    sessionCacheRefreshKey.value++
  }

  return {
    chatStore,
    globalStore,
    groupStore,
    syncLoading,
    networkBanner,
    retrySessions,
    sessionList,
    selectedSession,
    handleMenuShow,
    getItemClasses,
    invalidateSessionCache
  }
}
