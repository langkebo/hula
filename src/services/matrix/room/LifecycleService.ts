import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'

const logger = createLogger('LifecycleService')

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
      await matrixClientService.waitForClientReady({ timeoutMs: 10000 })
      const client = this.getClient(false)
      const domain = client.getDomain()
      if (domain) return domain

      const baseUrl = (client as unknown as { baseUrl?: string }).baseUrl
      if (baseUrl) {
        try {
          const url = new URL(baseUrl)
          const hostname = url.hostname
          if (hostname && hostname !== '0.0.0.0' && hostname !== '::') {
            logger.info(`[MatrixRoom] getDomain() 返回空，从 baseUrl 提取域名: ${hostname}`)
            return hostname
          }
        } catch (err) {
          logger.warn('URL parsing failed:', err)
        }
      }

      // 允许回退到默认值以保证基本运行
      logger.warn('[MatrixRoom] 无法确定服务器域名，回退到默认值 matrix.org')
      return 'matrix.org'
    } catch (err) {
      logger.error(`[MatrixRoom] 获取服务器域名失败: ${err}`)
      throw err
    }
  }

  async upgradeRoom(roomId: string, newVersion: string): Promise<string> {
    const client = this.getClient(true)
    try {
      const result = await client.upgradeRoom(roomId, newVersion)
      logger.info(`[MatrixRoom] 升级房间成功: ${roomId} -> ${result}`)
      return result
    } catch (err) {
      logger.error(`[MatrixRoom] 升级房间失败: ${err}`)
      throw err
    }
  }

  async incrementUnread(roomId: string, highlight: boolean = false): Promise<void> {
    try {
      const client = this.getClient(false)
      const room = client.getRoom(roomId)
      if (!room) throw new Error(`房间不存在: ${roomId}`)
      logger.info(`[MatrixRoom] 房间 ${roomId} 未读计数增加${highlight ? '（高亮）' : ''}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 增加未读计数失败: ${err}`)
    }
  }

  async clearUnread(roomId: string): Promise<void> {
    try {
      const client = this.getClient(false)
      const room = client.getRoom(roomId)
      if (!room) throw new Error(`房间不存在: ${roomId}`)
      logger.info(`[MatrixRoom] 房间 ${roomId} 未读计数已清除`)
    } catch (err) {
      logger.error(`[MatrixRoom] 清除未读计数失败: ${err}`)
    }
  }
}

export const matrixRoomLifecycleService = new MatrixRoomLifecycleService()
