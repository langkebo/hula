import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
import { MessageStatusEnum, MsgEnum, StoresEnum } from '@/enums'
import { useGlobalStore } from '@/stores/global'
import { useUserStore } from '@/stores/user'
import { useGroupStore } from '@/stores/group'
import { sendNotification } from '@tauri-apps/plugin-notification'
import { useRoute } from 'vue-router'
import type { MatrixEvent } from 'matrix-js-sdk'
import { useMitt } from '@/hooks/useMitt'
import { MittEnum } from '@/enums'

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

const pageSize = 20
const ROOM_MESSAGE_CACHE_LIMIT = 40
const RECALL_EXPIRATION_TIME = 2 * 60 * 1000

const timerWorker = new Worker(new URL('../workers/timer.worker.ts', import.meta.url))
timerWorker.onerror = (err) => {
  console.error('[Worker Error]', err)
}

// Expose timerWorker for external access
const getTimerWorker = () => timerWorker

export const useMessageStore = defineStore(
  StoresEnum.MESSAGE,
  () => {
    const route = useRoute()
    const userStore = useUserStore()
    const globalStore = useGlobalStore()
    const groupStore = useGroupStore()

    // ============ State ============
    const messageMap = reactive<Record<string, Record<string, MessageType>>>({})
    const messageOptions = reactive<Record<string, { isLast: boolean; isLoading: boolean; cursor: string }>>({})
    const replyMapping = reactive<Record<string, Record<string, string[]>>>({})
    const recalledMessages = reactive<Record<string, RecalledMessage>>({})
    const expirationTimers: Record<string, boolean> = {}
    const isMsgMultiChoose = ref<boolean>(false)
    const msgMultiChooseMode = ref<'normal' | 'forward'>('normal')
    const customForwardTask = ref<CustomForwardTask | null>(null)
    const currentMsgReply = ref<Partial<MessageType>>({})
    const newMsgCount = reactive<Record<string, { count: number; isStart: boolean }>>({})

    // ============ Computed ============
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

    const chatMessageList = computed(() => {
      if (!currentMessageMap.value || Object.keys(currentMessageMap.value).length === 0) return []
      return Object.values(currentMessageMap.value).sort((a, b) => Number(a.message.id) - Number(b.message.id))
    })

    const chatMessageListByRoomId = computed(() => (roomId: string) => {
      if (!messageMap[roomId] || Object.keys(messageMap[roomId]).length === 0) return []
      return Object.values(messageMap[roomId]).sort((a, b) => Number(a.message.id) - Number(b.message.id))
    })

    // ============ Helper Methods ============
    const transientStatuses = new Set<MessageStatusEnum>([
      MessageStatusEnum.PENDING,
      MessageStatusEnum.SENDING,
      MessageStatusEnum.FAILED
    ])

    const shouldKeepTransientMessage = (msg?: MessageType) => {
      return msg?.message?.status ? transientStatuses.has(msg.message.status) : false
    }

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

    // ============ Convert Methods ============
    const convertEventToMessage = (event: MatrixEvent, room: any): MessageType | null => {
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

    // ============ Message CRUD ============
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

      // Handle notification mention
      if (msg.message.body.atUidList?.includes(userStore.userInfo!.uid)) {
        const cacheUser = groupStore.getUserInfo(msg.fromUser.uid)
        if (cacheUser) {
          sendNotification({
            title: cacheUser.name as string,
            body: msg.message.body.content || msg.message.body.body || '',
            icon: cacheUser.avatar as string
          })
        }
      }

      if (!isActiveChatView || msg.message.roomId !== targetRoomId) {
        clearRedundantMessages(msg.message.roomId, ROOM_MESSAGE_CACHE_LIMIT)
      }
    }

    const deleteMsg = (msgId: string) => {
      if (currentMessageMap.value && msgId in currentMessageMap.value) {
        delete currentMessageMap.value[msgId]
      }
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

    const getMessage = (messageId: string) => {
      return currentMessageMap.value?.[messageId]
    }

    const checkMsgExist = (roomId: string, msgId: string) => {
      const current = messageMap[roomId]
      return current && msgId in current
    }

    const getMsgIndex = (msgId: string) => {
      if (!msgId) return -1
      const keys = currentMessageMap.value ? Object.keys(currentMessageMap.value) : []
      return keys.indexOf(msgId)
    }

    // ============ Clear Methods ============
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

    const clearNewMsgCount = () => {
      currentNewMsgCount.value && (currentNewMsgCount.value.count = 0)
    }

    const clearMsgCheck = () => {
      chatMessageList.value.forEach((msg) => (msg.isCheck = false))
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
        '[message][trim]',
        `roomId=${roomId}`,
        `removed=${sortedMessages.length - keptMessages.length}`,
        `kept=${keptMessages.length}`,
        `limit=${limit}`
      )
    }

    // ============ Mark Methods ============
    const updateMarkCount = async (
      markList: Array<{ msgId: string; markType: number; markCount: number; actType: number; uid: string }>
    ) => {
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

    // ============ Recall Methods ============
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
        // Note: session type would need to be passed in or fetched from session store

        if (isRecallerCurrentUser) {
          if (data.recallUid === senderUid) {
            recallMessageBody = '你撤回了一条消息'
          } else {
            recallMessageBody = `你撤回了${senderName}的一条消息`
          }
        } else {
          // For group chats, we'd need room type info
          if (isSenderCurrentUser) {
            recallMessageBody = '对方撤回了你的一条消息'
          } else {
            recallMessageBody = `${recallerName || '对方'}撤回了一条消息`
          }
        }

        message.message.type = MsgEnum.RECALL
        message.message.body.content = recallMessageBody
        message.message.body.body = recallMessageBody
      }

      if (resolvedRoomId) {
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

    // ============ Multi-choose Methods ============
    const setMsgMultiChoose = (flag: boolean, mode: 'normal' | 'forward' = 'normal') => {
      isMsgMultiChoose.value = flag
      msgMultiChooseMode.value = flag ? mode : 'normal'
    }

    const setCustomForwardTask = (task: CustomForwardTask | null) => {
      customForwardTask.value = task
    }

    // ============ Worker Setup ============
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

    // ============ Reset ============
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

    return {
      // State
      messageMap,
      messageOptions,
      recalledMessages,
      isMsgMultiChoose,
      msgMultiChooseMode,
      customForwardTask,
      currentMsgReply,
      newMsgCount,

      // Computed
      currentMessageMap,
      currentMessageOptions,
      currentReplyMap,
      currentNewMsgCount,
      chatMessageList,
      chatMessageListByRoomId,
      shouldShowNoMoreMessage,

      // Helper Methods
      convertEventToMessage,
      shouldKeepTransientMessage,
      clearOtherRoomsMessages,
      clearRoomMessagesExceptTransient,

      // Message CRUD
      pushMsg,
      deleteMsg,
      updateMsg,
      getMessage,
      checkMsgExist,
      getMsgIndex,

      // Clear Methods
      clearRoomMessages,
      clearNewMsgCount,
      clearMsgCheck,
      clearRedundantMessages,

      // Mark Methods
      updateMarkCount,

      // Recall Methods
      recordRecallMsg,
      updateRecallMsg,
      getRecalledMessage,
      cleanupExpiredRecalledMessages,
      clearAllExpirationTimers,

      // Multi-choose
      setMsgMultiChoose,
      setCustomForwardTask,

      // Reset
      resetAndRefreshCurrentRoomMessages,
      terminateWorker,

      // Worker
      getTimerWorker
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)

export { pageSize, ROOM_MESSAGE_CACHE_LIMIT, RECALL_EXPIRATION_TIME }

// Re-export types for backward compatibility
export type { RecalledMessage, CustomForwardTask }
