import { MessageStatusEnum } from '@/enums'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import type { MessageType } from '@/stores/domains/chat/chat'

/** 判断消息是否仍在离线队列中（tempMsgId 或服务层兜底的 local-<queueId> 关联） */
const isQueuedLocalMessage = (msgId: string): boolean => {
  return offlineQueueService.getQueue().some((op) => {
    if (op.type !== 'message') return false
    return op.payload.tempMsgId === msgId || `local-${op.id}` === msgId
  })
}

/**
 * 本地未发送或发送失败的消息。
 * 这类消息没有服务端事件，只能本地删除；走撤回会抛
 * "Cannot recall a message that has not been sent yet"。
 */
export const isLocalOrFailedMessage = (item: Pick<MessageType, 'message'>): boolean => {
  const { id, status } = item.message
  if (status === MessageStatusEnum.FAILED) return true
  if (matrixMessageService.isLocalEventId(id)) return true
  if (matrixMessageService.getRemoteEventId(id)) return false
  return isQueuedLocalMessage(id)
}

/** 本地移除失败/未发送消息，并清掉对应的离线队列项（不触发服务端撤回） */
export const deleteLocalMessage = (item: Pick<MessageType, 'message'>, deleteMsg: (msgId: string) => void): void => {
  const msgId = item.message.id
  for (const op of offlineQueueService.getQueue()) {
    if (op.type !== 'message') continue
    if (op.payload.tempMsgId === msgId || `local-${op.id}` === msgId) {
      offlineQueueService.removeOperation(op.id)
    }
  }
  deleteMsg(msgId)
}
