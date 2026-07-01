import { orderBy, uniqBy } from 'es-toolkit'
import { defineStore } from 'pinia'
import { computed, reactive, ref, shallowRef, triggerRef } from 'vue'
import { type NotificationTypeEnum, RoomTypeEnum, StoresEnum } from '@/enums'
import { matrixSessionService } from '@/services/matrix/auth/MatrixSessionService'
import { matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { matrixReceiptService } from '@/services/matrix/messaging/MatrixReceiptService'
import { matrixRoomNotificationService } from '@/services/matrix/notifications/MatrixRoomNotificationService'
import { useSessionUnreadStore } from '@/stores/domains/chat/sessionUnread'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SessionStore')

export interface UnreadDetail {
  total: number
  highlight: number
  silent: boolean
}

export interface SessionItem {
  id?: string
  roomId: string
  name: string
  avatar?: string
  type: RoomTypeEnum
  unreadCount: number
  activeTime: number
  text?: string
  muteNotification?: NotificationTypeEnum
  isCheck?: boolean
  remark?: string
  top?: boolean
  shield?: boolean
  hotFlag?: number
  account?: string
  detailId?: string
  operate?: number
  hide?: boolean
  isFavorite?: boolean
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
    const updates = sessionUnreadStore.apply(userStore.userInfo?.uid, targetSessions)
    for (const [roomId, unreadCount] of Object.entries(updates)) {
      updateSession(roomId, { unreadCount })
    }
  }

  const persistUnreadCount = (roomId: string, count: number) => {
    if (!roomId) return
    sessionUnreadStore.set(userStore.userInfo?.uid, roomId, count)
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

  const addSession = (session: SessionItem) => {
    if (!session.roomId) return
    const existingSession = resolveSessionByRoomId(session.roomId)
    if (existingSession) {
      Object.assign(existingSession, session)
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

  const getSessionList = async (_isFresh = false) => {
    try {
      if (sessionOptions.isLoading) return
      sessionOptions.isLoading = true
      globalStore.unreadReady = false
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
    } finally {
      sessionOptions.isLoading = false
    }
  }

  const markSessionRead = async (roomId: string) => {
    if (!roomId) return
    updateSession(roomId, { unreadCount: 0 })
    persistUnreadCount(roomId, 0)
    writeUnreadDetail(roomId, { total: 0, highlight: 0, silent: getUnreadDetail(roomId)?.silent ?? false })
    try {
      await matrixReceiptService.markRoomAsRead(roomId)
      void refreshUnreadDetail(roomId).catch(() => null)
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

  const clearCurrentSessionUnread = () => {
    if (globalStore.currentSessionRoomId) {
      updateSession(globalStore.currentSessionRoomId, { unreadCount: 0 })
      persistUnreadCount(globalStore.currentSessionRoomId, 0)
    }
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
    resetSessionSelection,
    clearCurrentSessionUnread,
    updateTotalUnreadCount,
    requestUnreadCountUpdate,
    clearUnreadCount,
    syncPersistedUnreadCounts,
    writeUnreadDetail
  }
})
