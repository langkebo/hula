import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import { orderBy, uniqBy } from 'es-toolkit'
import { RoomTypeEnum, NotificationTypeEnum, StoresEnum } from '@/enums'
import { useGlobalStore } from '@/stores/global.ts'
import { useUserStore } from '@/stores/user.ts'
import { useSessionUnreadStore } from '@/stores/sessionUnread'
import { useGroupStore } from '@/stores/group.ts'
import { matrixReceiptService, matrixClientService, matrixFriendService } from '@/services/matrix'
import type { Room } from 'matrix-js-sdk'

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

export const useSessionStore = defineStore(
  StoresEnum.SESSION,
  () => {
    const globalStore = useGlobalStore()
    const userStore = useUserStore()
    const sessionUnreadStore = useSessionUnreadStore()
    const _groupStore = useGroupStore()

    const sessionList = ref<SessionItem[]>([])
    const sessionMap = ref<Record<string, SessionItem>>({})
    const sessionOptions = reactive({ isLast: false, isLoading: false, cursor: '' })
    const syncLoading = ref(false)

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

    const _removeUnreadCountCache = (roomId: string) => {
      if (!roomId) return
      sessionUnreadStore.remove(userStore.userInfo?.uid, roomId)
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
        return true
      }
      return false
    }

    const convertRoomToSession = (room: Room): SessionItem => {
      const name = room.name || 'Unknown Room'
      const avatar = room.getMxcAvatarUrl() || ''
      const type = room.getJoinedMemberCount() === 2 ? RoomTypeEnum.SINGLE : RoomTypeEnum.GROUP
      const unreadCount = matrixReceiptService.getUnreadCount(room.roomId)
      const lastEvent = room.getLiveTimeline().getEvents().slice(-1)[0]
      const activeTime = lastEvent?.getTs?.() || 0

      return {
        roomId: room.roomId,
        name,
        avatar,
        type,
        unreadCount,
        activeTime
      }
    }

    const addSession = (session: SessionItem) => {
      if (!session.roomId) return
      const existingSession = resolveSessionByRoomId(session.roomId)
      if (existingSession) {
        Object.assign(existingSession, session)
      } else {
        sessionList.value.unshift(session)
        sessionMap.value[session.roomId] = session
      }
    }

    const removeSession = (roomId: string) => {
      if (!roomId) return
      const index = sessionList.value.findIndex((s) => s.roomId === roomId)
      if (index !== -1) {
        sessionList.value.splice(index, 1)
      }
      if (sessionMap.value[roomId]) {
        delete sessionMap.value[roomId]
      }
    }

    const getSessionList = async (_isFresh = false) => {
      try {
        if (sessionOptions.isLoading) return
        sessionOptions.isLoading = true
        globalStore.unreadReady = false

        const client = matrixClientService.getClient()
        if (!client) return

        const specialFriends = await matrixFriendService.getSpecialFriends()
        const rooms = client.getVisibleRooms()
        const sessions = rooms.map((room: Room) => {
          const session = convertRoomToSession(room)
          const otherMember = room.getJoinedMembers().find((m) => m.userId !== client.getUserId())
          if (otherMember && specialFriends.includes(otherMember.userId)) {
            session.isFavorite = true
          }
          return session
        })

        sessionList.value = uniqBy([...sessionList.value, ...sessions], (s) => s.roomId)
        sessionList.value = orderBy(sessionList.value, ['top', 'isFavorite', 'activeTime'], ['desc', 'desc', 'desc'])
        rebuildSessionMap()

        globalStore.unreadReady = true
      } catch (err) {
        console.error('获取会话列表失败:', err)
      } finally {
        sessionOptions.isLoading = false
      }
    }

    const markSessionRead = async (roomId: string) => {
      if (!roomId) return
      updateSession(roomId, { unreadCount: 0 })
      persistUnreadCount(roomId, 0)
      try {
        await matrixReceiptService.markRoomAsRead(roomId)
      } catch (err) {
        console.error('标记会话已读失败:', err)
      }
    }

    const updateSessionLastActiveTime = (roomId: string, session?: SessionItem) => {
      const activeSession = session || resolveSessionByRoomId(roomId)
      if (activeSession) {
        activeSession.activeTime = Date.now()
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
    }

    return {
      sessionList,
      sessionMap,
      sessionOptions,
      syncLoading,
      getSessionList,
      updateSession,
      updateSessionLastActiveTime,
      markSessionRead,
      getSession,
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
      syncPersistedUnreadCounts
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
