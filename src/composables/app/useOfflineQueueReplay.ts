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
  removeReaction(roomId: string, reactionEventId: string): Promise<void>
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

interface FriendServiceDeps {
  acceptFriendRequest(userId: string): Promise<void>
  rejectFriendRequest(userId: string): Promise<void>
  cancelFriendRequest(userId: string): Promise<void>
}

interface BurnAfterReadServiceDeps {
  enableBurn(roomId: string, burnAfterMs?: number): Promise<unknown>
  disableBurn(roomId: string): Promise<unknown>
}

interface WidgetServiceDeps {
  createWidget(
    roomId: string,
    body: { widgetType: string; url: string; name: string; data?: Record<string, unknown> }
  ): Promise<unknown>
  deleteWidget(widgetId: string): Promise<unknown>
}

export function useOfflineQueueReplay(deps: {
  getMatrixClientService: () => Promise<ClientServiceDeps>
  getMatrixMessageService: () => Promise<MessageServiceDeps>
  getMatrixReceiptService: () => Promise<ReceiptServiceDeps>
  getMatrixReactionService: () => Promise<ReactionServiceDeps>
  getMatrixRoomService: () => Promise<RoomServiceDeps>
  getMatrixRoomCreationService: () => Promise<RoomCreationServiceDeps>
  getRoomOperations: () => Promise<RoomOperationsDeps>
  getMatrixFriendService?: () => Promise<FriendServiceDeps>
  getMatrixBurnAfterReadService?: () => Promise<BurnAfterReadServiceDeps>
  getMatrixWidgetService?: () => Promise<WidgetServiceDeps>
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
      const friendService = deps.getMatrixFriendService ? await deps.getMatrixFriendService() : null
      const burnService = deps.getMatrixBurnAfterReadService ? await deps.getMatrixBurnAfterReadService() : null
      const widgetService = deps.getMatrixWidgetService ? await deps.getMatrixWidgetService() : null

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
        case 'reaction_remove': {
          const { roomId, reactionEventId } = op.payload as { roomId: string; reactionEventId: string }
          await reactionService.removeReaction(roomId, reactionEventId)
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
        case 'friend_accept': {
          const { userId } = op.payload as { userId: string }
          if (friendService) {
            await friendService.acceptFriendRequest(userId)
          }
          break
        }
        case 'friend_reject': {
          const { userId } = op.payload as { userId: string }
          if (friendService) {
            await friendService.rejectFriendRequest(userId)
          }
          break
        }
        case 'friend_cancel': {
          const { userId } = op.payload as { userId: string }
          if (friendService) {
            await friendService.cancelFriendRequest(userId)
          }
          break
        }
        case 'burn_enable': {
          const { roomId, burnAfterMs } = op.payload as { roomId: string; burnAfterMs?: number }
          if (burnService) {
            await burnService.enableBurn(roomId, burnAfterMs)
          }
          break
        }
        case 'burn_disable': {
          const { roomId } = op.payload as { roomId: string }
          if (burnService) {
            await burnService.disableBurn(roomId)
          }
          break
        }
        case 'widget_create': {
          const { roomId, widgetType, url, name, data } = op.payload as {
            roomId: string
            widgetType: string
            url: string
            name: string
            data?: Record<string, unknown>
          }
          if (widgetService) {
            await widgetService.createWidget(roomId, { widgetType, url, name, data })
          }
          break
        }
        case 'widget_delete': {
          const { widgetId } = op.payload as { widgetId: string }
          if (widgetService) {
            await widgetService.deleteWidget(widgetId)
          }
          break
        }
      }
    })
    offlineQueueService.startNetworkListener()
  }

  return { initOfflineQueue }
}
