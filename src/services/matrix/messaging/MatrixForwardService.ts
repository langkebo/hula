import { error, info } from '@tauri-apps/plugin-log'
import type { MatrixEvent } from 'matrix-js-sdk'
import { matrixEventService } from '../MatrixEventService'
import { matrixMessageService } from './MatrixMessageService'

export interface ForwardResult {
  roomId: string
  success: boolean
  eventId?: string
  error?: string
}

type EventContent = Record<string, unknown>

class MatrixForwardService {
  async forwardEvent(event: MatrixEvent, roomId: string): Promise<string> {
    const eventType = event.getType()
    const content = event.getContent() as EventContent

    return await matrixEventService.sendEvent(roomId, eventType, {
      ...content,
      'm.relates_to': {
        rel_type: 'm.reference',
        event_id: event.getId()
      }
    })
  }

  async forwardEventToMultipleRooms(event: MatrixEvent, roomIds: string[]): Promise<ForwardResult[]> {
    const results = await Promise.all(
      roomIds.map(async (roomId): Promise<ForwardResult> => {
        try {
          const eventId = await this.forwardEvent(event, roomId)
          info(`[MatrixForward] 转发成功: ${event.getId()} -> ${roomId}`)
          return {
            roomId,
            success: true,
            eventId
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : '转发失败'
          error(`[MatrixForward] 转发失败: ${event.getId()} -> ${roomId}, ${message}`)
          return {
            roomId,
            success: false,
            error: message
          }
        }
      })
    )

    return results
  }

  async forwardRoomMessages(
    sourceRoomId: string,
    eventIds: string[],
    targetRoomIds: string[]
  ): Promise<ForwardResult[]> {
    const results: ForwardResult[] = []

    for (const eventId of eventIds) {
      const event = await matrixMessageService.getRoomMessage(sourceRoomId, eventId)
      if (!event) {
        const message = `源消息不存在: ${eventId}`
        error(`[MatrixForward] ${message}, source=${sourceRoomId}`)
        results.push(
          ...targetRoomIds.map((roomId) => ({
            roomId,
            success: false,
            error: message
          }))
        )
        continue
      }

      const forwarded = await this.forwardEventToMultipleRooms(event, targetRoomIds)
      results.push(...forwarded)
    }

    return results
  }
}

export const matrixForwardService = new MatrixForwardService()

export default matrixForwardService
