import type { SendMessagePayload } from '@/services/matrix/messaging/MatrixMessageService'

interface MatrixClientLike {
  sendEvent(roomId: string, eventType: string, content: Record<string, unknown>): Promise<{ event_id: string }>
}

interface ClientServiceDeps {
  getClient(): MatrixClientLike | null
}

interface MessageServiceDeps {
  sendStructuredMessage(payload: SendMessagePayload): Promise<{ event_id: string }>
  registerSentMessage(localEventId: string, remoteEventId: string): void
}

interface ReceiptServiceDeps {
  sendReadReceiptByEventId(roomId: string, eventId: string): Promise<string | undefined>
}

interface ReactionServiceDeps {
  addReaction(roomId: string, eventId: string, emoji: string): Promise<string>
}

interface RoomServiceDeps {
  joinRoom(roomId: string): Promise<unknown>
  leaveRoom(roomId: string): Promise<void>
  inviteUser(roomId: string, userId: string): Promise<void>
  kickUser(roomId: string, userId: string, reason?: string): Promise<void>
  banUser(roomId: string, userId: string, reason?: string): Promise<void>
  unbanUser(roomId: string, userId: string): Promise<void>
}

interface RoomCreationServiceDeps {
  createRoom(options: Record<string, unknown>): Promise<unknown>
}

interface RoomOperationsDeps {
  setRoomName(roomId: string, name: string): Promise<void>
  setRoomTopic(roomId: string, topic: string): Promise<void>
  setRoomAvatar(roomId: string, avatarUrl: string): Promise<void>
  setPushRule(roomId: string, enabled: boolean): Promise<void>
  createDirectRoom(userId: string): Promise<string>
  setTag(roomId: string, tag: string, order?: number): Promise<void>
  removeTag(roomId: string, tag: string): Promise<void>
  setPinnedEvents(roomId: string, eventIds: string[]): Promise<void>
  setStickyEvents(roomId: string, events: Record<string, unknown>): Promise<void>
}

export function useOfflineQueueReplay(deps: {
  getMatrixClientService: () => Promise<ClientServiceDeps>
  getMatrixMessageService: () => Promise<MessageServiceDeps>
  getMatrixReceiptService: () => Promise<ReceiptServiceDeps>
  getMatrixReactionService: () => Promise<ReactionServiceDeps>
  getMatrixRoomService: () => Promise<RoomServiceDeps>
  getMatrixRoomCreationService: () => Promise<RoomCreationServiceDeps>
  getRoomOperations: () => Promise<RoomOperationsDeps>
}) {
  const initOfflineQueue = async () => {
    const { offlineQueueService } = await import('@/services/offline/OfflineQueueService')
    offlineQueueService.setReplayFn(async (op) => {
      const clientService = await deps.getMatrixClientService()
      const messageService = await deps.getMatrixMessageService()
      const receiptService = await deps.getMatrixReceiptService()
      const reactionService = await deps.getMatrixReactionService()
      const roomService = await deps.getMatrixRoomService()
      const roomCreationService = await deps.getMatrixRoomCreationService()
      const roomOps = await deps.getRoomOperations()

      switch (op.type) {
        case 'message': {
          const payload = op.payload as Record<string, unknown>
          const localEventId = `local-${op.id}`
          if (payload.eventType && payload.content) {
            const { roomId, eventType, content } = payload as {
              roomId: string
              eventType: string
              content: Record<string, unknown>
            }
            const client = clientService.getClient()
            if (client) {
              const sendResult = await client.sendEvent(roomId, eventType, content)
              messageService.registerSentMessage(localEventId, sendResult.event_id)
            }
          } else {
            const structuredPayload = (payload.payload || payload) as SendMessagePayload
            const result = await messageService.sendStructuredMessage(structuredPayload)
            if (result?.event_id) {
              messageService.registerSentMessage(localEventId, result.event_id)
            }
          }
          break
        }
        case 'receipt': {
          const { roomId, eventId } = op.payload as { roomId: string; eventId: string }
          await receiptService.sendReadReceiptByEventId(roomId, eventId)
          break
        }
        case 'reaction': {
          const { roomId, eventId, emoji } = op.payload as { roomId: string; eventId: string; emoji: string }
          await reactionService.addReaction(roomId, eventId, emoji)
          break
        }
        case 'state': {
          const { roomId, type, content } = op.payload as {
            roomId: string
            type: 'name' | 'topic' | 'avatar'
            content: string
          }
          if (type === 'name') {
            await roomOps.setRoomName(roomId, content)
          } else if (type === 'topic') {
            await roomOps.setRoomTopic(roomId, content)
          } else if (type === 'avatar') {
            await roomOps.setRoomAvatar(roomId, content)
          }
          break
        }
        case 'redact': {
          const { roomId, reason } = op.payload as {
            roomId: string
            reason?: string
          }
          const client = clientService.getClient()
          if (client) {
            await client.sendEvent(roomId, 'm.room.redaction', { reason })
          }
          break
        }
        case 'push_rule': {
          const { roomId, enabled } = op.payload as { roomId: string; enabled: boolean }
          await roomOps.setPushRule(roomId, enabled)
          break
        }
        case 'membership': {
          const payload = op.payload as {
            roomId: string
            type: 'join' | 'leave' | 'invite' | 'kick' | 'ban' | 'unban'
            userId?: string
            reason?: string
          }
          if (payload.type === 'join') {
            await roomService.joinRoom(payload.roomId)
          } else if (payload.type === 'leave') {
            await roomService.leaveRoom(payload.roomId)
          } else if (payload.type === 'invite' && payload.userId) {
            await roomService.inviteUser(payload.roomId, payload.userId)
          } else if (payload.type === 'kick' && payload.userId) {
            await roomService.kickUser(payload.roomId, payload.userId, payload.reason)
          } else if (payload.type === 'ban' && payload.userId) {
            await roomService.banUser(payload.roomId, payload.userId, payload.reason)
          } else if (payload.type === 'unban' && payload.userId) {
            await roomService.unbanUser(payload.roomId, payload.userId)
          }
          break
        }
        case 'creation': {
          const { options } = op.payload as { options: Record<string, unknown> }
          await roomCreationService.createRoom(options)
          break
        }
        case 'dm_creation': {
          const { userId } = op.payload as { userId: string }
          await roomOps.createDirectRoom(userId)
          break
        }
        case 'tag': {
          const { roomId, tag, order, action } = op.payload as {
            roomId: string
            tag: string
            order?: number
            action: 'set' | 'remove'
          }
          if (action === 'set') {
            await roomOps.setTag(roomId, tag, order)
          } else {
            await roomOps.removeTag(roomId, tag)
          }
          break
        }
        case 'pin': {
          const payload = op.payload as {
            roomId: string
            type: 'pinned' | 'sticky'
            eventIds?: string[]
            events?: Record<string, unknown>
          }
          if (payload.type === 'pinned' && payload.eventIds) {
            await roomOps.setPinnedEvents(payload.roomId, payload.eventIds)
          } else if (payload.type === 'sticky' && payload.events) {
            await roomOps.setStickyEvents(payload.roomId, payload.events)
          }
          break
        }
      }
    })
    offlineQueueService.startNetworkListener()
  }

  return { initOfflineQueue }
}
