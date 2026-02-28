import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export interface TypingUser {
  userId: string
  displayName?: string
  avatarUrl?: string
  lastTyped: number
}

class MatrixTypingService {
  private typingTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private readonly DEFAULT_TIMEOUT = 30000

  async sendTypingNotification(roomId: string, isTyping: boolean, timeout?: number): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixTyping] 客户端未初始化')
    }

    try {
      await client.sendTyping(roomId, isTyping, timeout || this.DEFAULT_TIMEOUT)
      info(`[MatrixTyping] 发送输入状态: ${roomId} -> ${isTyping ? 'typing' : 'stopped'}`)
    } catch (err) {
      error(`[MatrixTyping] 发送输入状态失败: ${err}`)
      throw err
    }
  }

  startTyping(roomId: string, timeout: number = this.DEFAULT_TIMEOUT): void {
    this.sendTypingNotification(roomId, true, timeout)

    if (this.typingTimeouts.has(roomId)) {
      clearTimeout(this.typingTimeouts.get(roomId)!)
    }

    const timeoutId = setTimeout(() => {
      this.stopTyping(roomId)
    }, timeout - 5000)

    this.typingTimeouts.set(roomId, timeoutId)
  }

  stopTyping(roomId: string): void {
    this.sendTypingNotification(roomId, false)

    if (this.typingTimeouts.has(roomId)) {
      clearTimeout(this.typingTimeouts.get(roomId)!)
      this.typingTimeouts.delete(roomId)
    }
  }

  getTypingUsers(roomId: string): TypingUser[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    const myUserId = client.getUserId()
    const typingUsers: TypingUser[] = []

    const typingState = (room as any).getLiveTimeline()?.getState?.('f')?.getStateEvents?.('m.typing')
    if (!typingState) return []

    const content = typingState.getContent()
    const userIds = content.user_ids || []

    for (const userId of userIds) {
      if (userId === myUserId) continue

      const member = room.getMember(userId)
      typingUsers.push({
        userId,
        displayName: member?.name || userId,
        avatarUrl: member?.getMxcAvatarUrl?.(),
        lastTyped: Date.now()
      })
    }

    return typingUsers
  }

  getTypingUsersText(roomId: string, maxDisplay: number = 3): string {
    const typingUsers = this.getTypingUsers(roomId)
    if (typingUsers.length === 0) return ''

    const displayNames = typingUsers.slice(0, maxDisplay).map((u) => u.displayName || u.userId)

    if (typingUsers.length === 1) {
      return `${displayNames[0]} 正在输入...`
    } else if (typingUsers.length === 2) {
      return `${displayNames[0]} 和 ${displayNames[1]} 正在输入...`
    } else if (typingUsers.length <= maxDisplay) {
      const last = displayNames.pop()
      return `${displayNames.join('、')} 和 ${last} 正在输入...`
    } else {
      return `${displayNames.join('、')} 和其他 ${typingUsers.length - maxDisplay} 人正在输入...`
    }
  }

  isUserTyping(roomId: string, userId: string): boolean {
    const typingUsers = this.getTypingUsers(roomId)
    return typingUsers.some((u) => u.userId === userId)
  }

  cleanup(): void {
    for (const [roomId, timeoutId] of this.typingTimeouts) {
      clearTimeout(timeoutId)
      this.stopTyping(roomId)
    }
    this.typingTimeouts.clear()
  }
}

export const matrixTypingService = new MatrixTypingService()
export default matrixTypingService
