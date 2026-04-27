import type { MessageType } from './types'

/**
 * 维护每个房间消息按 `message.id` 升序的有序键集合，
 * 同时保留键 -> 索引的反向映射，避免线性查找。
 */
export const createMessageSortedKeys = (
  messageMap: Record<string, Record<string, MessageType>>,
  sortedMessageKeys: Record<string, string[]>,
  sortedMessageKeyIndexes: Record<string, Record<string, number>>
) => {
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

  return {
    ensureSortedMessageState,
    rebuildSortedMessageKeyIndex,
    setSortedMessageKeys,
    findMessageInsertIndex,
    mergeSortedMessageKeys,
    getCurrentSortedMessageKeys
  }
}
