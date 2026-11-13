import { createLogger } from '@/utils/Logger'
import type { MessageMutationsDeps } from './messageMutationsDeps'
import { pageSize } from './types'

const logger = createLogger('ChatMessageMutations')

/**
 * 房间消息缓存裁剪。
 *
 * 从 `messageMutations.ts` 拆出：`pushMsg` 在非活跃会话场景下会复用同一实现，
 * 因此导出独立函数供插入流程调用，同时提供工厂挂到聚合入口上。
 */
export const clearRedundantMessages = (deps: MessageMutationsDeps, roomId: string, limit: number = pageSize) => {
  const {
    messageMap,
    messageOptions,
    getCurrentSortedMessageKeys,
    setSortedMessageKeys,
    deleteMessageRoomIndex,
    rebuildMessageRoomIndex,
    rebuildReplyMapping
  } = deps

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
    messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '', hasLoadedOnce: false }
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

export const createMessageCacheMutations = (deps: MessageMutationsDeps) => ({
  clearRedundantMessages: (roomId: string, limit?: number) => clearRedundantMessages(deps, roomId, limit)
})
