import { useI18n } from 'vue-i18n'
import { useAriaLive } from '@/composables/common/useAriaLive'
import { MsgEnum, RoomTypeEnum, UserType } from '@/enums'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useReplaceMsg } from '@/hooks/useReplaceMsg.ts'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { type SessionItem, useChatStore, useSessionStore } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useBotStore } from '@/stores/domains/user/bot'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { formatTimestamp } from '@/utils/ComputedTime.ts'

type SessionMsgCacheItem = { msg: string; isAtMe: boolean; time: number; senderName: string }

export const useSessionListState = () => {
  const { t } = useI18n()
  const chatStore = useChatStore()
  const sessionStore = useSessionStore()
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()
  const botStore = useBotStore()
  const networkStatus = useNetworkStatus()
  const syncLoading = toRef(sessionStore, 'syncLoading')
  const sourceSessionList = toRef(sessionStore, 'sessionList')
  const botDisplayText = computed(() => botStore.displayText)
  const { checkRoomAtMe, getMessageSenderName, formatMessageContent } = useReplaceMsg()
  const { announce } = useAriaLive()
  const sessionMsgCache = reactive<Record<string, SessionMsgCacheItem>>({})
  const sessionCacheRefreshKey = ref(0)

  watch(syncLoading, (loading, prevLoading) => {
    if (prevLoading === true && loading === false) {
      announce(t('message.message_list.sync_complete'), 'polite')
    }
  })

  const networkBanner = computed(() => {
    if (!networkStatus.browserOnline.value && networkStatus.wsOnline.value !== true) {
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
    if (sessionStore.syncLoading || sessionStore.sessionOptions.isLoading) return

    sessionStore.syncLoading = true
    try {
      await sessionStore.getSessionList(true)
    } finally {
      sessionStore.syncLoading = false
    }
  }

  const sessionList = computed(() => {
    sessionCacheRefreshKey.value

    return sourceSessionList.value
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

        if (!displayMsg && item.text) {
          displayMsg = item.text
        }

        if (item.account === UserType.BOT) {
          displayMsg = botDisplayText.value || displayMsg
        }

        const room = matrixClientService.getRoom(item.roomId)
        const isEncrypted = room ? matrixClientService.isRoomEncrypted(item.roomId) : false
        const isBurnAfterRead = !!room?.currentState?.getStateEvents('m.burn_after_read')?.length

        return {
          ...item,
          avatar: latestAvatar,
          name: displayName,
          lastMsg: displayMsg || t('message.message_list.default_last_msg'),
          lastMsgTime: formatTimestamp(item?.activeTime),
          isAtMe,
          isEncrypted,
          isBurnAfterRead
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

  const invalidateSessionCache = (roomId?: string) => {
    if (!roomId) return
    Reflect.deleteProperty(sessionMsgCache, roomId)
    sessionCacheRefreshKey.value++
  }

  const handleMenuShow = (roomId: string, isShow: boolean) => {
    if (!isShow) return
    invalidateSessionCache(roomId)
  }

  const getItemClasses = (item: SessionItem) => {
    const isSelected = globalStore.currentSessionRoomId === item.roomId
    return {
      'hula-room-list-item--selected': isSelected,
      'hula-room-list-item--pinned': !!item.top,
      'hula-room-list-item--muted': !!item.muteNotification
    }
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
    invalidateSessionCache,
    handleMenuShow,
    getItemClasses
  }
}
