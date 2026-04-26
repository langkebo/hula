import type { MessageType } from './types'

/**
 * 维护 msgId -> roomId 的反向索引，避免每次跨房间查找时
 * 都要遍历所有房间的消息表。
 */
export const createMessageRoomIndex = (
  messageRoomIndexes: Record<string, string>,
  messageMap: Record<string, Record<string, MessageType>>
) => {
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

  return {
    setMessageRoomIndex,
    deleteMessageRoomIndex,
    rebuildMessageRoomIndex,
    findRoomIdByMsgId
  }
}
