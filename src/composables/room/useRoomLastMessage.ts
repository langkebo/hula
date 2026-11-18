import { ref } from 'vue'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import type { MatrixRoomMember } from '@/stores/domains/chat/group/types'
import { unknownToObject } from '@/utils/typeGuard'

interface MatrixTimelineEvent {
  getType?: () => string
  type?: string
  getContent?: () => Record<string, unknown> | undefined
  content?: Record<string, unknown>
  getSender?: () => string | null
  sender?: string
  getTs?: () => number | null
  origin_server_ts?: number
}

/**
 * 从房间 live timeline 反向解析最近一条消息（正文 / 发送者显示名 / 时间戳）。
 * 抽取自 RoomDetailDrawer，保持原有「读不到房间时保留上次结果、异常时清空」的行为。
 */
export function useRoomLastMessage(options: { roomId: () => string | null; members: () => MatrixRoomMember[] }) {
  const lastMessage = ref<string | null>(null)
  const lastMessageSender = ref<string | null>(null)
  const lastMessageTime = ref<number | null>(null)

  const reset = () => {
    lastMessage.value = null
    lastMessageSender.value = null
    lastMessageTime.value = null
  }

  const resolveSenderName = (senderId: string | null): string | null => {
    if (!senderId) return null
    const member = options.members().find((m) => m.userId === senderId)
    return member?.displayName || member?.name || senderId
  }

  const resolveLastMessage = () => {
    const roomId = options.roomId()
    if (!roomId) {
      reset()
      return
    }
    try {
      const room = matrixClientService.getRoom(roomId)
      if (!room) return
      const timeline = unknownToObject<{
        getLiveTimeline?: () => { getEvents?: () => MatrixTimelineEvent[] }
      }>(room)?.getLiveTimeline?.()
      const events = timeline?.getEvents?.() ?? []
      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i]
        const eventType = event.getType?.() ?? event.type
        if (eventType !== 'm.room.message' && eventType !== 'm.room.encrypted') continue
        const content = event.getContent?.() ?? event.content
        const body = (content?.body as string) ?? null
        const sender = event.getSender?.() ?? event.sender ?? null
        const ts = event.getTs?.() ?? event.origin_server_ts ?? null
        lastMessage.value = body
        lastMessageSender.value = resolveSenderName(sender)
        lastMessageTime.value = ts ?? null
        return
      }
      reset()
    } catch {
      reset()
    }
  }

  return {
    lastMessage,
    lastMessageSender,
    lastMessageTime,
    resolveLastMessage,
    resetLastMessage: reset
  }
}
