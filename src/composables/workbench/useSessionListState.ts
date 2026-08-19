import { uniqBy } from 'es-toolkit'
import { useI18n } from 'vue-i18n'
import { useReplaceMsg } from '@/composables/chat/useReplaceMsg'
import { useAriaLive } from '@/composables/common/useAriaLive'
import { useNetworkStatus } from '@/composables/common/useNetworkStatus'
import { MsgEnum, RoomTypeEnum, UserType } from '@/enums'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { findDmCounterpart } from '@/services/matrix/room/roomTypeUtils'
import { type SessionItem, useChatStore, useSessionStore } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useBotStore } from '@/stores/domains/user/bot'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { formatChatTime } from '@/utils/ComputedTime.ts'
import { createLogger } from '@/utils/Logger'
import { toLocalpart } from '@/utils/userIdentity'

const logger = createLogger('SessionListState')

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

  // [TEMP-DIAG] 排查消息列表成员重复：仅当 SINGLE 会话明细变化时打印一次，避免 computed 重算刷屏
  let diagSinglesSignature = ''
  const diagSingles = () => {
    if (!import.meta.env.DEV) return
    const singles = sourceSessionList.value.filter((s) => s.type === RoomTypeEnum.SINGLE)
    if (!singles.length) return
    const signature = singles
      .map((s) => `${s.roomId}|${s.name}|${s.detailId ?? '-'}|${s.account ?? '-'}|${s.unreadCount}|${s.activeTime}`)
      .join(';')
    if (signature === diagSinglesSignature) return
    diagSinglesSignature = signature
    logger.warn(
      `[DIAG-sessionList] SINGLE 会话数=${singles.length} 明细=` +
        singles
          .map(
            (s) =>
              `${s.roomId.slice(0, 14)}|name=${s.name}|detailId=${s.detailId ?? '-'}|account=${s.account ?? '-'}|unread=${s.unreadCount}`
          )
          .join(' || ')
    )
  }

  const sessionList = computed(() => {
    sessionCacheRefreshKey.value

    diagSingles()

    // 防御性过滤：会话/房间列表只展示聊天类条目（群聊 / 单聊）。
    // 空间(SPACE)及任何非 GROUP/SINGLE 类型不进入中间栏会话列表。
    const chatOnlySessions = sourceSessionList.value.filter(
      (item) => item.type === RoomTypeEnum.GROUP || item.type === RoomTypeEnum.SINGLE
    )

    const dedupedByRoom = uniqBy(chatOnlySessions, (item) => item.roomId)
    if (chatOnlySessions.length !== dedupedByRoom.length) {
      logger.warn(
        `[SessionListState] store 层存在重复 roomId：${chatOnlySessions.length} → ${dedupedByRoom.length}，请排查 addSession/getSessionList`
      )
    }

    // 同一对方用户的多个 DM 房间（历史数据或旧版重复创建）只保留最近活跃一条，
    // 并把各重复房间的未读数累加到保留条目，避免"去重后未读丢失"（旧房间的未读也应计入数字角标）。
    // 注意：不 mutate store 原对象，合并结果生成副本，保证 computed 纯函数。
    const dmSeen = new Map<string, SessionItem>()
    const sessionItems: SessionItem[] = []
    // 从实时 Room 成员中兜底解析 counterpart（会话缺 detailId/account 时的最后防线），
    // 使同一联系人的历史 DM 房间即使没填身份字段也能归一化去重。
    const resolveCounterpartKey = (item: SessionItem): string => {
      const explicit = toLocalpart(item.detailId || item.account || '')
      if (explicit) return explicit
      try {
        const client = matrixClientService.getClient()
        const selfId = client?.getUserId?.()
        // selfId 未知时无法可靠区分自己/对方，回退 roomId 去重，
        // 避免把「自己」误当 counterpart 导致不同联系人合并成一条。
        if (!selfId) return item.roomId
        const room = matrixClientService.getRoom(item.roomId)
        const counterpart = findDmCounterpart(room, selfId)
        if (counterpart) return toLocalpart(counterpart) || counterpart
      } catch {
        // 房间成员不可用时回退 roomId 去重（该房间无法与其他房间合并）
      }
      return item.roomId
    }
    for (const item of [...dedupedByRoom].sort((a, b) => b.activeTime - a.activeTime)) {
      if (item.type !== RoomTypeEnum.SINGLE) {
        sessionItems.push(item)
        continue
      }
      // detailId/account 均为对方 MXID，但历史数据可能是 localpart，
      // 用 localpart 归一化避免格式不一致漏判；成员兜底解析保证缺身份字段也能合并。
      const counterpartKey = resolveCounterpartKey(item)
      const existing = dmSeen.get(counterpartKey)
      if (!existing) {
        dmSeen.set(counterpartKey, item)
        sessionItems.push(item)
        continue
      }
      // 同人重复 DM 房间：保留活跃时间更大的一条，未读数累加；
      // 身份字段（detailId/account）取两者中非空者，避免保留条目缺 counterpart 影响头像/去重。
      const base = item.activeTime > existing.activeTime ? item : existing
      const other = item.activeTime > existing.activeTime ? existing : item
      const merged: SessionItem = {
        ...base,
        detailId: base.detailId || other.detailId,
        account: base.account || other.account,
        unreadCount: (base.unreadCount || 0) + (other.unreadCount || 0)
      }
      dmSeen.set(counterpartKey, merged)
      const idx = sessionItems.indexOf(existing)
      if (idx >= 0) sessionItems[idx] = merged
    }

    return sessionItems
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
          lastMsgTime: formatChatTime(item?.activeTime),
          isAtMe,
          isEncrypted,
          isBurnAfterRead
        }
      })
      .sort((a, b) => {
        if (a.top && !b.top) return -1
        if (!a.top && b.top) return 1

        // 未读会话优先置顶，按最新未读（activeTime）降序，最新未读的成员排最上
        const aUnread = (a.unreadCount ?? 0) > 0
        const bUnread = (b.unreadCount ?? 0) > 0
        if (aUnread !== bUnread) return aUnread ? -1 : 1

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
      'tjg-room-list-item--selected': isSelected,
      'tjg-room-list-item--pinned': !!item.top,
      'tjg-room-list-item--muted': !!item.muteNotification
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
