import { matrixClientService } from './MatrixClientService'
import { matrixDirectMessageService } from './MatrixDirectMessageService'
import { BaseManager } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'

class MatrixUserService extends BaseManager {
  async setUserRemark(userId: string, remark: string, throwOnError = true): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const roomId = await this.getDirectRoomWithUser(userId)
      if (!roomId) {
        throw new Error('No direct room found with user')
      }

      await client.setRoomAccountData(roomId, 'm.room.member', {
        displayname: remark
      })

      info(`[MatrixUser] Set remark for user ${userId}: ${remark}`)
    } catch (error) {
      this.handleError(error, 'setUserRemark', undefined, throwOnError)
    }
  }

  private async getDirectRoomWithUser(userId: string): Promise<string | null> {
    return matrixDirectMessageService.getDmForUser(userId)
  }

  async getUser(
    userId: string,
    throwOnError = true
  ): Promise<{ userId: string; displayName?: string; avatarUrl?: string } | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const user = client.getUser(userId)
      if (user) {
        return {
          userId: user.userId,
          displayName: user.displayName || undefined,
          avatarUrl: user.avatarUrl || undefined
        }
      }

      const profile = await client.getUserProfile(userId)
      return {
        userId,
        displayName: profile.displayname || undefined,
        avatarUrl: profile.avatar_url || undefined
      }
    } catch (error) {
      return this.handleError(error, 'getUser', null, throwOnError)
    }
  }
}

export const matrixUserService = new MatrixUserService()
