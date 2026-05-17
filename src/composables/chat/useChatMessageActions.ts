import type { ISendEventResponse, MatrixEvent } from 'matrix-js-sdk'
import type { ForwardResult } from '@/services/matrix/messaging/MatrixForwardService'
import { matrixForwardService } from '@/services/matrix/messaging/MatrixForwardService'
import { matrixMessageService, type SendMessagePayload } from '@/services/matrix/messaging/MatrixMessageService'
import { type OperationType, offlineQueueService } from '@/services/offline/OfflineQueueService'

export type { ForwardResult, SendMessagePayload }

export function useChatMessageActions() {
  const recallMessage = (roomId: string, eventId: string, txId?: string) => {
    return matrixMessageService.recallMessage(roomId, eventId, txId)
  }

  const editMessage = (roomId: string, eventId: string, newContent: string) => {
    return matrixMessageService.editMessage(roomId, eventId, newContent)
  }

  const getRoomMessage = (roomId: string, eventId: string): Promise<MatrixEvent | null> => {
    return matrixMessageService.getRoomMessage(roomId, eventId)
  }

  const sendStructuredMessage = (payload: SendMessagePayload): Promise<ISendEventResponse> => {
    return matrixMessageService.sendStructuredMessage(payload)
  }

  const sendTextMessage = (roomId: string, content: string, txId?: string): Promise<ISendEventResponse> => {
    return matrixMessageService.sendTextMessage(roomId, content, txId)
  }

  const sendHtmlMessage = (roomId: string, body: string, html: string, txId?: string): Promise<ISendEventResponse> => {
    return matrixMessageService.sendHtmlMessage(roomId, body, html, txId)
  }

  const addReaction = (roomId: string, eventId: string, reaction: string) => {
    return matrixMessageService.addReaction(roomId, eventId, reaction)
  }

  const removeReaction = (roomId: string, eventId: string, reaction: string, reactionEventId: string) => {
    return matrixMessageService.removeReaction(roomId, eventId, reaction, reactionEventId)
  }

  const forwardEvent = (event: MatrixEvent, targetRoomId: string): Promise<string> => {
    return matrixForwardService.forwardEvent(event, targetRoomId)
  }

  const forwardEventToMultipleRooms = (event: MatrixEvent, roomIds: string[]): Promise<ForwardResult[]> => {
    return matrixForwardService.forwardEventToMultipleRooms(event, roomIds)
  }

  const forwardRoomMessages = (
    sourceRoomId: string,
    eventIds: string[],
    targetRoomIds: string[]
  ): Promise<ForwardResult[]> => {
    return matrixForwardService.forwardRoomMessages(sourceRoomId, eventIds, targetRoomIds)
  }

  const enqueueOfflineMessage = (type: OperationType, roomId: string, content: Record<string, unknown>) => {
    return offlineQueueService.enqueue(type, roomId, content)
  }

  return {
    recallMessage,
    editMessage,
    getRoomMessage,
    sendStructuredMessage,
    sendTextMessage,
    sendHtmlMessage,
    addReaction,
    removeReaction,
    forwardEvent,
    forwardEventToMultipleRooms,
    forwardRoomMessages,
    enqueueOfflineMessage
  }
}
