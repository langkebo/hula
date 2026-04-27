import { info, error } from '@tauri-apps/plugin-log'
import matrixClientService from '../MatrixClientService'

/**
 * Room lifecycle domain service.
 *
 * Covers server-domain probe, room upgrades, and the local
 * unread-counter placeholders (which just validate room existence
 * and log — the actual state lives in the sync service).
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomLifecycleService {
  private getClient(prefix = false) {
    const client = matrixClientService.getClient()
    if (!client) throw new Error(prefix ? '[MatrixRoom] 客户端未初始化' : '客户端未初始化')
    return client
  }

  async getServerDomain(): Promise<string> {
    try {
      const client = this.getClient(false)
      return client.getDomain() || 'matrix.org'
    } catch (err) {
      error(`[MatrixRoom] 获取服务器域名失败: ${err}`)
      throw err
    }
  }

  async upgradeRoom(roomId: string, newVersion: string): Promise<string> {
    const client = this.getClient(true)
    try {
      const result = await client.upgradeRoom(roomId, newVersion)
      info(`[MatrixRoom] 升级房间成功: ${roomId} -> ${result}`)
      return result
    } catch (err) {
      error(`[MatrixRoom] 升级房间失败: ${err}`)
      throw err
    }
  }

  async incrementUnread(roomId: string, highlight: boolean = false): Promise<void> {
    try {
      const client = this.getClient(false)
      const room = client.getRoom(roomId)
      if (!room) throw new Error(`房间不存在: ${roomId}`)
      info(`[MatrixRoom] 房间 ${roomId} 未读计数增加${highlight ? '（高亮）' : ''}`)
    } catch (err) {
      error(`[MatrixRoom] 增加未读计数失败: ${err}`)
    }
  }

  async clearUnread(roomId: string): Promise<void> {
    try {
      const client = this.getClient(false)
      const room = client.getRoom(roomId)
      if (!room) throw new Error(`房间不存在: ${roomId}`)
      info(`[MatrixRoom] 房间 ${roomId} 未读计数已清除`)
    } catch (err) {
      error(`[MatrixRoom] 清除未读计数失败: ${err}`)
    }
  }
}

export const matrixRoomLifecycleService = new MatrixRoomLifecycleService()
