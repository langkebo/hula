import type { ComputedRef } from 'vue'
import type { createRecallManager } from './recallManager'
import type { MessageType, RecalledMessage } from './types'

interface MessageQueriesDeps {
  messageMap: Record<string, Record<string, MessageType>>
  sortedMessageKeyIndexes: Record<string, Record<string, number>>
  currentMessageMap: ComputedRef<Record<string, MessageType>>
  currentRoomId: () => string | undefined
  recallMgr: ReturnType<typeof createRecallManager>
}

export const createMessageQueries = (deps: MessageQueriesDeps) => {
  const { messageMap, sortedMessageKeyIndexes, currentMessageMap, currentRoomId, recallMgr } = deps

  const checkMsgExist = (roomId: string, msgId: string) => {
    const current = messageMap[roomId]
    return current && msgId in current
  }

  const getMsgIndex = (msgId: string) => {
    if (!msgId) return -1
    const roomId = currentRoomId()
    if (!roomId) return -1
    return sortedMessageKeyIndexes[roomId]?.[msgId] ?? -1
  }

  const getMessageIndexByRoomId = (roomId: string, msgId: string) => {
    if (!roomId || !msgId) return -1
    return sortedMessageKeyIndexes[roomId]?.[msgId] ?? -1
  }

  const getMessage = (messageId: string) => {
    return currentMessageMap.value?.[messageId]
  }

  const getRecalledMessage = (msgId: string): RecalledMessage | undefined => {
    return recallMgr.getRecalledMessage(msgId)
  }

  return {
    checkMsgExist,
    getMsgIndex,
    getMessageIndexByRoomId,
    getMessage,
    getRecalledMessage
  }
}
