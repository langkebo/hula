import { uniqBy } from 'es-toolkit'
import { type Ref, unref } from 'vue'
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
import { resolveDmIdentityKey, toLocalpart } from '@/utils/userIdentity'

const logger = createLogger('SessionListState')

// 末条预览失效键：invalidateSessionCache 时整体自增，强制 useSessionLastMsg 重新格式化
// （用于撤回 / 菜单展开等需要立即刷新预览的场景）。与 sessionList 结构层解耦：
// 单条消息到达只触发对应房间的 useSessionLastMsg 重算，不会重排整个会话列表。
const previewRefreshKey = ref(0)

export const useSessionListState = () => {
  const { t } = useI18n()
  const chatStore = useChatStore()
  const sessionStore = useSessionStore()
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()
  const networkStatus = useNetworkStatus()
  const syncLoading = toRef(sessionStore, 'syncLoading')
  const sourceSessionList = toRef(sessionStore, 'sessionList')
  const { announce } = useAriaLive()

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
    // 防御性过滤：消息会话列表展示聊天类条目（群聊 / 单聊）。
    // 空间(SPACE)及任何非 GROUP/SINGLE 类型不进入中间栏会话列表。
    // 注意：单聊必须保留——好友页「进入聊天/加密聊天」按钮依赖此列表渲染 DM 会话；
    // 「房间列表」页（RoomList.vue）的 GROUP-only 过滤在那一层单独实现。
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
      // 统一走 resolveDmIdentityKey（单一事实源），避免各层归一化口径漂移导致同人漏判
      const explicit = resolveDmIdentityKey(item)
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

    // 结构层只依赖 sessionStore / groupStore / matrixClientService：
    // 不再读取消息内容（末条预览已下沉到 useSessionLastMsg，按 roomId 细粒度订阅），
    // 因此单条消息到达只会更新对应房间的末条预览，不会重排整个会话列表、也不会为取末条分配整条消息数组。
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

        const room = matrixClientService.getRoom(item.roomId)
        const isEncrypted = room ? matrixClientService.isRoomEncrypted(item.roomId) : false
        const isBurnAfterRead = !!room?.currentState?.getStateEvents('m.burn_after_read')?.length

        return {
          ...item,
          avatar: latestAvatar,
          name: displayName,
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

  const invalidateSessionCache = () => {
    previewRefreshKey.value++
  }

  const handleMenuShow = (_roomId: string, isShow: boolean) => {
    if (!isShow) return
    invalidateSessionCache()
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
    getItemClasses,
    useSessionLastMsg
  }
}

/**
 * 单房间末条消息预览（细粒度、按 roomId 订阅）。
 *
 * 与 sessionList 结构层解耦：只在「该房间消息变化 / 当前会话切换 / 失效键变化」时重算，
 * 单条消息到达不会触发整个会话列表重排，也不为取末条分配整条消息数组（O(1) 读取）。
 * 在每行组件（TjgRoomListItem）内调用即可获得逐行独立的响应式预览。
 */
export const useSessionLastMsg = (roomId: string | Ref<string>) => {
  const { t } = useI18n()
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()
  const botStore = useBotStore()
  const { checkRoomAtMe, getMessageSenderName, formatMessageContent } = useReplaceMsg()
  const botDisplayText = computed(() => botStore.displayText)

  const lastMessage = computed(() => {
    previewRefreshKey.value
    const rid = unref(roomId)
    const session = chatStore.getSession(rid)
    const raw = chatStore.getLastMessageByRoomId(rid)
    let displayMsg = ''
    if (raw) {
      const senderName = getMessageSenderName(raw, '', rid, session?.type)
      displayMsg = formatMessageContent(raw, session?.type ?? RoomTypeEnum.GROUP, senderName, rid)
      if (session?.type === RoomTypeEnum.GROUP && raw.message?.type === MsgEnum.SYSTEM && displayMsg) {
        const separatorIndex = displayMsg.indexOf(':')
        if (separatorIndex > -1) {
          displayMsg = displayMsg.slice(separatorIndex + 1)
        }
      }
    } else if (session?.text) {
      displayMsg = session.text
    }
    if (session?.account === UserType.BOT) {
      displayMsg = botDisplayText.value || displayMsg
    }
    return displayMsg || t('message.message_list.default_last_msg')
  })

  const lastMsgTime = computed(() => {
    const rid = unref(roomId)
    const session = chatStore.getSession(rid)
    return session?.activeTime ? formatChatTime(session.activeTime) : ''
  })

  const isAtMe = computed(() => {
    previewRefreshKey.value
    const rid = unref(roomId)
    const session = chatStore.getSession(rid)
    const messages = chatStore.chatMessageListByRoomId(rid)
    return checkRoomAtMe(
      rid,
      session?.type ?? RoomTypeEnum.GROUP,
      globalStore.currentSessionRoomId!,
      messages,
      session?.unreadCount ?? 0
    )
  })

  return { lastMessage, lastMsgTime, isAtMe }
}
