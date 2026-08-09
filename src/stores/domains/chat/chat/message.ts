import { defineStore } from 'pinia'
import { useRoute } from 'vue-router'
import { MessageStatusEnum, RoomTypeEnum, StoresEnum } from '@/enums'
import matrixEventService from '@/services/matrix/MatrixEventService'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useSessionStore } from './session'
import { getTimerWorker } from './timerWorker'
import type { CustomForwardTask, MessageBody, MessageType, RecalledMessage } from './types'

export type { MessageBody, MessageType }

import { createMessageLoading } from './messageLoading'
import { createMessageMutations } from './messageMutations'
import { createMessageReplyMapping } from './messageReplyMapping'
import { createMessageRoomIndex } from './messageRoomIndex'
import { createMessageSortedKeys } from './messageSortedKeys'
import { createRecallManager } from './recallManager'

type MessageListOptions = {
  isLast: boolean
  isLoading: boolean
  cursor: string
  hasLoadedOnce?: boolean
}

export const useChatStore = defineStore(StoresEnum.CHAT, () => {
  const route = useRoute()
  const userStore = useUserStore()
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()
  const sessionStore = useSessionStore()

  // 使用两个数据结构：Map 用于快速查找和修改，Array 用于保持顺序和渲染
  const messageMap = shallowReactive<Record<string, Record<string, MessageType>>>({})
  const sortedMessageKeys = reactive<Record<string, string[]>>({})
  const sortedMessageKeyIndexes = reactive<Record<string, Record<string, number>>>({})
  const messageOptions = reactive<Record<string, MessageListOptions>>({})

  const transientStatuses = new Set<MessageStatusEnum>([
    MessageStatusEnum.PENDING,
    MessageStatusEnum.SENDING,
    MessageStatusEnum.FAILED
  ])
  const shouldKeepTransientMessage = (msg?: MessageType) => {
    return msg?.message?.status ? transientStatuses.has(msg.message.status) : false
  }

  const sortedKeysHelpers = createMessageSortedKeys(messageMap, sortedMessageKeys, sortedMessageKeyIndexes)
  const {
    ensureSortedMessageState,
    rebuildSortedMessageKeyIndex,
    setSortedMessageKeys,
    findMessageInsertIndex,
    mergeSortedMessageKeys,
    getCurrentSortedMessageKeys
  } = sortedKeysHelpers

  const replyMapping = reactive<Record<string, Record<string, string[]>>>({})
  const recallMgr = createRecallManager()
  const recalledMessages = recallMgr.recalledMessages
  const { clearAllExpirationTimers, cleanupExpiredRecalledMessages } = recallMgr
  const messageRoomIndexes = reactive<Record<string, string>>({})
  const isMsgMultiChoose = ref<boolean>(false)
  const msgMultiChooseMode = ref<'normal' | 'forward'>('normal')
  const customForwardTask = ref<CustomForwardTask | null>(null)

  const roomIndexHelpers = createMessageRoomIndex(messageRoomIndexes, messageMap)
  const { setMessageRoomIndex, deleteMessageRoomIndex, rebuildMessageRoomIndex, findRoomIdByMsgId } = roomIndexHelpers

  const replyMappingHelpers = createMessageReplyMapping(replyMapping, messageMap)
  const {
    removeReplyReferences,
    upsertReplyReference,
    syncReplyReference,
    rebuildReplyMapping,
    migrateReplyTargetReferences
  } = replyMappingHelpers

  const currentMessageMap = computed(() => {
    return messageMap[globalStore.currentSessionRoomId] || {}
  })

  // 注意：getter 必须是纯函数，不能在读取时写入 messageOptions（避免在 computed 中产生副作用、
  // 进而可能把某个房间“播种”成 hasLoadedOnce:false 且永不翻转，导致骨架屏永久转圈）。
  // 缺失的房间返回稳定的默认对象即可，真正写入由 changeRoom / getPageMsg 通过 setter 完成。
  const currentMessageOptions = computed({
    get: () => {
      const roomId = globalStore.currentSessionRoomId
      return (
        messageOptions[roomId] ??
        ({ isLast: false, isLoading: false, cursor: '', hasLoadedOnce: false } as MessageListOptions)
      )
    },
    set: (val) => {
      const roomId = globalStore.currentSessionRoomId
      messageOptions[roomId] = val as MessageListOptions
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

  const currentMsgReply = ref<Partial<MessageType>>({})

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

  const chatMessageList = computed(() => {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId || !sortedMessageKeys[roomId]) return []
    return sortedMessageKeys[roomId].map((id) => messageMap[roomId][id]).filter(Boolean)
  })

  const chatMessageListByRoomId = computed(() => (roomId: string) => {
    if (!sortedMessageKeys[roomId]) return []
    return sortedMessageKeys[roomId].map((id) => messageMap[roomId][id]).filter(Boolean)
  })

  const mutations = createMessageMutations({
    route,
    userStore,
    groupStore,
    globalStore,
    sessionStore,
    recallMgr,
    messageMap,
    sortedMessageKeys,
    replyMapping,
    messageOptions,
    newMsgCount,
    currentMessageMap,
    currentMessageOptions,
    currentReplyMap,
    currentMsgReply,
    ensureSortedMessageState,
    rebuildSortedMessageKeyIndex,
    setSortedMessageKeys,
    findMessageInsertIndex,
    getCurrentSortedMessageKeys,
    setMessageRoomIndex,
    deleteMessageRoomIndex,
    rebuildMessageRoomIndex,
    findRoomIdByMsgId,
    removeReplyReferences,
    upsertReplyReference,
    syncReplyReference,
    rebuildReplyMapping,
    migrateReplyTargetReferences
  })

  const {
    pushMsg,
    updateMsg,
    deleteMsg,
    clearRoomMessages,
    clearRedundantMessages,
    updateMarkCount,
    recordRecallMsg,
    updateRecallMsg
  } = mutations

  const loading = createMessageLoading({
    globalStore,
    sessionStore,
    messageMap,
    messageOptions,
    replyMapping,
    currentMessageOptions,
    currentReplyMap,
    currentMsgReply,
    ensureSortedMessageState,
    setSortedMessageKeys,
    mergeSortedMessageKeys,
    setMessageRoomIndex,
    syncReplyReference,
    cleanupExpiredRecalledMessages,
    clearOtherRoomsMessages,
    clearRoomMessagesExceptTransient
  })

  const { setAllSessionMsgList, loadMore, fetchCurrentRoomRemoteOnce, changeRoom, resetAndRefreshCurrentRoomMessages } =
    loading

  const checkMsgExist = (roomId: string, msgId: string) => {
    const current = messageMap[roomId]
    return current && msgId in current
  }

  const clearMsgCheck = () => {
    chatMessageList.value.forEach((msg) => (msg.isCheck = false))
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

  const getRecalledMessage = (msgId: string): RecalledMessage | undefined => {
    return recallMgr.getRecalledMessage(msgId)
  }

  const getMessage = (messageId: string) => {
    return currentMessageMap.value?.[messageId]
  }

  const markSessionRead = (roomId: string) => {
    sessionStore.markSessionRead(roomId)
  }

  const clearCurrentSessionUnread = () => {
    sessionStore.clearCurrentSessionUnread()
  }

  const removeSession = (roomId: string) => {
    sessionStore.removeSession(roomId)
  }

  const updateTotalUnreadCount = () => {
    sessionStore.updateTotalUnreadCount()
  }

  const requestUnreadCountUpdate = (_sessionId?: string) => {
    sessionStore.requestUnreadCountUpdate()
  }

  const clearUnreadCount = () => {
    sessionStore.clearUnreadCount()
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
})
