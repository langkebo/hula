// Migration: useMessageStore 已废弃，所有功能已委托给 useChatStore（./chat/message）。
// 新代码请直接使用 useChatStore，本文件仅作为过渡兼容保留。
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { StoresEnum } from '@/enums'
import { useChatStore } from './chat/message'
import { getTimerWorker } from './chat/timerWorker'
import {
  type CustomForwardTask,
  type MessageBody,
  type MessageType,
  pageSize,
  RECALL_EXPIRATION_TIME,
  type RecalledMessage,
  ROOM_MESSAGE_CACHE_LIMIT
} from './chat/types'

export type { CustomForwardTask, MessageBody, MessageType, RecalledMessage }
export { pageSize, RECALL_EXPIRATION_TIME, ROOM_MESSAGE_CACHE_LIMIT }

/**
 * @deprecated 请使用 useChatStore 替代。本 store 仅作为 useChatStore 的透传代理，
 * 所有状态和方法均委托给 useChatStore，将在后续版本中移除。
 */
export const useMessageStore = defineStore(StoresEnum.MESSAGE, () => {
  const chatStore = useChatStore()

  const messageMap = computed(() => chatStore.messageMap)
  const messageOptions = computed(() => chatStore.currentMessageOptions)
  const recalledMessages = computed(() => chatStore.recalledMessages)
  const isMsgMultiChoose = computed(() => chatStore.isMsgMultiChoose)
  const msgMultiChooseMode = computed(() => chatStore.msgMultiChooseMode)
  const customForwardTask = computed(() => chatStore.customForwardTask)
  const currentMsgReply = computed(() => chatStore.currentMsgReply)
  const newMsgCount = computed(() => chatStore.newMsgCount)
  const currentMessageMap = computed(() => chatStore.currentMessageMap)
  const currentMessageOptions = computed(() => chatStore.currentMessageOptions)
  const currentReplyMap = computed(() => chatStore.currentReplyMap)
  const currentNewMsgCount = computed(() => chatStore.currentNewMsgCount)
  const chatMessageList = computed(() => chatStore.chatMessageList)
  const chatMessageListByRoomId = computed(() => chatStore.chatMessageListByRoomId)
  const shouldShowNoMoreMessage = computed(() => chatStore.shouldShowNoMoreMessage)
  const sortedMessageKeys = computed(() => chatStore.sortedMessageKeys)
  const sessionList = computed(() => chatStore.sessionList)

  return {
    messageMap,
    messageOptions,
    recalledMessages,
    isMsgMultiChoose,
    msgMultiChooseMode,
    customForwardTask,
    currentMsgReply,
    newMsgCount,
    currentMessageMap,
    currentMessageOptions,
    currentReplyMap,
    currentNewMsgCount,
    chatMessageList,
    chatMessageListByRoomId,
    shouldShowNoMoreMessage,
    sortedMessageKeys,
    sessionList,

    convertEventToMessage: chatStore.convertEventToMessage,
    shouldKeepTransientMessage: chatStore.shouldKeepTransientMessage,
    clearOtherRoomsMessages: chatStore.clearOtherRoomsMessages,
    clearRoomMessagesExceptTransient: chatStore.clearRoomMessagesExceptTransient,
    pushMsg: chatStore.pushMsg,
    deleteMsg: chatStore.deleteMsg,
    updateMsg: chatStore.updateMsg,
    getMessage: chatStore.getMessage,
    checkMsgExist: chatStore.checkMsgExist,
    getMsgIndex: chatStore.getMsgIndex,
    getMessageIndexByRoomId: chatStore.getMessageIndexByRoomId,
    clearRoomMessages: chatStore.clearRoomMessages,
    clearNewMsgCount: chatStore.clearNewMsgCount,
    clearMsgCheck: chatStore.clearMsgCheck,
    clearRedundantMessages: chatStore.clearRedundantMessages,
    updateMarkCount: chatStore.updateMarkCount,
    recordRecallMsg: chatStore.recordRecallMsg,
    updateRecallMsg: chatStore.updateRecallMsg,
    getRecalledMessage: chatStore.getRecalledMessage,
    cleanupExpiredRecalledMessages: chatStore.cleanupExpiredRecalledMessages,
    clearAllExpirationTimers: chatStore.clearAllExpirationTimers,
    setMsgMultiChoose: chatStore.setMsgMultiChoose,
    setCustomForwardTask: chatStore.setCustomForwardTask,
    resetAndRefreshCurrentRoomMessages: chatStore.resetAndRefreshCurrentRoomMessages,
    terminateWorker: chatStore.terminateWorker,
    getTimerWorker
  }
})
