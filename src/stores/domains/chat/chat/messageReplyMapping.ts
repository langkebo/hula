import { getBodyReply } from '@/utils/messageBody'
import type { MessageType } from './types'

/**
 * 维护房间内 "回复指向" 关系：
 * `replyMapping[roomId][targetMsgId]` = 引用了 `targetMsgId` 的消息 id 列表。
 */
export const createMessageReplyMapping = (
  replyMapping: Record<string, Record<string, string[]>>,
  messageMap: Record<string, Record<string, MessageType>>
) => {
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

  return {
    removeReplyReferences,
    upsertReplyReference,
    syncReplyReference,
    rebuildReplyMapping,
    migrateReplyTargetReferences
  }
}
