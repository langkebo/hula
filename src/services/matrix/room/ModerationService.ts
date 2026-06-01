import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('ModerationService')

/**
 * Room invite moderation domain service.
 *
 * Per-room blocklist/allowlist for invites. Synapse-rust extension
 * exposed under `/_matrix/client/v3/rooms/{roomId}/invite_{blocklist,allowlist}`.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomModerationService extends BaseMatrixService {
  async getInviteBlocklist(roomId: string): Promise<string[]> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite_blocklist`
      )
      return (result as { blocked?: string[] }).blocked ?? []
    } catch (err) {
      logger.error(`[MatrixRoom] 获取邀请黑名单失败: ${err}`)
      return []
    }
  }

  async setInviteBlocklist(roomId: string, blocked: string[]): Promise<void> {
    const client = this.getClient()
    try {
      await client.http.authedRequest(
        'POST',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite_blocklist`,
        undefined,
        { blocked }
      )
      logger.info(`[MatrixRoom] 设置邀请黑名单成功: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 设置邀请黑名单失败: ${err}`)
      throw err
    }
  }

  async getInviteAllowlist(roomId: string): Promise<string[]> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite_allowlist`
      )
      return (result as { allowed?: string[] }).allowed ?? []
    } catch (err) {
      logger.error(`[MatrixRoom] 获取邀请白名单失败: ${err}`)
      return []
    }
  }

  async setInviteAllowlist(roomId: string, allowed: string[]): Promise<void> {
    const client = this.getClient()
    try {
      await client.http.authedRequest(
        'POST',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite_allowlist`,
        undefined,
        { allowed }
      )
      logger.info(`[MatrixRoom] 设置邀请白名单成功: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 设置邀请白名单失败: ${err}`)
      throw err
    }
  }
}

export const matrixRoomModerationService = new MatrixRoomModerationService()
