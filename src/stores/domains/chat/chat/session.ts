import { orderBy, uniqBy } from 'es-toolkit'
import { defineStore } from 'pinia'
import { computed, reactive, ref, shallowRef, triggerRef } from 'vue'
import { type NotificationTypeEnum, RoomTypeEnum, StoresEnum } from '@/enums'
import { matrixSessionService } from '@/services/matrix/auth/MatrixSessionService'
import { matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { matrixReceiptService } from '@/services/matrix/messaging/MatrixReceiptService'
import { matrixRoomNotificationService } from '@/services/matrix/notifications/MatrixRoomNotificationService'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useSessionUnreadStore } from '@/stores/domains/chat/sessionUnread'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { resolveDmIdentityKey, toLocalpart } from '@/utils/userIdentity'

const logger = createLogger('SessionStore')

interface UnreadDetail {
  total: number
  highlight: number
  silent: boolean
}

export interface SessionItem {
  id?: string | undefined
  roomId: string
  name: string
  avatar?: string | undefined
  type: RoomTypeEnum
  unreadCount: number
  activeTime: number
  text?: string | undefined
  muteNotification?: NotificationTypeEnum | undefined
  isCheck?: boolean | undefined
  remark?: string | undefined
  top?: boolean | undefined
  shield?: boolean | undefined
  hotFlag?: number | undefined
  account?: string | undefined
  detailId?: string | undefined
  operate?: number | undefined
  hide?: boolean | undefined
  isFavorite?: boolean | undefined
}

export const useSessionStore = defineStore(StoresEnum.SESSION, () => {
  const globalStore = useGlobalStore()
  const userStore = useUserStore()
  const sessionUnreadStore = useSessionUnreadStore()

  const sessionList = shallowRef<SessionItem[]>([])
  const sessionMap = shallowRef<Record<string, SessionItem>>({})
  const sessionOptions = reactive({ isLast: false, isLoading: false, cursor: '' })
  const syncLoading = ref(false)
  const unreadDetail = shallowRef<Record<string, UnreadDetail>>({})
  const loadError = ref<string | null>(null)
  let inFlight: Promise<void> | null = null

  const writeUnreadDetail = (roomId: string, detail: UnreadDetail | null) => {
    if (!roomId) return
    if (!detail) {
      if (!(roomId in unreadDetail.value)) return
      const next = { ...unreadDetail.value }
      delete next[roomId]
      unreadDetail.value = next
      return
    }
    const previous = unreadDetail.value[roomId]
    if (
      previous &&
      previous.total === detail.total &&
      previous.highlight === detail.highlight &&
      previous.silent === detail.silent
    ) {
      return
    }
    unreadDetail.value = { ...unreadDetail.value, [roomId]: detail }
  }

  const getUnreadDetail = (roomId: string): UnreadDetail | null => {
    if (!roomId) return null
    return unreadDetail.value[roomId] ?? null
  }

  /**
   * 拉取最新未读 / 提及计数, 同步到 unreadDetail 与会话项
   * 契约 GET /_matrix/client/v3/rooms/{room_id}/unread_count
   */
  const refreshUnreadDetail = async (roomId: string): Promise<UnreadDetail | null> => {
    if (!roomId) return null
    try {
      const payload = await matrixRoomNotificationService.fetchUnreadCount(roomId)
      if (!payload) return getUnreadDetail(roomId)
      const session = resolveSessionByRoomId(roomId)
      const silent = session?.muteNotification === 1 || !!session?.shield
      const detail: UnreadDetail = {
        total: Math.max(0, payload.notification_count | 0),
        highlight: Math.max(0, payload.highlight_count | 0),
        silent
      }
      writeUnreadDetail(roomId, detail)
      if (session) {
        updateSession(roomId, { unreadCount: detail.total })
        persistUnreadCount(roomId, detail.total)
      }
      return detail
    } catch (err) {
      logger.error('拉取未读计数失败:', roomId, err)
      return getUnreadDetail(roomId)
    }
  }

  const syncPersistedUnreadCounts = (targetSessions: SessionItem[] = sessionList.value) => {
    if (!targetSessions.length) return
    // 当前打开的会话要单独告知 apply：messageMutations 对它不增加界面未读（消息已经显示在
    // 视图里），但服务端 unread_count 仍会 +1，照常折算会把已经看到的这条算成未读。
    const updates = sessionUnreadStore.apply(userStore.userInfo?.uid, targetSessions, globalStore.currentSessionRoomId)
    for (const [roomId, unreadCount] of Object.entries(updates)) {
      updateSession(roomId, { unreadCount })
    }
  }

  const persistUnreadCount = (roomId: string, count: number) => {
    if (!roomId) return
    sessionUnreadStore.set(userStore.userInfo?.uid, roomId, count)
  }

  /**
   * 设置会话未读数：界面与 sessionUnread 本地账本一起更新。本机产生的未读变化必须记账：
   * 关闭已读回执时服务端 unread_count 不会因本机已读而减少，apply 以本地账本为准，
   * 账本不更新会在列表重建 / 重连时丢增量或把已读算回来。
   */
  const setUnreadCount = (roomId: string, count: number) => {
    if (!roomId) return
    updateSession(roomId, { unreadCount: count })
    persistUnreadCount(roomId, count)
  }

  const rebuildSessionMap = () => {
    if (!sessionList.value.length) return
    sessionMap.value = sessionList.value.reduce(
      (map, session) => {
        map[session.roomId] = session
        return map
      },
      {} as Record<string, SessionItem>
    )
  }

  const resolveSessionByRoomId = (roomId: string): SessionItem | undefined => {
    if (!roomId) return undefined
    let session: SessionItem | undefined = sessionMap.value[roomId]
    if (!session) {
      if (!Object.keys(sessionMap.value).length && sessionList.value.length) {
        rebuildSessionMap()
      }
      session = sessionMap.value[roomId]
    }
    if (!session) {
      session = sessionList.value.find((s) => s.roomId === roomId)
      if (session) {
        sessionMap.value[roomId] = session
        triggerRef(sessionMap)
      }
    }
    return session
  }

  const getSession = (roomId: string) => {
    return resolveSessionByRoomId(roomId)
  }

  const updateSession = (roomId: string, data: Partial<SessionItem>) => {
    const session = resolveSessionByRoomId(roomId)
    if (session) {
      Object.assign(session, data)
      triggerRef(sessionList)
      triggerRef(sessionMap)
      return true
    }
    return false
  }

  /**
   * DM 会话身份回填（根治同人 DM 重复）：m.direct 未注册 / 成员未就绪时，SINGLE 会话
   * 缺 detailId/account，下游去重键退化成 roomId ⇒ 同人多条。所有增量写入（addSession）
   * 进 store 前用好友列表的 directRoomId（服务端真源）反查身份，UI 层 dmSeen 去重
   * 不再依赖实时 Room 成员兜底。
   */
  const backfillDmIdentityFromContacts = (session: SessionItem): void => {
    if (session.type !== RoomTypeEnum.SINGLE || resolveDmIdentityKey(session)) return
    try {
      const contactStore = useContactStore()
      const contact = contactStore.contactsList.find((c) => c.directRoomId === session.roomId)
      if (contact?.userId) {
        session.detailId = contact.userId
        session.account = toLocalpart(contact.userId)
      }
    } catch {
      // contacts store 未就绪时静默跳过，UI 层成员兜底仍可用
    }
  }

  const addSession = (session: SessionItem) => {
    if (!session.roomId) return
    backfillDmIdentityFromContacts(session)
    const existingSession = resolveSessionByRoomId(session.roomId)
    if (existingSession) {
      Object.assign(existingSession, {
        ...session,
        // 非空保留：防止新写入的 undefined 覆盖已解析身份（服务重建竞态）
        detailId: existingSession.detailId || session.detailId,
        account: existingSession.account || session.account
      })
      triggerRef(sessionList)
      triggerRef(sessionMap)
    } else {
      sessionList.value.unshift(session)
      triggerRef(sessionList)
      sessionMap.value[session.roomId] = session
      triggerRef(sessionMap)
    }
  }

  const removeSession = (roomId: string) => {
    if (!roomId) return
    const index = sessionList.value.findIndex((s) => s.roomId === roomId)
    if (index !== -1) {
      sessionList.value.splice(index, 1)
      triggerRef(sessionList)
    }
    if (sessionMap.value[roomId]) {
      delete sessionMap.value[roomId]
      triggerRef(sessionMap)
    }
  }

  const fetchSessionList = async (): Promise<void> => {
    try {
      const previousSessionMap = sessionList.value.reduce(
        (map, session) => {
          map[session.roomId] = session
          return map
        },
        {} as Record<string, SessionItem>
      )

      const specialFriends = await matrixFriendService.getSpecialFriends()
      const favoriteFriendIds = new Set(specialFriends)
      const sessions = await matrixSessionService.getSessionList()

      sessionList.value = uniqBy(
        sessions.map((session) => {
          const previous = previousSessionMap[session.roomId]
          const favoriteId = session.detailId || session.account
          return {
            ...previous,
            ...session,
            // 服务重建时若房间成员状态未就绪，session.detailId/account 可能为 undefined，
            // 直接展开会用 undefined 覆盖上一份已填充的 counterpart，导致下游按 detailId
            // 的去重键退回 roomId、同一联系人的多个 DM 房间重复展示。
            // 这里做非空保留：新值缺失时沿用 previous 已解析的身份。
            detailId: session.detailId || previous?.detailId,
            account: session.account || previous?.account,
            isFavorite: !!(favoriteId && favoriteFriendIds.has(favoriteId))
          }
        }),
        (s) => s.roomId
      )
      sessionList.value = orderBy(sessionList.value, ['top', 'isFavorite', 'activeTime'], ['desc', 'desc', 'desc'])
      rebuildSessionMap()
      syncPersistedUnreadCounts()

      globalStore.unreadReady = true
    } catch (err) {
      logger.error('获取会话列表失败:', err)
      loadError.value = err instanceof Error ? err.message : String(err)
    }
  }

  // single-flight：并发调用复用同一个 in-flight Promise。原先 `if (isLoading) return`
  // 会让后到者静默拿到空结果（await 完以为已就绪），移动端首屏因此空到用户手动下拉。
  const getSessionList = (_isFresh = false): Promise<void> => {
    if (inFlight) return inFlight
    sessionOptions.isLoading = true
    loadError.value = null
    globalStore.unreadReady = false
    inFlight = fetchSessionList().finally(() => {
      inFlight = null
      sessionOptions.isLoading = false
    })
    return inFlight
  }

  const markSessionRead = async (roomId: string) => {
    if (!roomId) return
    // 先取清零前的未读数：关闭已读回执时服务端 unread_count 不会因本机已读而减少，
    // 这个值就是服务端累计里「本次被本机读掉」的部分，计入账本的已结算水位后，
    // 重启后 apply 才能把服务端累计值折算成本机真实未读（含离线期间新增的消息）。
    const session = resolveSessionByRoomId(roomId)
    const unreadBeforeRead = session?.unreadCount ?? 0

    setUnreadCount(roomId, 0)
    sessionUnreadStore.markRead(userStore.userInfo?.uid, roomId, unreadBeforeRead)
    writeUnreadDetail(roomId, { total: 0, highlight: 0, silent: getUnreadDetail(roomId)?.silent ?? false })

    // 记录「已读到的活跃时间」：sessionUnread.apply 的情况 1 依赖它来清零并纠正
    // 服务端脏未读数。关闭已读回执时服务端 unread_count 不会归零，没有这条记录，
    // 下一次 syncPersistedUnreadCounts（会话列表重建 / 重连）就会用 Math.max 把角标写回来。
    // 与本地清零一致：无条件记录，不受回执开关影响。
    const activeTime = session?.activeTime ?? 0
    if (activeTime) {
      sessionUnreadStore.setLastRead(userStore.userInfo?.uid, roomId, activeTime)
    }

    try {
      // 关闭「发送已读回执」时服务端收不到 m.read，unread_count 仍 >0；
      // 若无条件回读，用户正在浏览的房间会出现「角标清零 -> 弹回」并跨重启存活。
      // 因此只在实际发出回执后回读，本地清零保持无条件。
      const receiptSent = await matrixReceiptService.markRoomAsRead(roomId)
      if (receiptSent) {
        void refreshUnreadDetail(roomId).catch(() => null)
      }
    } catch (err) {
      logger.error('标记会话已读失败:', err)
    }
  }

  const updateSessionLastActiveTime = (roomId: string, session?: SessionItem) => {
    const activeSession = session || resolveSessionByRoomId(roomId)
    if (activeSession) {
      activeSession.activeTime = Date.now()
      triggerRef(sessionList)
      sessionList.value = orderBy(sessionList.value, ['top', 'activeTime'], ['desc', 'desc'])
    }
  }

  const currentSessionInfo = computed(() => {
    if (!globalStore.currentSessionRoomId) return undefined
    return resolveSessionByRoomId(globalStore.currentSessionRoomId)
  })

  const isGroup = computed(() => {
    const currentSession = currentSessionInfo.value
    return currentSession?.type === RoomTypeEnum.GROUP
  })

  const getGroupSessions = () => {
    return sessionList.value.filter((s) => s.type === RoomTypeEnum.GROUP)
  }

  const updateTotalUnreadCount = () => {
    // Stub for UI
  }

  const requestUnreadCountUpdate = () => {
    // Stub for UI
  }

  const clearUnreadCount = () => {
    // Stub for UI
  }

  const resetSessionSelection = () => {
    sessionList.value.forEach((session) => {
      session.isCheck = false
    })
    triggerRef(sessionList)
  }

  return {
    sessionList,
    sessionMap,
    sessionOptions,
    syncLoading,
    unreadDetail,
    loadError,
    getSessionList,
    updateSession,
    updateSessionLastActiveTime,
    markSessionRead,
    getSession,
    getUnreadDetail,
    refreshUnreadDetail,
    isGroup,
    currentSessionInfo,
    getGroupSessions,
    removeSession,
    addSession,
    setUnreadCount,
    resetSessionSelection,
    updateTotalUnreadCount,
    requestUnreadCountUpdate,
    clearUnreadCount,
    syncPersistedUnreadCounts,
    writeUnreadDetail
  }
})
