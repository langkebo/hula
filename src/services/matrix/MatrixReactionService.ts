import type { MatrixEvent } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export interface ReactionInfo {
  key: string
  count: number
  me: boolean
  users: string[]
}

class MatrixReactionService {
  async addReaction(roomId: string, eventId: string, emoji: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixReaction] 客户端未初始化')
    }

    try {
      const content = {
        'm.relates_to': {
          rel_type: 'm.annotation',
          event_id: eventId,
          key: emoji
        }
      }

      const response = await client.sendEvent(roomId, 'm.reaction' as any, content)
      info(`[MatrixReaction] 添加反应成功: ${eventId} -> ${emoji}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixReaction] 添加反应失败: ${err}`)
      throw err
    }
  }

  async removeReaction(roomId: string, reactionEventId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixReaction] 客户端未初始化')
    }

    try {
      await client.redactEvent(roomId, reactionEventId, undefined as any, {} as any)
      info(`[MatrixReaction] 移除反应成功: ${reactionEventId}`)
    } catch (err) {
      error(`[MatrixReaction] 移除反应失败: ${err}`)
      throw err
    }
  }

  async toggleReaction(roomId: string, eventId: string, emoji: string): Promise<{ added: boolean; eventId?: string }> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixReaction] 客户端未初始化')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`[MatrixReaction] 房间不存在: ${roomId}`)
      }

      const myUserId = client.getUserId()
      if (!myUserId) {
        throw new Error('[MatrixReaction] 用户ID不存在')
      }

      const existingReaction = this.findUserReaction(roomId, eventId, emoji, myUserId)

      if (existingReaction) {
        await this.removeReaction(roomId, existingReaction.getId()!)
        return { added: false }
      } else {
        const newEventId = await this.addReaction(roomId, eventId, emoji)
        return { added: true, eventId: newEventId }
      }
    } catch (err) {
      error(`[MatrixReaction] 切换反应失败: ${err}`)
      throw err
    }
  }

  findUserReaction(roomId: string, eventId: string, emoji: string, userId: string): MatrixEvent | null {
    const client = matrixClientService.getClient()
    if (!client) return null

    const room = client.getRoom(roomId)
    if (!room) return null

    const timelineSet = room.getUnfilteredTimelineSet()
    const events = timelineSet.getLiveTimeline().getEvents()

    for (const event of events) {
      if (event.getType() === 'm.reaction') {
        const content = event.getContent()
        const relatesTo = content['m.relates_to']
        if (relatesTo?.rel_type === 'm.annotation' && 
            relatesTo.event_id === eventId && 
            relatesTo.key === emoji &&
            event.getSender() === userId) {
          return event
        }
      }
    }

    return null
  }

  getReactionsForEvent(roomId: string, eventId: string): ReactionInfo[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    const myUserId = client.getUserId()
    const reactionMap = new Map<string, { count: number; users: string[] }>()

    const timelineSet = room.getUnfilteredTimelineSet()
    const events = timelineSet.getLiveTimeline().getEvents()

    for (const event of events) {
      if (event.getType() === 'm.reaction') {
        const content = event.getContent()
        const relatesTo = content['m.relates_to']
        if (relatesTo?.rel_type === 'm.annotation' && relatesTo.event_id === eventId) {
          const key = relatesTo.key
          if (!key) continue
          
          const sender = event.getSender()
          
          if (!reactionMap.has(key)) {
            reactionMap.set(key, { count: 0, users: [] })
          }
          
          const info = reactionMap.get(key)!
          info.count++
          if (sender) {
            info.users.push(sender)
          }
        }
      }
    }

    const reactions: ReactionInfo[] = []
    reactionMap.forEach((value, key) => {
      reactions.push({
        key,
        count: value.count,
        me: myUserId ? value.users.includes(myUserId) : false,
        users: value.users
      })
    })

    return reactions.sort((a, b) => b.count - a.count)
  }

  async getReactionEvents(roomId: string, eventId: string): Promise<MatrixEvent[]> {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    const reactions: MatrixEvent[] = []
    const timelineSet = room.getUnfilteredTimelineSet()
    const events = timelineSet.getLiveTimeline().getEvents()

    for (const event of events) {
      if (event.getType() === 'm.reaction') {
        const content = event.getContent()
        const relatesTo = content['m.relates_to']
        if (relatesTo?.rel_type === 'm.annotation' && relatesTo.event_id === eventId) {
          reactions.push(event)
        }
      }
    }

    return reactions
  }
}

export const matrixReactionService = new MatrixReactionService()
export default matrixReactionService
