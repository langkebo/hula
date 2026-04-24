/**
 * 消息回复关系跟踪模块
 *
 * 管理消息间的引用回复关系映射，支持:
 * - 新增/删除/迁移回复引用
 * - 全量重建回复映射
 * - 查询某条消息的所有回复
 */
import { reactive } from 'vue'
import { getBodyReply } from '@/utils/messageBody'
import type { MessageType } from './types'

export function createReplyTracker() {
  const replyMapping = reactive<Record<string, Record<string, string[]>>>({})

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

  const rebuildReplyMapping = (roomId: string, messageMap: Record<string, MessageType>) => {
    const roomReplyMap: Record<string, string[]> = {}

    for (const sourceMsgId in messageMap) {
      const replyId = getBodyReply(messageMap[sourceMsgId].message.body)?.id
      if (!replyId) continue
      const currentReplyIds = roomReplyMap[replyId] ?? []
      if (!currentReplyIds.includes(sourceMsgId)) {
        roomReplyMap[replyId] = [...currentReplyIds, sourceMsgId]
      }
    }

    replyMapping[roomId] = roomReplyMap
  }

  const migrateReplyTargetReferences = (
    roomId: string,
    oldMsgId: string,
    newMsgId: string,
    messageMap: Record<string, MessageType>
  ) => {
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

    for (const sourceMsgId of mergedReplyIds) {
      const reply = getBodyReply(messageMap[sourceMsgId]?.message.body)
      if (reply && reply.id === oldMsgId) {
        reply.id = newMsgId
      }
    }
  }

  const getRoomReplyMap = (roomId: string): Record<string, string[]> => {
    if (!replyMapping[roomId]) {
      replyMapping[roomId] = {}
    }
    return replyMapping[roomId]
  }

  const clearRoomReplies = (roomId: string) => {
    replyMapping[roomId] = {}
  }

  return {
    replyMapping,
    removeReplyReferences,
    upsertReplyReference,
    syncReplyReference,
    rebuildReplyMapping,
    migrateReplyTargetReferences,
    getRoomReplyMap,
    clearRoomReplies
  }
}
