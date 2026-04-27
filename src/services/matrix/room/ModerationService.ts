import { info, error } from '@tauri-apps/plugin-log'
import matrixClientService from '../MatrixClientService'

/**
 * Room invite moderation domain service.
 *
 * Per-room blocklist/allowlist for invites. Synapse-rust extension
 * exposed under `/_matrix/client/v3/rooms/{roomId}/invite_{blocklist,allowlist}`.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomModerationService {
  private getClient() {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('[MatrixRoom] 客户端未初始化')
    return client
  }

  async getInviteBlocklist(roomId: string): Promise<string[]> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite_blocklist`
      )
      return (result as { blocked?: string[] }).blocked ?? []
    } catch (err) {
      error(`[MatrixRoom] 获取邀请黑名单失败: ${err}`)
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
      info(`[MatrixRoom] 设置邀请黑名单成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 设置邀请黑名单失败: ${err}`)
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
      error(`[MatrixRoom] 获取邀请白名单失败: ${err}`)
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
      info(`[MatrixRoom] 设置邀请白名单成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 设置邀请白名单失败: ${err}`)
      throw err
    }
  }
}

export const matrixRoomModerationService = new MatrixRoomModerationService()
