import { error, info } from '@tauri-apps/plugin-log'
import type { MatrixClient, TypingManager } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'

const logger = createLogger('MatrixTypingService')

export interface TypingUser {
  userId: string
  displayName?: string
  avatarUrl?: string
  lastTyped: number
}

export interface BatchTypingResult {
  [roomId: string]: TypingUser[]
}

class MatrixTypingService extends BaseMatrixService {
  private cachedClient: MatrixClient | null = null
  private cachedManager: TypingManager | null = null
  private activeTypingRooms = new Set<string>()
  private readonly DEFAULT_TIMEOUT = 30000

  private getTypingManager(): TypingManager {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    if (this.cachedClient !== client || !this.cachedManager) {
      this.cachedClient = client
      this.cachedManager = client.getTypingManager()
    }

    return this.cachedManager
  }

  async sendTypingNotification(roomId: string, isTyping: boolean, timeout?: number): Promise<void> {
    try {
      const manager = this.getTypingManager()
      if (isTyping) {
        await manager.startTyping(roomId, { timeout: timeout || this.DEFAULT_TIMEOUT })
        this.activeTypingRooms.add(roomId)
      } else {
        await manager.stopTyping(roomId)
        this.activeTypingRooms.delete(roomId)
      }

      info(`[MatrixTyping] 发送输入状态: ${roomId} -> ${isTyping ? 'typing' : 'stopped'}`)
    } catch (err) {
      error(`[MatrixTyping] 发送输入状态失败: ${err}`)
      throw err
    }
  }

  startTyping(roomId: string, timeout: number = this.DEFAULT_TIMEOUT): void {
    void this.sendTypingNotification(roomId, true, timeout)
  }

  stopTyping(roomId: string): void {
    this.sendTypingNotification(roomId, false).catch((err) => {
      logger.warn('Stop typing notification failed:', err)
    })
  }

  getTypingUsers(roomId: string): TypingUser[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const room = client.getRoom(roomId)
    if (!room) return []

    const myUserId = client.getUserId()
    const typingUsers: TypingUser[] = []

    try {
      const userIds = room.getTypingUsers()

      for (const userId of userIds) {
        if (userId === myUserId) continue

        const member = room.getMember(userId)
        typingUsers.push({
          userId,
          displayName: member?.name || userId,
          avatarUrl: member?.getMxcAvatarUrl() || undefined,
          lastTyped: Date.now()
        })
      }
    } catch (e) {
      error(`[MatrixTyping] 获取输入用户失败: ${e}`)
    }

    return typingUsers
  }

  getBatchTyping(roomIds: string[]): BatchTypingResult {
    const result: BatchTypingResult = {}
    for (const roomId of roomIds) {
      const users = this.getTypingUsers(roomId)
      if (users.length > 0) {
        result[roomId] = users
      }
    }
    return result
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
      const last = displayNames.pop()!
      return `${displayNames.join('、')} 和 ${last} 正在输入...`
    } else {
      return `${displayNames.join('、')} 和其他 ${typingUsers.length - maxDisplay} 人正在输入...`
    }
  }

  isUserTyping(roomId: string, userId: string): boolean {
    const typingUsers = this.getTypingUsers(roomId)
    return typingUsers.some((u) => u.userId === userId)
  }

  isRoomTyping(roomId: string): boolean {
    return this.getTypingUsers(roomId).length > 0
  }

  cleanup(): void {
    const manager = this.cachedManager
    const roomIds = [...this.activeTypingRooms]
    this.activeTypingRooms.clear()

    manager?.clearAllTimers()

    for (const roomId of roomIds) {
      void Promise.resolve(manager?.stopTyping(roomId)).catch((err) => {
        logger.warn('Stop typing via manager failed:', err)
      })
    }
  }
}

export const matrixTypingService = new MatrixTypingService()
export default matrixTypingService
