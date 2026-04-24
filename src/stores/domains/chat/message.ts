import { defineStore } from 'pinia'
import { computed } from 'vue'
import { StoresEnum } from '@/enums'
import { useChatStore } from './chat/message'
import {
  type MessageType,
  type MessageBody,
  type RecalledMessage,
  type CustomForwardTask,
  pageSize,
  ROOM_MESSAGE_CACHE_LIMIT,
  RECALL_EXPIRATION_TIME
} from './chat/types'
import { getTimerWorker } from './chat/timerWorker'

export type { MessageType, MessageBody, RecalledMessage, CustomForwardTask }
export { pageSize, ROOM_MESSAGE_CACHE_LIMIT, RECALL_EXPIRATION_TIME }

export const useMessageStore = defineStore(
  StoresEnum.MESSAGE,
  () => {
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
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
