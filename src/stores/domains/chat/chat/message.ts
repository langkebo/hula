import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import pLimit from 'p-limit'
import { defineStore } from 'pinia'
import { useRoute } from 'vue-router'
import { MessageStatusEnum, MsgEnum, StoresEnum, RoomTypeEnum, MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { useSessionStore, type SessionItem } from './session'
import { matrixRoomService } from '@/services/matrix/room/MatrixRoomService'
import matrixEventService from '@/services/matrix/MatrixEventService'
import {
  pageSize,
  ROOM_MESSAGE_CACHE_LIMIT,
  RECALL_EXPIRATION_TIME,
  type MessageType,
  type MessageBody,
  type RecalledMessage,
  type CustomForwardTask
} from './types'
import { getTimerWorker } from './timerWorker'

export type { MessageType, MessageBody, RecalledMessage, CustomForwardTask }
export { pageSize, ROOM_MESSAGE_CACHE_LIMIT, RECALL_EXPIRATION_TIME }
import { sendNotification } from '@tauri-apps/plugin-notification'
import { createLogger } from '@/utils/Logger'
import { getBodyReply } from '@/utils/messageBody'
import { createRecallManager } from './recallManager'

const logger = createLogger('ChatMessageStore')

export const useChatStore = defineStore(
  StoresEnum.CHAT,
  () => {
    const route = useRoute()
    const userStore = useUserStore()
    const globalStore = useGlobalStore()
    const groupStore = useGroupStore()
    const sessionStore = useSessionStore()

    // 使用两个数据结构：Map 用于快速查找和修改，Array 用于保持顺序和渲染
    const messageMap = shallowReactive<Record<string, Record<string, MessageType>>>({})
    const sortedMessageKeys = reactive<Record<string, string[]>>({})
    const sortedMessageKeyIndexes = reactive<Record<string, Record<string, number>>>({})
    const messageOptions = reactive<Record<string, { isLast: boolean; isLoading: boolean; cursor: string }>>({})

    const transientStatuses = new Set<MessageStatusEnum>([
      MessageStatusEnum.PENDING,
      MessageStatusEnum.SENDING,
      MessageStatusEnum.FAILED
    ])
    const shouldKeepTransientMessage = (msg?: MessageType) => {
      return msg?.message?.status ? transientStatuses.has(msg.message.status) : false
    }

    const ensureSortedMessageState = (roomId: string) => {
      if (!sortedMessageKeys[roomId]) {
        sortedMessageKeys[roomId] = []
      }
      if (!sortedMessageKeyIndexes[roomId]) {
        sortedMessageKeyIndexes[roomId] = {}
      }
    }

    const rebuildSortedMessageKeyIndex = (roomId: string) => {
      ensureSortedMessageState(roomId)
      const nextIndexMap: Record<string, number> = {}
      sortedMessageKeys[roomId].forEach((msgId, index) => {
        nextIndexMap[msgId] = index
      })
      sortedMessageKeyIndexes[roomId] = nextIndexMap
    }

    const setSortedMessageKeys = (roomId: string, keys: string[]) => {
      sortedMessageKeys[roomId] = keys
      rebuildSortedMessageKeyIndex(roomId)
    }

    const getMessageOrder = (msg?: MessageType) => {
      return Number(msg?.message.id ?? 0)
    }

    const compareMessageKeys = (roomId: string, leftKey: string, rightKey: string) => {
      const roomMessages = messageMap[roomId]
      return getMessageOrder(roomMessages?.[leftKey]) - getMessageOrder(roomMessages?.[rightKey])
    }

    const findMessageInsertIndex = (roomId: string, messageKey: string) => {
      ensureSortedMessageState(roomId)
      const keys = sortedMessageKeys[roomId]
      const roomMessages = messageMap[roomId]
      const newOrder = getMessageOrder(roomMessages?.[messageKey])
      let low = 0
      let high = keys.length - 1

      while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        const midMsg = roomMessages[keys[mid]]
        const midOrder = getMessageOrder(midMsg)

        if (midOrder === newOrder) {
          low = mid
          break
        }

        if (midOrder < newOrder) {
          low = mid + 1
        } else {
          high = mid - 1
        }
      }

      return low
    }

    const mergeSortedMessageKeys = (roomId: string, incomingKeys: string[]) => {
      ensureSortedMessageState(roomId)
      if (!incomingKeys.length) {
        return
      }

      const existingKeys = sortedMessageKeys[roomId]
      const existingKeySet = new Set(existingKeys)
      const uniqueIncomingKeys = incomingKeys.filter((key) => !existingKeySet.has(key))
      if (!uniqueIncomingKeys.length) {
        return
      }

      uniqueIncomingKeys.sort((a, b) => compareMessageKeys(roomId, a, b))

      const mergedKeys: string[] = []
      let existingIndex = 0
      let incomingIndex = 0

      while (existingIndex < existingKeys.length && incomingIndex < uniqueIncomingKeys.length) {
        if (compareMessageKeys(roomId, existingKeys[existingIndex], uniqueIncomingKeys[incomingIndex]) <= 0) {
          mergedKeys.push(existingKeys[existingIndex])
          existingIndex++
        } else {
          mergedKeys.push(uniqueIncomingKeys[incomingIndex])
          incomingIndex++
        }
      }

      if (existingIndex < existingKeys.length) {
        mergedKeys.push(...existingKeys.slice(existingIndex))
      }
      if (incomingIndex < uniqueIncomingKeys.length) {
        mergedKeys.push(...uniqueIncomingKeys.slice(incomingIndex))
      }

      setSortedMessageKeys(roomId, mergedKeys)
    }

    const getCurrentSortedMessageKeys = (roomId: string) => {
      ensureSortedMessageState(roomId)
      if (sortedMessageKeys[roomId].length === 0 && messageMap[roomId]) {
        setSortedMessageKeys(
          roomId,
          Object.keys(messageMap[roomId]).sort((a, b) => compareMessageKeys(roomId, a, b))
        )
      }
      return sortedMessageKeys[roomId]
    }

    const replyMapping = reactive<Record<string, Record<string, string[]>>>({})
    const recallMgr = createRecallManager()
    const recalledMessages = recallMgr.recalledMessages
    const expirationTimers: Record<string, boolean> = {}
    const messageRoomIndexes = reactive<Record<string, string>>({})
    const isMsgMultiChoose = ref<boolean>(false)
    const msgMultiChooseMode = ref<'normal' | 'forward'>('normal')
    const customForwardTask = ref<CustomForwardTask | null>(null)

    const setMessageRoomIndex = (msgId: string, roomId: string) => {
      if (!msgId || !roomId) return
      messageRoomIndexes[msgId] = roomId
    }

    const deleteMessageRoomIndex = (msgId: string) => {
      if (!msgId) return
      delete messageRoomIndexes[msgId]
    }

    const rebuildMessageRoomIndex = (roomId: string) => {
      for (const msgId in messageRoomIndexes) {
        if (messageRoomIndexes[msgId] === roomId) {
          delete messageRoomIndexes[msgId]
        }
      }

      const roomMessages = messageMap[roomId]
      if (!roomMessages) return

      for (const msgId in roomMessages) {
        setMessageRoomIndex(msgId, roomId)
      }
    }

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
      return sessionStore.getSession(roomId)
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

    const removeReplyReferences = (roomId: string, sourceMsgId: string) => {
      if (!sourceMsgId || !replyMapping[roomId]) return
      const roomReplyMap = replyMapping[roomId]
      for (const targetMsgId in roomReplyMap) {
        const nextReplyIds = roomReplyMap[targetMsgId].filter((id) => id !== sourceMsgId)
        if (nextReplyIds.length > 0) {
          roomReplyMap[targetMsgId] = nextReplyIds
        } else {
          delete roomReplyMap[targetMsgId]
        }
      }
    }

    const upsertReplyReference = (roomId: string, sourceMsgId: string, msg?: MessageType) => {
      if (!sourceMsgId || !msg) return
      const replyId = getBodyReply(msg.message.body)?.id
      if (!replyId) return
      const roomReplyMap = (replyMapping[roomId] ??= {})
      const currentReplyIds = roomReplyMap[replyId] ?? []
      if (!currentReplyIds.includes(sourceMsgId)) {
        roomReplyMap[replyId] = [...currentReplyIds, sourceMsgId]
      }
    }

    const syncReplyReference = (roomId: string, sourceMsgId: string, msg?: MessageType) => {
      removeReplyReferences(roomId, sourceMsgId)
      upsertReplyReference(roomId, sourceMsgId, msg)
    }

    const rebuildReplyMapping = (roomId: string) => {
      const roomMessages = messageMap[roomId]
      const roomReplyMap: Record<string, string[]> = {}

      if (roomMessages) {
        for (const sourceMsgId in roomMessages) {
          const replyId = getBodyReply(roomMessages[sourceMsgId].message.body)?.id
          if (!replyId) continue
          const currentReplyIds = roomReplyMap[replyId] ?? []
          if (!currentReplyIds.includes(sourceMsgId)) {
            roomReplyMap[replyId] = [...currentReplyIds, sourceMsgId]
          }
        }
      }

      replyMapping[roomId] = roomReplyMap
    }

    const migrateReplyTargetReferences = (roomId: string, oldMsgId: string, newMsgId: string) => {
      if (!oldMsgId || !newMsgId || oldMsgId === newMsgId) return

      const roomReplyMap = replyMapping[roomId]
      const referencedReplyIds = roomReplyMap?.[oldMsgId] ?? []
      if (referencedReplyIds.length === 0) return

      const nextReplyIds = roomReplyMap?.[newMsgId] ?? []
      const mergedReplyIds = [...new Set([...nextReplyIds, ...referencedReplyIds])]

      if (roomReplyMap) {
        roomReplyMap[newMsgId] = mergedReplyIds
        delete roomReplyMap[oldMsgId]
      }

      const roomMessages = messageMap[roomId]
      if (!roomMessages) return

      for (const sourceMsgId of mergedReplyIds) {
        const reply = getBodyReply(roomMessages[sourceMsgId]?.message.body)
        if (reply && reply.id === oldMsgId) {
          reply.id = newMsgId
        }
      }
    }

    const clearOtherRoomsMessages = (currentRoomId: string) => {
      for (const roomId in messageMap) {
        if (roomId !== currentRoomId) {
          const roomMessages = messageMap[roomId]
          const newRoomMessages: Record<string, MessageType> = {}
          const currentKeys = getCurrentSortedMessageKeys(roomId)
          const newSortedKeys: string[] = []
          for (const msgId of currentKeys) {
            const msg = roomMessages[msgId]
            if (shouldKeepTransientMessage(msg)) {
              newRoomMessages[msgId] = msg
              newSortedKeys.push(msgId)
            }
          }
          if (newSortedKeys.length !== currentKeys.length) {
            messageMap[roomId] = newRoomMessages
            setSortedMessageKeys(roomId, newSortedKeys)
            rebuildMessageRoomIndex(roomId)
            rebuildReplyMapping(roomId)
          }
        }
      }
    }

    const clearRoomMessagesExceptTransient = (roomId: string) => {
      if (!messageMap[roomId]) {
        messageMap[roomId] = {}
        setSortedMessageKeys(roomId, [])
        return
      }
      const roomMessages = messageMap[roomId]
      const newRoomMessages: Record<string, MessageType> = {}
      const currentKeys = getCurrentSortedMessageKeys(roomId)
      const newSortedKeys: string[] = []
      for (const msgId of currentKeys) {
        const msg = roomMessages[msgId]
        if (shouldKeepTransientMessage(msg)) {
          newRoomMessages[msgId] = msg
          newSortedKeys.push(msgId)
        }
      }
      messageMap[roomId] = newRoomMessages
      setSortedMessageKeys(roomId, newSortedKeys)
      rebuildMessageRoomIndex(roomId)
      rebuildReplyMapping(roomId)
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
        logger.error('无法加载消息:', err)
        currentMessageOptions.value = {
          isLast: false,
          isLoading: false,
          cursor: ''
        }
      }

      if (globalStore.currentSessionRoomId) {
        sessionStore.markSessionRead(globalStore.currentSessionRoomId)
      }

      currentMsgReply.value = {}
    }

    const currentMsgReply = ref<Partial<MessageType>>({})

    const chatMessageList = computed(() => {
      const roomId = globalStore.currentSessionRoomId
      if (!roomId || !sortedMessageKeys[roomId]) return []

      return sortedMessageKeys[roomId].map((id) => messageMap[roomId][id]).filter(Boolean)
    })

    const chatMessageListByRoomId = computed(() => (roomId: string) => {
      if (!sortedMessageKeys[roomId]) return []
      return sortedMessageKeys[roomId].map((id) => messageMap[roomId][id]).filter(Boolean)
    })

    const findRoomIdByMsgId = (msgId: string) => {
      if (!msgId) return ''
      const indexedRoomId = messageRoomIndexes[msgId]
      if (indexedRoomId && messageMap[indexedRoomId]?.[msgId]) {
        return indexedRoomId
      }
      for (const roomId of Object.keys(messageMap)) {
        const roomMessages = messageMap[roomId]
        if (roomMessages && msgId in roomMessages) {
          setMessageRoomIndex(msgId, roomId)
          return roomId
        }
      }
      return ''
    }

    const setAllSessionMsgList = async (size = pageSize) => {
      await info('初始设置所有会话消息列表')
      if (sessionStore.sessionList.length === 0) return

      const sortedSessions = [...sessionStore.sessionList].sort((a, b) => b.activeTime - a.activeTime)
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
        const result = await matrixEventService.getPagedRoomMessages(roomId, pageSize, cursor)

        if (!messageMap[roomId]) {
          messageMap[roomId] = {}
        }
        ensureSortedMessageState(roomId)

        const newKeys: string[] = []
        for (const msg of result.messages) {
          const msgId = msg.message.id
          messageMap[roomId][msgId] = msg
          setMessageRoomIndex(msgId, roomId)
          syncReplyReference(roomId, msgId, msg)
          newKeys.push(msgId)
        }

        mergeSortedMessageKeys(roomId, newKeys)

        messageOptions[roomId] = {
          isLast: result.isLast,
          isLoading: false,
          cursor: result.cursor
        }
      } catch (err) {
        logger.error('获取消息失败:', err)
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

      // 幂等性检查：如果消息已存在且不是自己发送的更新状态，直接忽略
      const existedMsg = roomMessages[messageKey]
      if (existedMsg) {
        // 允许发送过程中的状态更新（如：发送中 -> 成功）
        if (existedMsg.message.sendTime === msg.message.sendTime) {
          return
        }
      }

      roomMessages[messageKey] = msg
      setMessageRoomIndex(messageKey, msg.message.roomId)
      syncReplyReference(msg.message.roomId, messageKey, msg)

      // 二分查找插入，维持有序性
      ensureSortedMessageState(msg.message.roomId)

      if (!existedMsg) {
        const keys = sortedMessageKeys[msg.message.roomId]
        const low = findMessageInsertIndex(msg.message.roomId, messageKey)
        keys.splice(low, 0, messageKey)
        rebuildSortedMessageKeyIndex(msg.message.roomId)
      }

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

      const session = sessionStore.getSession(msg.message.roomId)
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
          logger.debug('增加未读数:', msg.message.roomId, updateData.unreadCount)
        }

        sessionStore.updateSession(msg.message.roomId, updateData)
      } else {
        const room = await matrixRoomService.getRoom(msg.message.roomId, false)
        if (room) {
          const newSession = {
            roomId: room.roomId,
            name: room.name || room.roomId,
            avatar: room.getMxcAvatarUrl() || '',
            type: room.getJoinedMemberCount() === 2 ? RoomTypeEnum.SINGLE : RoomTypeEnum.GROUP,
            unreadCount: 0,
            activeTime: Date.now()
          }
          sessionStore.addSession(newSession)
          const isSelfMessage = msg.fromUser.uid === userStore.userInfo!.uid
          const shouldIncreaseUnread = !isSelfMessage && (!isActiveChatView || msg.message.roomId !== targetRoomId)
          if (shouldIncreaseUnread) {
            sessionStore.updateSession(msg.message.roomId, { unreadCount: 1 })
          }
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
      const roomId = globalStore.currentSessionRoomId
      if (!roomId) return -1
      return sortedMessageKeyIndexes[roomId]?.[msgId] ?? -1
    }

    const getMessageIndexByRoomId = (roomId: string, msgId: string) => {
      if (!roomId || !msgId) return -1
      return sortedMessageKeyIndexes[roomId]?.[msgId] ?? -1
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
      ensureTimerWorkerListener()
      const recallTime = Date.now()
      recalledMessages[data.msg.message.id] = {
        messageId: data.msg.message.id,
        content: data.originalContent ?? data.msg.message.body.content ?? data.msg.message.body.body ?? '',
        recallTime,
        originalType: data.originalType ?? data.msg.message.type
      }

      if (data.recallUid === userStore.userInfo!.uid) {
        getTimerWorker().postMessage({
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
      const session = resolvedRoomId ? sessionStore.getSession(resolvedRoomId) : undefined
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
        const session = sessionStore.getSession(resolvedRoomId)
        if (session && recallMessageBody) {
          sessionStore.updateSession(resolvedRoomId, { text: recallMessageBody })
        }
        useMitt.emit(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: resolvedRoomId })
      }

      const roomReplyMap = resolvedRoomId ? replyMapping[resolvedRoomId] : undefined
      const messageList = roomReplyMap?.[msgId]
      if (messageList) {
        for (const id of messageList) {
          const msg = roomMessages?.[id] || currentMessageMap.value?.[id]
          if (msg && typeof msg.message.body === 'object' && msg.message.body.reply) {
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
        const roomId = globalStore.currentSessionRoomId
        delete currentMessageMap.value[msgId]
        deleteMessageRoomIndex(msgId)
        removeReplyReferences(roomId, msgId)
        if (sortedMessageKeys[roomId]) {
          setSortedMessageKeys(
            roomId,
            sortedMessageKeys[roomId].filter((id) => id !== msgId)
          )
        }
      }
    }

    const clearRoomMessages = (roomId: string) => {
      if (!roomId) return

      if (messageMap[roomId]) {
        messageMap[roomId] = {}
      }
      rebuildMessageRoomIndex(roomId)
      replyMapping[roomId] = {}

      setSortedMessageKeys(roomId, [])

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
      body?: Record<string, unknown>
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
      const previousMessageId = msg.message.id

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
        logger.debug(`更新消息进度: ${uploadProgress}% (消息ID: ${msgId})`)
        roomMessages[nextMsgId] = { ...msg, uploadProgress }
        setMessageRoomIndex(nextMsgId, resolvedRoomId)
        messageMap[resolvedRoomId] = { ...roomMessages }
      } else {
        roomMessages[nextMsgId] = msg
        setMessageRoomIndex(nextMsgId, resolvedRoomId)
      }

      removeReplyReferences(resolvedRoomId, previousMessageId)
      if (newMsgId && previousMessageId !== newMsgId) {
        migrateReplyTargetReferences(resolvedRoomId, previousMessageId, newMsgId)
        removeReplyReferences(resolvedRoomId, newMsgId)
      }
      upsertReplyReference(resolvedRoomId, nextMsgId, roomMessages[nextMsgId])

      if (newMsgId && msgId !== newMsgId) {
        delete roomMessages[msgId]
        deleteMessageRoomIndex(msgId)
        if (sortedMessageKeys[resolvedRoomId]) {
          setSortedMessageKeys(
            resolvedRoomId,
            sortedMessageKeys[resolvedRoomId].filter((id) => id !== msgId)
          )

          // 如果是新的 msgId，需要按顺序插入
          if (!sortedMessageKeys[resolvedRoomId].includes(newMsgId)) {
            const keys = sortedMessageKeys[resolvedRoomId]
            const low = findMessageInsertIndex(resolvedRoomId, newMsgId)
            keys.splice(low, 0, newMsgId)
            rebuildSortedMessageKeyIndex(resolvedRoomId)
          }
        }
        messageMap[resolvedRoomId] = { ...roomMessages }
      }
    }

    const markSessionRead = (roomId: string) => {
      sessionStore.markSessionRead(roomId)
    }

    const clearCurrentSessionUnread = () => {
      sessionStore.clearCurrentSessionUnread()
    }

    const getMessage = (messageId: string) => {
      return currentMessageMap.value?.[messageId]
    }

    const removeSession = (roomId: string) => {
      sessionStore.removeSession(roomId)
    }

    let timerWorkerListenerAttached = false
    const ensureTimerWorkerListener = () => {
      if (timerWorkerListenerAttached) return
      timerWorkerListenerAttached = true
      getTimerWorker().onmessage = (e) => {
        const { type, msgId } = e.data

        if (type === 'timeout') {
          logger.debug(`消息ID: ${msgId} 已过期`)
          delete recalledMessages[msgId]
          delete expirationTimers[msgId]
        } else if (type === 'allTimersCompleted') {
          logger.debug('撤回消息计时器已全部结束')
        }
      }
    }

    const clearAllExpirationTimers = () => {
      for (const msgId in expirationTimers) {
        getTimerWorker().postMessage({
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
            getTimerWorker().postMessage({ type: 'clearTimer', msgId })
            delete expirationTimers[msgId]
          }
        }
      }
    }

    const updateTotalUnreadCount = () => {
      sessionStore.updateTotalUnreadCount()
    }

    const requestUnreadCountUpdate = (_sessionId?: string) => {
      // sessionId parameter was removed in sessionStore, so we don't pass it
      sessionStore.requestUnreadCountUpdate()
    }

    const clearUnreadCount = () => {
      sessionStore.clearUnreadCount()
    }

    const clearRedundantMessages = (roomId: string, limit: number = pageSize) => {
      const currentMessages = messageMap[roomId]
      if (!currentMessages) return

      const currentKeys = getCurrentSortedMessageKeys(roomId)

      if (currentKeys.length <= limit) return

      const keptKeys = currentKeys.slice(-limit)
      const keepMessageIds = new Set(keptKeys)
      const fallbackCursor = keptKeys[0] || ''

      for (const msgId in currentMessages) {
        if (!keepMessageIds.has(msgId)) {
          delete currentMessages[msgId]
          deleteMessageRoomIndex(msgId)
        }
      }
      setSortedMessageKeys(roomId, keptKeys)
      rebuildMessageRoomIndex(roomId)
      rebuildReplyMapping(roomId)

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

      logger.info(
        'trim',
        `roomId=${roomId}`,
        `removed=${currentKeys.length - keptKeys.length}`,
        `kept=${keptKeys.length}`,
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
        setSortedMessageKeys(requestRoomId, [])
        replyMapping[requestRoomId] = {}

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

        logger.debug('已重置并刷新当前聊天室的消息列表')
      } catch (err) {
        logger.error('重置并刷新消息列表失败:', err)
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
      return sessionStore.getGroupSessions()
    }

    const setMsgMultiChoose = (flag: boolean, mode: 'normal' | 'forward' = 'normal') => {
      isMsgMultiChoose.value = flag
      msgMultiChooseMode.value = flag ? mode : 'normal'
    }

    const setCustomForwardTask = (task: CustomForwardTask | null) => {
      customForwardTask.value = task
    }

    const resetSessionSelection = () => {
      sessionStore.resetSessionSelection()
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
      sortedMessageKeys,
      currentMessageMap,
      currentMessageOptions,
      currentReplyMap,
      currentNewMsgCount,
      loadMore,
      get sessionList() {
        return sessionStore.sessionList
      },
      get sessionOptions() {
        return sessionStore.sessionOptions
      },
      get syncLoading() {
        return sessionStore.syncLoading
      },
      set syncLoading(val: boolean) {
        sessionStore.syncLoading = val
      },
      getSessionList: sessionStore.getSessionList,
      updateSession: sessionStore.updateSession,
      updateSessionLastActiveTime: sessionStore.updateSessionLastActiveTime,
      markSessionRead,
      getSession: sessionStore.getSession,
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
      addSession: sessionStore.addSession,
      setAllSessionMsgList,
      chatMessageListByRoomId,
      shouldShowNoMoreMessage,
      isMsgMultiChoose,
      currentMsgReply,
      clearMsgCheck,
      setMsgMultiChoose,
      msgMultiChooseMode,
      customForwardTask,
      setCustomForwardTask,
      resetSessionSelection,
      checkMsgExist,
      clearRedundantMessages,
      clearCurrentSessionUnread,
      shouldKeepTransientMessage,
      clearOtherRoomsMessages,
      clearRoomMessagesExceptTransient,
      convertEventToMessage: matrixEventService.convertEventToMessage.bind(matrixEventService),
      getMessageIndexByRoomId,
      terminateWorker: () => getTimerWorker().terminate()
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
