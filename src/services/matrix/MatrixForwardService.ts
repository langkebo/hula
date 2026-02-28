import type { MatrixEvent } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export interface ForwardTarget {
  roomId: string
  roomName?: string
}

export interface ForwardResult {
  roomId: string
  success: boolean
  eventId?: string
  error?: string
}

class MatrixForwardService {
  async forwardEvent(event: MatrixEvent, targetRoomId: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixForward] 客户端未初始化')
    }

    try {
      const content = event.getContent()
      const eventType = event.getType()

      const forwardContent = {
        ...content,
        'm.relates_to': {
          'm.in_reply_to': {
            event_id: event.getId()
          }
        }
      }

      const response = await client.sendEvent(targetRoomId, eventType as any, forwardContent)
      info(`[MatrixForward] 转发消息成功: ${event.getId()} -> ${targetRoomId}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixForward] 转发消息失败: ${err}`)
      throw err
    }
  }

  async forwardEventToMultipleRooms(event: MatrixEvent, targetRoomIds: string[]): Promise<ForwardResult[]> {
    const results: ForwardResult[] = []

    for (const roomId of targetRoomIds) {
      try {
        const eventId = await this.forwardEvent(event, roomId)
        results.push({
          roomId,
          success: true,
          eventId
        })
      } catch (err) {
        results.push({
          roomId,
          success: false,
          error: String(err)
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    info(`[MatrixForward] 批量转发完成: ${successCount}/${targetRoomIds.length} 成功`)

    return results
  }

  async forwardTextMessage(text: string, targetRoomId: string, html?: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixForward] 客户端未初始化')
    }

    try {
      const content: any = {
        msgtype: 'm.text',
        body: text
      }

      if (html) {
        content.format = 'org.matrix.custom.html'
        content.formatted_body = html
      }

      const response = await client.sendEvent(targetRoomId, 'm.room.message' as any, content)
      info(`[MatrixForward] 转发文本消息成功: ${targetRoomId}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixForward] 转发文本消息失败: ${err}`)
      throw err
    }
  }

  async forwardMediaMessage(sourceEvent: MatrixEvent, targetRoomId: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixForward] 客户端未初始化')
    }

    try {
      const content = sourceEvent.getContent()

      const forwardContent = {
        ...content,
        'm.relates_to': undefined
      }

      const response = await client.sendEvent(targetRoomId, 'm.room.message' as any, forwardContent)
      info(`[MatrixForward] 转发媒体消息成功: ${sourceEvent.getId()} -> ${targetRoomId}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixForward] 转发媒体消息失败: ${err}`)
      throw err
    }
  }

  getForwardableRooms(): ForwardTarget[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const rooms = client.getRooms()
    const myUserId = client.getUserId()

    return rooms
      .filter((room) => {
        const member = room.getMember(myUserId || '')
        return member?.membership === 'join'
      })
      .map((room) => ({
        roomId: room.roomId,
        roomName: room.name || room.roomId
      }))
      .sort((a, b) => (a.roomName || '').localeCompare(b.roomName || ''))
  }

  getRecentRooms(limit: number = 10): ForwardTarget[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const rooms = client.getRooms()
    const myUserId = client.getUserId()

    return rooms
      .filter((room) => {
        const member = room.getMember(myUserId || '')
        return member?.membership === 'join'
      })
      .sort((a, b) => {
        const aLastMessage = a.getLastActiveTimestamp()
        const bLastMessage = b.getLastActiveTimestamp()
        return bLastMessage - aLastMessage
      })
      .slice(0, limit)
      .map((room) => ({
        roomId: room.roomId,
        roomName: room.name || room.roomId
      }))
  }

  searchRooms(query: string): ForwardTarget[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const rooms = client.getRooms()
    const myUserId = client.getUserId()
    const lowerQuery = query.toLowerCase()

    return rooms
      .filter((room) => {
        const member = room.getMember(myUserId || '')
        if (member?.membership !== 'join') return false

        const roomName = room.name?.toLowerCase() || ''
        const roomId = room.roomId.toLowerCase()

        return roomName.includes(lowerQuery) || roomId.includes(lowerQuery)
      })
      .map((room) => ({
        roomId: room.roomId,
        roomName: room.name || room.roomId
      }))
      .sort((a, b) => (a.roomName || '').localeCompare(b.roomName || ''))
  }
}

export const matrixForwardService = new MatrixForwardService()
export default matrixForwardService
