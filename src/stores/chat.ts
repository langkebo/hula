import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { sendNotification } from '@tauri-apps/plugin-notification'
import { orderBy, uniqBy } from 'es-toolkit'
import pLimit from 'p-limit'
import { defineStore } from 'pinia'
import { useRoute } from 'vue-router'
import { MittEnum, MessageStatusEnum, MsgEnum, RoomTypeEnum, StoresEnum, NotificationTypeEnum } from '@/enums'
import { useGlobalStore } from '@/stores/global.ts'
import { useGroupStore } from '@/stores/group.ts'
import { useUserStore } from '@/stores/user.ts'
import { useSessionUnreadStore } from '@/stores/sessionUnread'
import { unreadCountManager } from '@/utils/UnreadCountManager'
import { useMitt } from '@/hooks/useMitt'
import { matrixRoomService, matrixReceiptService, matrixClientService } from '@/services/matrix'
import type { Room, MatrixEvent } from 'matrix-js-sdk'

type RecalledMessage = {
  messageId: string
  content: string
  recallTime: number
  originalType: MsgEnum
}

type CustomForwardTask = {
  id: string
  type: MsgEnum.IMAGE
  fileName: string
  mimeType: string
  bytes: Uint8Array
  previewUrl: string
  width: number
  height: number
  size: number
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
}

export interface MessageType {
  message: {
    id: string
    roomId: string
    sendTime: number
    type: MsgEnum
    body: any
    status?: MessageStatusEnum
    messageMarks?: Record<string, { count: number; userMarked: boolean }>
    loading?: boolean
  }
  fromUser: {
    uid: string
    username?: string
    avatar?: string
    locPlace?: string
  }
  timeBlock?: number
  uploadProgress?: number
  isCheck?: boolean
  sendTime?: number
  loading?: boolean
}

export const pageSize = 20
const ROOM_MESSAGE_CACHE_LIMIT = 40
const RECALL_EXPIRATION_TIME = 2 * 60 * 1000

const timerWorker = new Worker(new URL('../workers/timer.worker.ts', import.meta.url))
timerWorker.onerror = (err) => {
  console.error('[Worker Error]', err)
}

export const useChatStore = defineStore(
  StoresEnum.CHAT,
  () => {
    const route = useRoute()
    const userStore = useUserStore()
    const globalStore = useGlobalStore()
    const groupStore = useGroupStore()
    const sessionUnreadStore = useSessionUnreadStore()

    const sessionList = ref<SessionItem[]>([])
    const sessionMap = ref<Record<string, SessionItem>>({})
    const sessionOptions = reactive({ isLast: false, isLoading: false, cursor: '' })
    const syncLoading = ref(false)
    syncLoading.value = false

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

    const removeUnreadCountCache = (roomId: string) => {
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

    const resolveSessionByRoomId = (roomId: string) => {
      if (!roomId) return undefined
      let session = sessionMap.value[roomId]
      if (!session) {
        if (!Object.keys(sessionMap.value).length && sessionList.value.length) {
          rebuildSessionMap()
        }
        session = sessionMap.value[roomId] ?? sessionList.value.find((item) => item.roomId === roomId)
        if (session) {
          sessionMap.value[roomId] = session
        }
      }
      return session
    }

    const lastReadActiveTime = ref<Record<string, number>>({})

    const messageMap = reactive<Record<string, Record<string, MessageType>>>({})
    const messageOptions = reactive<Record<string, { isLast: boolean; isLoading: boolean; cursor: string }>>({})

    const transientStatuses = new Set<MessageStatusEnum>([
      MessageStatusEnum.PENDING,
      MessageStatusEnum.SENDING,
      MessageStatusEnum.FAILED
    ])
    const shouldKeepTransientMessage = (msg?: MessageType) => {
      return msg?.message?.status ? transientStatuses.has(msg.message.status) : false
    }

    const replyMapping = reactive<Record<string, Record<string, string[]>>>({})
    const recalledMessages = reactive<Record<string, RecalledMessage>>({})
    const expirationTimers: Record<string, boolean> = {}
    const isMsgMultiChoose = ref<boolean>(false)
    const msgMultiChooseMode = ref<'normal' | 'forward'>('normal')
    const customForwardTask = ref<CustomForwardTask | null>(null)

    const currentMessageMap = computed(() => {
      return messageMap[globalStore.currentSessionRoomId] || {}
    })

    const currentMessageOptions = computed({
      get: () => {
        const roomId = globalStore.currentSessionRoomId
        const current = messageOptions[roomId]
        if (current === undefined) {
          messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '' }
        }
        return messageOptions[roomId]
      },
      set: (val) => {
        const roomId = globalStore.currentSessionRoomId
        messageOptions[roomId] = val as { isLast: boolean; isLoading: boolean; cursor: string }
      }
    })

    const currentReplyMap = computed({
      get: () => {
        const roomId = globalStore.currentSessionRoomId
        const current = replyMapping[roomId]
        if (current === undefined) {
          replyMapping[roomId] = {}
        }
        return replyMapping[roomId]
      },
      set: (val) => {
        const roomId = globalStore.currentSessionRoomId
        replyMapping[roomId] = val as Record<string, string[]>
      }
    })

    const shouldShowNoMoreMessage = computed(() => {
      return currentMessageOptions.value?.isLast
    })

    const isGroup = computed(() => globalStore.currentSession?.type === RoomTypeEnum.GROUP)

    const currentSessionInfo = computed(() => {
      const roomId = globalStore.currentSessionRoomId
      if (!roomId) return undefined
      return resolveSessionByRoomId(roomId)
    })

    const newMsgCount = reactive<Record<string, { count: number; isStart: boolean }>>({})

    const currentNewMsgCount = computed({
      get: () => {
        const roomId = globalStore.currentSessionRoomId
        const current = newMsgCount[roomId]
        if (current === undefined) {
          newMsgCount[roomId] = { count: 0, isStart: false }
        }
        return newMsgCount[roomId]
      },
      set: (val) => {
        const roomId = globalStore.currentSessionRoomId
        newMsgCount[roomId] = val as { count: number; isStart: boolean }
      }
    })

    const clearOtherRoomsMessages = (currentRoomId: string) => {
      for (const roomId in messageMap) {
        if (roomId !== currentRoomId) {
          for (const msgId in messageMap[roomId]) {
            const msg = messageMap[roomId][msgId]
            if (shouldKeepTransientMessage(msg)) continue
            delete messageMap[roomId][msgId]
          }
        }
      }
    }

    const clearRoomMessagesExceptTransient = (roomId: string) => {
      if (!messageMap[roomId]) {
        messageMap[roomId] = {}
        return
      }
      for (const msgId in messageMap[roomId]) {
        const msg = messageMap[roomId][msgId]
        if (shouldKeepTransientMessage(msg)) continue
        delete messageMap[roomId][msgId]
      }
    }

    const convertRoomToSession = (room: Room): SessionItem => {
      const client = matrixClientService.getClient()
      const myUserId = client?.getUserId()
      const members = room.getJoinedMembers()

      let name = room.name || room.roomId
      let avatar: string | undefined
      let type = RoomTypeEnum.GROUP

      if (room.isSpaceRoom?.()) {
        type = RoomTypeEnum.GROUP
      } else if (room.getJoinedMemberCount() === 2) {
        type = RoomTypeEnum.SINGLE
        const otherMember = members.find((m) => m.userId !== myUserId)
        if (otherMember) {
          name = otherMember.name || otherMember.userId
          avatar = otherMember.getMxcAvatarUrl?.() || undefined
        }
      }

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

    const convertEventToMessage = (event: MatrixEvent, room: Room): MessageType | null => {
      const content = event.getContent()
      const sender = event.getSender()
      const member = room.getMember(sender || '')

      let msgType = MsgEnum.TEXT
      if (content.msgtype === 'm.image') msgType = MsgEnum.IMAGE
      else if (content.msgtype === 'm.audio' || content.msgtype === 'm.voice') msgType = MsgEnum.VOICE
      else if (content.msgtype === 'm.video') msgType = MsgEnum.VIDEO
      else if (content.msgtype === 'm.file') msgType = MsgEnum.FILE
      else if (content.msgtype === 'm.emote') msgType = MsgEnum.TEXT
      else if (event.getType() === 'm.room.redaction') msgType = MsgEnum.RECALL

      return {
        message: {
          id: event.getId() || '',
          roomId: room.roomId,
          sendTime: event.getTs?.() || Date.now(),
          type: msgType,
          body: content,
          status: MessageStatusEnum.SUCCESS
        },
        fromUser: {
          uid: sender || '',
          username: member?.name || sender,
          avatar: member?.getMxcAvatarUrl?.()
        }
      }
    }

    const changeRoom = async () => {
      const currentWindowLabel = WebviewWindow.getCurrent()
      if (currentWindowLabel.label !== 'home' && currentWindowLabel.label !== 'mobile-home') {
        return
      }

      if (!globalStore.currentSessionRoomId) return

      const roomId = globalStore.currentSessionRoomId
      clearOtherRoomsMessages(roomId)
      cleanupExpiredRecalledMessages()
      clearRoomMessagesExceptTransient(roomId)

      currentMessageOptions.value = {
        isLast: false,
        isLoading: false,
        cursor: ''
      }

      if (currentReplyMap.value) {
        for (const key in currentReplyMap.value) {
          delete currentReplyMap.value[key]
        }
      }

      try {
        await getPageMsg(pageSize, roomId, '')
      } catch (err) {
        console.error('无法加载消息:', err)
        currentMessageOptions.value = {
          isLast: false,
          isLoading: false,
          cursor: ''
        }
      }

      if (globalStore.currentSessionRoomId) {
        markSessionRead(globalStore.currentSessionRoomId)
      }

      currentMsgReply.value = {}
    }

    const currentMsgReply = ref<Partial<MessageType>>({})

    const chatMessageList = computed(() => {
      if (!currentMessageMap.value || Object.keys(currentMessageMap.value).length === 0) return []
      return Object.values(currentMessageMap.value).sort((a, b) => Number(a.message.id) - Number(b.message.id))
    })

    const chatMessageListByRoomId = computed(() => (roomId: string) => {
      if (!messageMap[roomId] || Object.keys(messageMap[roomId]).length === 0) return []
      return Object.values(messageMap[roomId]).sort((a, b) => Number(a.message.id) - Number(b.message.id))
    })

    const findRoomIdByMsgId = (msgId: string) => {
      if (!msgId) return ''
      for (const roomId of Object.keys(messageMap)) {
        const roomMessages = messageMap[roomId]
        if (roomMessages && msgId in roomMessages) {
          return roomId
        }
      }
      return ''
    }

    const setAllSessionMsgList = async (size = pageSize) => {
      await info('初始设置所有会话消息列表')
      if (sessionList.value.length === 0) return

      const sortedSessions = [...sessionList.value].sort((a, b) => b.activeTime - a.activeTime)
      const limit = pLimit(5)
      const tasks = sortedSessions.map((session) => limit(() => getPageMsg(size, session.roomId, '', true)))
      const results = await Promise.allSettled(tasks)

      const successCount = results.filter((r) => r.status === 'fulfilled').length
      const failCount = results.filter((r) => r.status === 'rejected').length
      await info(`会话消息加载完成: 成功 ${successCount}/${sortedSessions.length}, 失败 ${failCount}`)
    }

    const getMsgList = async (size = pageSize, async?: boolean) => {
      await info('获取消息列表')
      const requestRoomId = globalStore.currentSessionRoomId
      await getPageMsg(size, requestRoomId, currentMessageOptions.value?.cursor, async)
    }

    const getPageMsg = async (pageSize: number, roomId: string, cursor: string = '', _async?: boolean) => {
      try {
        const room = await matrixRoomService.getRoom(roomId)
        if (!room) {
          messageOptions[roomId] = { isLast: true, isLoading: false, cursor: '' }
          return
        }

        const timeline = room.getLiveTimeline()
        const events = timeline.getEvents()

        if (!messageMap[roomId]) {
          messageMap[roomId] = {}
        }

        const startIndex = cursor ? events.findIndex((e) => e.getId() === cursor) : 0
        const endIndex = Math.min(startIndex + pageSize, events.length)
        const pageEvents = events.slice(startIndex, endIndex)

        for (const event of pageEvents) {
          const msg = convertEventToMessage(event, room)
          if (msg) {
            messageMap[roomId][msg.message.id] = msg
          }
        }

        messageOptions[roomId] = {
          isLast: endIndex >= events.length,
          isLoading: false,
          cursor: pageEvents[pageEvents.length - 1]?.getId() || ''
        }
      } catch (err) {
        console.error('获取消息失败:', err)
        messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '' }
      }
    }

    const remoteSyncLocks = new Set<string>()
    const fetchCurrentRoomRemoteOnce = async (size = pageSize) => {
      const roomId = globalStore.currentSessionRoomId
      if (!roomId) return
      if (remoteSyncLocks.has(roomId)) return
      remoteSyncLocks.add(roomId)
      try {
        const opts = messageOptions[roomId] || { isLast: false, isLoading: false, cursor: '' }
        opts.cursor = ''
        messageOptions[roomId] = opts
        await getPageMsg(size, roomId, '')
      } finally {
        remoteSyncLocks.delete(roomId)
      }
    }

    const getSessionList = async (_isFresh = false) => {
      try {
        if (sessionOptions.isLoading) return
        sessionOptions.isLoading = true
        globalStore.unreadReady = false

        const rooms = await matrixRoomService.getRooms()
        const sessions = rooms.map(convertRoomToSession)

        sessionList.value = sessions
        syncPersistedUnreadCounts()
        sessionOptions.isLoading = false

        for (const session of sessionList.value) {
          sessionMap.value[session.roomId] = session
        }

        sortAndUniqueSessionList()
        updateTotalUnreadCount()

        const currentRoomId = globalStore.currentSessionRoomId
        if (currentRoomId) {
          const currentSession = resolveSessionByRoomId(currentRoomId)
          if (currentSession?.unreadCount) {
            markSessionRead(currentRoomId)
            updateTotalUnreadCount()
          }
        }

        globalStore.unreadReady = true
        unreadCountManager.refreshBadge(globalStore.unReadMark)
      } catch (err) {
        console.error('获取会话列表失败:', err)
        sessionOptions.isLoading = false
        globalStore.unreadReady = true
        unreadCountManager.refreshBadge(globalStore.unReadMark)
      } finally {
        sessionOptions.isLoading = false
      }
    }

    const sortAndUniqueSessionList = () => {
      const uniqueAndSorted = orderBy(
        uniqBy(sessionList.value, (item) => item.roomId),
        [(item) => item.activeTime],
        ['desc']
      )
      sessionList.value.splice(0, sessionList.value.length, ...uniqueAndSorted)
    }

    const updateSession = (roomId: string, data: Partial<SessionItem>) => {
      const index = sessionList.value.findIndex((s) => s.roomId === roomId)
      if (index !== -1) {
        const oldSession = sessionList.value[index]
        const updatedSession = { ...oldSession, ...data }
        const newList = [...sessionList.value]
        newList[index] = updatedSession
        sessionList.value = newList
        sessionMap.value[roomId] = updatedSession

        if ('unreadCount' in data && typeof data.unreadCount === 'number') {
          console.log('[updateSession] 更新未读数:', roomId, data.unreadCount)
          persistUnreadCount(roomId, data.unreadCount)
          requestUnreadCountUpdate(roomId)
        }

        if ('muteNotification' in data) {
          requestUnreadCountUpdate()
        }
      } else {
        console.warn('[updateSession] 会话不存在:', roomId)
      }
    }

    const updateSessionLastActiveTime = (roomId: string) => {
      const session = resolveSessionByRoomId(roomId)
      if (session) {
        Object.assign(session, { activeTime: Date.now() })
      } else {
        addSession(roomId)
      }
      return session
    }

    const addSession = async (roomId: string) => {
      try {
        const room = await matrixRoomService.getRoom(roomId)
        if (!room) return

        const session = convertRoomToSession(room)
        sessionList.value.unshift(session)
        sessionMap.value[roomId] = session
        syncPersistedUnreadCounts([session])
        sortAndUniqueSessionList()
      } catch (err) {
        console.error('添加会话失败:', err)
      }
    }

    const getSession = (roomId: string) => {
      if (!roomId) {
        return sessionList.value[0]
      }
      return resolveSessionByRoomId(roomId)
    }

    const pushMsg = async (msg: MessageType, options: { isActiveChatView?: boolean; activeRoomId?: string } = {}) => {
      if (!msg.message.id) {
        msg.message.id = `${msg.message.roomId}_${msg.message.sendTime}_${msg.fromUser.uid}`
      }
      const messageKey = msg.message.id

      let roomMessages = messageMap[msg.message.roomId]
      if (!roomMessages) {
        roomMessages = {}
        messageMap[msg.message.roomId] = roomMessages
      }

      const existedMsg = roomMessages[messageKey]
      roomMessages[messageKey] = msg

      if (existedMsg) return

      const targetRoomId = options.activeRoomId ?? globalStore.currentSessionRoomId ?? ''
      let isActiveChatView = options.isActiveChatView
      if (isActiveChatView === undefined) {
        const currentPath = route?.path
        isActiveChatView =
          (currentPath === '/message' || currentPath?.startsWith('/mobile/chatRoom')) &&
          targetRoomId === msg.message.roomId
      }

      const uid = msg.fromUser.uid
      const cacheUser = groupStore.getUserInfo(uid)

      const session = resolveSessionByRoomId(msg.message.roomId)
      if (session) {
        const lastMsgUserName = cacheUser?.name
        const formattedText =
          msg.message.type === MsgEnum.RECALL
            ? session.type === RoomTypeEnum.GROUP
              ? `${lastMsgUserName}:撤回了一条消息`
              : msg.fromUser.uid === userStore.userInfo!.uid
                ? '你撤回了一条消息'
                : '对方撤回了一条消息'
            : msg.message.body?.content || msg.message.body?.body || ''

        const updateData: Partial<SessionItem> = {
          text: formattedText,
          activeTime: Date.now()
        }

        const isSelfMessage = msg.fromUser.uid === userStore.userInfo!.uid
        const shouldIncreaseUnread = !isSelfMessage && (!isActiveChatView || msg.message.roomId !== targetRoomId)

        if (shouldIncreaseUnread) {
          updateData.unreadCount = (session.unreadCount || 0) + 1
          console.log('[pushMsg] 增加未读数:', msg.message.roomId, updateData.unreadCount)
        }

        updateSession(msg.message.roomId, updateData)
      } else {
        await addSession(msg.message.roomId)
        const isSelfMessage = msg.fromUser.uid === userStore.userInfo!.uid
        const shouldIncreaseUnread = !isSelfMessage && (!isActiveChatView || msg.message.roomId !== targetRoomId)
        if (shouldIncreaseUnread) {
          updateSession(msg.message.roomId, { unreadCount: 1 })
        }
      }

      if (msg.message.body.atUidList?.includes(userStore.userInfo!.uid) && cacheUser) {
        sendNotification({
          title: cacheUser.name as string,
          body: msg.message.body.content || msg.message.body.body || '',
          icon: cacheUser.avatar as string
        })
      }

      if (!isActiveChatView || msg.message.roomId !== targetRoomId) {
        clearRedundantMessages(msg.message.roomId, ROOM_MESSAGE_CACHE_LIMIT)
      }
    }

    const checkMsgExist = (roomId: string, msgId: string) => {
      const current = messageMap[roomId]
      return current && msgId in current
    }

    const clearMsgCheck = () => {
      chatMessageList.value.forEach((msg) => (msg.isCheck = false))
    }

    const loadMore = async (size?: number) => {
      if (currentMessageOptions.value?.isLast) return
      await getMsgList(size, true)
    }

    const clearNewMsgCount = () => {
      currentNewMsgCount.value && (currentNewMsgCount.value.count = 0)
    }

    const getMsgIndex = (msgId: string) => {
      if (!msgId) return -1
      const keys = currentMessageMap.value ? Object.keys(currentMessageMap.value) : []
      return keys.indexOf(msgId)
    }

    const updateMarkCount = async (
      markList: Array<{ msgId: string; markType: number; markCount: number; actType: number; uid: string }>
    ) => {
      await info('保存消息标记到本地数据库')
      for (const mark of markList) {
        const { msgId, markType, markCount, actType, uid } = mark

        const msgItem = currentMessageMap.value?.[String(msgId)]
        if (msgItem && msgItem.message.messageMarks) {
          const currentMarkStat = msgItem.message.messageMarks[String(markType)] || {
            count: 0,
            userMarked: false
          }

          if (actType === 1) {
            if (uid === userStore.userInfo!.uid) {
              currentMarkStat.userMarked = true
            }
            currentMarkStat.count = markCount
          } else if (actType === 2) {
            if (uid === userStore.userInfo!.uid) {
              currentMarkStat.userMarked = false
            }
            currentMarkStat.count = markCount
          }

          msgItem.message.messageMarks[String(markType)] = currentMarkStat
        }
      }
    }

    const recordRecallMsg = (data: {
      recallUid: string
      msg: MessageType
      originalType?: number
      originalContent?: string
    }) => {
      const recallTime = Date.now()
      recalledMessages[data.msg.message.id] = {
        messageId: data.msg.message.id,
        content: data.originalContent ?? data.msg.message.body.content ?? data.msg.message.body.body ?? '',
        recallTime,
        originalType: data.originalType ?? data.msg.message.type
      }

      if (data.recallUid === userStore.userInfo!.uid) {
        timerWorker.postMessage({
          type: 'startTimer',
          msgId: data.msg.message.id,
          duration: RECALL_EXPIRATION_TIME
        })
      }

      expirationTimers[data.msg.message.id] = true
    }

    const updateRecallMsg = async (data: { msgId: string; recallUid?: string; roomId?: string }) => {
      const { msgId } = data
      const resolvedRoomId = data.roomId || findRoomIdByMsgId(msgId)
      const session = resolvedRoomId ? resolveSessionByRoomId(resolvedRoomId) : undefined
      const sessionType = session?.type ?? RoomTypeEnum.SINGLE
      const roomMessages = resolvedRoomId ? messageMap[resolvedRoomId] : undefined
      const message = roomMessages?.[msgId] || currentMessageMap.value?.[msgId]
      let recallMessageBody = ''

      if (message && typeof data.recallUid === 'string') {
        const currentUid = userStore.userInfo!.uid
        const senderUid = message.fromUser.uid

        const isRecallerCurrentUser = data.recallUid === currentUid
        const isSenderCurrentUser = senderUid === currentUid
        const recallerUser = groupStore.getUserInfo(data.recallUid, resolvedRoomId)
        const recallerName = recallerUser?.myName || recallerUser?.name || data.recallUid || ''
        const senderUser = groupStore.getUserInfo(senderUid, resolvedRoomId)
        const senderName = senderUser?.myName || senderUser?.name || message.fromUser.username || senderUid
        const isGroupChat = sessionType === RoomTypeEnum.GROUP

        if (isRecallerCurrentUser) {
          if (data.recallUid === senderUid) {
            recallMessageBody = '你撤回了一条消息'
          } else {
            recallMessageBody = `你撤回了${senderName}的一条消息`
          }
        } else {
          if (isGroupChat) {
            const recallerLabel = recallerName || '对方'
            if (isSenderCurrentUser) {
              recallMessageBody = `${recallerLabel}撤回了你的一条消息`
            } else {
              recallMessageBody = `${recallerLabel}撤回了一条消息`
            }
          } else {
            if (isSenderCurrentUser) {
              recallMessageBody = '对方撤回了你的一条消息'
            } else {
              recallMessageBody = '对方撤回了一条消息'
            }
          }
        }

        message.message.type = MsgEnum.RECALL
        message.message.body.content = recallMessageBody
        message.message.body.body = recallMessageBody
      }

      if (resolvedRoomId) {
        const session = resolveSessionByRoomId(resolvedRoomId)
        if (session && recallMessageBody) {
          session.text = recallMessageBody
        }
        useMitt.emit(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: resolvedRoomId })
      }

      const messageList = currentReplyMap.value?.[msgId]
      if (messageList) {
        for (const id of messageList) {
          const msg = currentMessageMap.value?.[id]
          if (msg) {
            msg.message.body.reply.body = '原消息已被撤回'
          }
        }
      }
    }

    const getRecalledMessage = (msgId: string): RecalledMessage | undefined => {
      return recalledMessages[msgId]
    }

    const deleteMsg = (msgId: string) => {
      if (currentMessageMap.value && msgId in currentMessageMap.value) {
        delete currentMessageMap.value[msgId]
      }
    }

    const clearRoomMessages = (roomId: string) => {
      if (!roomId) return

      if (messageMap[roomId]) {
        messageMap[roomId] = {}
      }

      if (replyMapping[roomId]) {
        replyMapping[roomId] = {}
      }

      const defaultOptions = {
        isLast: true,
        isLoading: false,
        cursor: ''
      }

      if (globalStore.currentSessionRoomId === roomId) {
        currentMessageOptions.value = defaultOptions
        currentReplyMap.value = {}
        currentMsgReply.value = {}
      } else {
        messageOptions[roomId] = defaultOptions
      }

      newMsgCount[roomId] = { count: 0, isStart: false }
    }

    const updateMsg = ({
      msgId,
      status,
      newMsgId,
      body,
      uploadProgress,
      timeBlock,
      roomId
    }: {
      msgId: string
      status: MessageStatusEnum
      newMsgId?: string
      body?: any
      uploadProgress?: number
      timeBlock?: number
      roomId?: string
    }) => {
      const resolvedRoomId =
        (roomId && messageMap[roomId]?.[msgId] ? roomId : undefined) ??
        (messageMap[globalStore.currentSessionRoomId]?.[msgId] ? globalStore.currentSessionRoomId : undefined) ??
        findRoomIdByMsgId(msgId)

      if (!resolvedRoomId) return

      const roomMessages = messageMap[resolvedRoomId]
      if (!roomMessages) return

      const msg = roomMessages[msgId]
      if (!msg) return

      msg.message.status = status
      if (timeBlock !== undefined) {
        msg.timeBlock = timeBlock
      }
      if (body) {
        msg.message.body = body
      }

      const nextMsgId = newMsgId ?? msg.message.id
      if (newMsgId) {
        msg.message.id = newMsgId
      }

      if (uploadProgress !== undefined) {
        console.log(`更新消息进度: ${uploadProgress}% (消息ID: ${msgId})`)
        roomMessages[nextMsgId] = { ...msg, uploadProgress }
        messageMap[resolvedRoomId] = { ...roomMessages }
      } else {
        roomMessages[nextMsgId] = msg
      }

      if (newMsgId && msgId !== newMsgId) {
        delete roomMessages[msgId]
        messageMap[resolvedRoomId] = { ...roomMessages }
      }
    }

    const markSessionReadLock = new Set<string>()
    const markMsgReadQueue = pLimit(1)

    const markSessionRead = (roomId: string) => {
      if (markSessionReadLock.has(roomId)) return

      const session = resolveSessionByRoomId(roomId)
      if (!session) {
        console.log('[markSessionRead] 会话不存在:', roomId)
        return
      }

      markSessionReadLock.add(roomId)

      const activeTime = session.activeTime || Date.now()
      lastReadActiveTime.value[roomId] = activeTime
      sessionUnreadStore.setLastRead(userStore.userInfo?.uid, roomId, activeTime)

      persistUnreadCount(roomId, 0)
      updateSession(roomId, { unreadCount: 0 })

      markMsgReadQueue(async () => {
        try {
          await matrixReceiptService.markRoomAsRead(roomId)
        } catch (err) {
          console.error('[markSessionRead] 已读上报失败:', err)
        }
      }).catch((err) => {
        console.error('[markSessionRead] 已读上报失败:', err)
      })

      updateTotalUnreadCount()

      setTimeout(() => {
        markSessionReadLock.delete(roomId)
      }, 500)
    }

    const clearCurrentSessionUnread = async () => {
      const roomId = globalStore.currentSessionRoomId
      if (!roomId) return
      const session = resolveSessionByRoomId(roomId)
      if (!session?.unreadCount) return
      markSessionRead(roomId)
    }

    const getMessage = (messageId: string) => {
      return currentMessageMap.value?.[messageId]
    }

    const removeSession = (roomId: string) => {
      const session = resolveSessionByRoomId(roomId)
      if (session) {
        const index = sessionList.value.findIndex((s) => s.roomId === roomId)
        if (index !== -1) {
          sessionList.value.splice(index, 1)
        }

        delete sessionMap.value[roomId]
        delete lastReadActiveTime.value[roomId]
        sessionUnreadStore.setLastRead(userStore.userInfo?.uid, roomId, 0)

        if (globalStore.currentSessionRoomId === roomId) {
          globalStore.updateCurrentSessionRoomId(sessionList.value[0]?.roomId || '')
        }

        requestUnreadCountUpdate()
      }
      removeUnreadCountCache(roomId)
    }

    timerWorker.onmessage = (e) => {
      const { type, msgId } = e.data

      if (type === 'timeout') {
        console.log(`[Timeout] 消息ID: ${msgId} 已过期`)
        delete recalledMessages[msgId]
        delete expirationTimers[msgId]
      } else if (type === 'allTimersCompleted') {
        clearAllExpirationTimers()
        terminateWorker()
      }
    }

    const terminateWorker = () => {
      timerWorker.terminate()
    }

    const clearAllExpirationTimers = () => {
      for (const msgId in expirationTimers) {
        timerWorker.postMessage({
          type: 'clearTimer',
          msgId
        })
      }
      for (const msgId in expirationTimers) {
        delete expirationTimers[msgId]
      }
      for (const msgId in recalledMessages) {
        delete recalledMessages[msgId]
      }
    }

    const cleanupExpiredRecalledMessages = () => {
      const now = Date.now()
      for (const msgId in recalledMessages) {
        const msg = recalledMessages[msgId]
        if (now - msg.recallTime > RECALL_EXPIRATION_TIME) {
          delete recalledMessages[msgId]
          if (expirationTimers[msgId]) {
            timerWorker.postMessage({ type: 'clearTimer', msgId })
            delete expirationTimers[msgId]
          }
        }
      }
    }

    const updateTotalUnreadCount = () => {
      unreadCountManager.calculateTotal(sessionList.value, globalStore.unReadMark)
    }

    unreadCountManager.setUpdateCallback(() => {
      unreadCountManager.calculateTotal(sessionList.value, globalStore.unReadMark)
    })

    const requestUnreadCountUpdate = (sessionId?: string) => {
      unreadCountManager.requestUpdate(sessionId)
    }

    const clearUnreadCount = () => {
      sessionList.value.forEach((session) => {
        session.unreadCount = 0
        persistUnreadCount(session.roomId, 0)
      })
      requestUnreadCountUpdate()
    }

    const clearRedundantMessages = (roomId: string, limit: number = pageSize) => {
      const currentMessages = messageMap[roomId]
      if (!currentMessages) return

      const sortedMessages = Object.values(currentMessages).sort((a, b) => Number(b.message.id) - Number(a.message.id))

      if (sortedMessages.length <= limit) return

      const keptMessages = sortedMessages.slice(0, limit)
      const keepMessageIds = new Set(keptMessages.map((msg) => msg.message.id))
      const fallbackCursor = keptMessages[keptMessages.length - 1]?.message.id || ''

      for (const msgId in currentMessages) {
        if (!keepMessageIds.has(msgId)) {
          delete currentMessages[msgId]
        }
      }

      if (!messageOptions[roomId]) {
        messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '' }
      }

      if (fallbackCursor) {
        messageOptions[roomId] = {
          ...messageOptions[roomId],
          cursor: fallbackCursor,
          isLast: false
        }
      }

      console.info(
        '[chat][trim]',
        `roomId=${roomId}`,
        `removed=${sortedMessages.length - keptMessages.length}`,
        `kept=${keptMessages.length}`,
        `limit=${limit}`
      )
    }

    const resetAndRefreshCurrentRoomMessages = async () => {
      if (!globalStore.currentSessionRoomId) return

      const requestRoomId = globalStore.currentSessionRoomId

      try {
        if (messageMap[requestRoomId]) {
          messageMap[requestRoomId] = {}
        }

        messageOptions[requestRoomId] = {
          isLast: false,
          isLoading: true,
          cursor: ''
        }

        const currentReplyMapping = replyMapping[requestRoomId]
        if (currentReplyMapping) {
          for (const key in currentReplyMapping) {
            delete currentReplyMapping[key]
          }
        }

        await getPageMsg(pageSize, requestRoomId, '')

        console.log('[Network] 已重置并刷新当前聊天室的消息列表')
      } catch (err) {
        console.error('[Network] 重置并刷新消息列表失败:', err)
        if (globalStore.currentSessionRoomId === requestRoomId) {
          messageOptions[requestRoomId] = {
            isLast: false,
            isLoading: false,
            cursor: ''
          }
        }
      }
    }

    const getGroupSessions = () => {
      return sessionList.value.filter((session) => session.type === RoomTypeEnum.GROUP)
    }

    const setMsgMultiChoose = (flag: boolean, mode: 'normal' | 'forward' = 'normal') => {
      isMsgMultiChoose.value = flag
      msgMultiChooseMode.value = flag ? mode : 'normal'
    }

    const setCustomForwardTask = (task: CustomForwardTask | null) => {
      customForwardTask.value = task
    }

    const resetSessionSelection = () => {
      sessionList.value.forEach((session) => {
        session.isCheck = false
      })
    }

    return {
      getMsgIndex,
      chatMessageList,
      pushMsg,
      deleteMsg,
      clearRoomMessages,
      clearNewMsgCount,
      updateMarkCount,
      updateRecallMsg,
      recordRecallMsg,
      updateMsg,
      newMsgCount,
      messageMap,
      currentMessageMap,
      currentMessageOptions,
      currentReplyMap,
      currentNewMsgCount,
      loadMore,
      currentMsgReply,
      sessionList,
      sessionOptions,
      syncLoading,
      getSessionList,
      updateSession,
      updateSessionLastActiveTime,
      markSessionRead,
      getSession,
      isGroup,
      currentSessionInfo,
      getMessage,
      getRecalledMessage,
      recalledMessages,
      clearAllExpirationTimers,
      cleanupExpiredRecalledMessages,
      updateTotalUnreadCount,
      requestUnreadCountUpdate,
      clearUnreadCount,
      resetAndRefreshCurrentRoomMessages,
      fetchCurrentRoomRemoteOnce,
      getGroupSessions,
      removeSession,
      changeRoom,
      addSession,
      setAllSessionMsgList,
      chatMessageListByRoomId,
      shouldShowNoMoreMessage,
      isMsgMultiChoose,
      clearMsgCheck,
      setMsgMultiChoose,
      msgMultiChooseMode,
      customForwardTask,
      setCustomForwardTask,
      resetSessionSelection,
      checkMsgExist,
      clearRedundantMessages,
      clearCurrentSessionUnread
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
