import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '../MatrixClientService'
import { matrixCryptoService } from './MatrixCryptoService'
import { matrixKeyBackupService } from './MatrixKeyBackupService'

const logger = createLogger('CryptoHealthMonitor')

export interface CryptoHealthStatus {
  hasUnverifiedDevices: boolean
  isKeyBackupSynced: boolean
  undecryptableMessageCount: number
  crossSigningReady: boolean
  lastCheckTime: number
}

export interface CryptoHealthCallbacks {
  onHealthStatusChange?: (status: CryptoHealthStatus) => void
  onKeyRequestTriggered?: (roomId: string, sessionId: string) => void
  onBackupNeeded?: () => void
}

const CHECK_INTERVAL_MS = 5 * 60 * 1000

export class CryptoHealthMonitor {
  private status: CryptoHealthStatus = {
    hasUnverifiedDevices: false,
    isKeyBackupSynced: true,
    undecryptableMessageCount: 0,
    crossSigningReady: false,
    lastCheckTime: 0
  }
  private callbacks: CryptoHealthCallbacks = {}
  private checkTimer: ReturnType<typeof setInterval> | null = null
  private running = false

  registerCallbacks(callbacks: CryptoHealthCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  getStatus(): CryptoHealthStatus {
    return { ...this.status }
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.performCheck()
    this.checkTimer = setInterval(() => this.performCheck(), CHECK_INTERVAL_MS)
    logger.info('加密健康监控已启动')
  }

  stop(): void {
    this.running = false
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
    logger.info('加密健康监控已停止')
  }

  async performCheck(): Promise<CryptoHealthStatus> {
    const client = matrixClientService.getClient()
    if (!client) {
      return this.status
    }

    try {
      const [unverified, backupSynced, crossSigning, undecryptable] = await Promise.allSettled([
        this.checkUnverifiedDevices(),
        this.checkKeyBackupSync(),
        this.checkCrossSigningReady(),
        this.countUndecryptableMessages()
      ])

      const prevStatus = { ...this.status }

      this.status = {
        hasUnverifiedDevices: unverified.status === 'fulfilled' ? unverified.value : false,
        isKeyBackupSynced: backupSynced.status === 'fulfilled' ? backupSynced.value : true,
        crossSigningReady: crossSigning.status === 'fulfilled' ? crossSigning.value : false,
        undecryptableMessageCount: undecryptable.status === 'fulfilled' ? undecryptable.value : 0,
        lastCheckTime: Date.now()
      }

      if (JSON.stringify(prevStatus) !== JSON.stringify(this.status)) {
        this.callbacks.onHealthStatusChange?.(this.status)
      }

      if (!this.status.isKeyBackupSynced) {
        this.callbacks.onBackupNeeded?.()
      }

      if (this.status.undecryptableMessageCount > 0) {
        await this.triggerKeyRequests()
      }

      // 健康检查完成不输出日志，避免定时刷屏
    } catch (err) {
      logger.error('加密健康检查失败:', err)
    }

    return this.status
  }

  private async checkUnverifiedDevices(): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return false
      const userId = (client as unknown as { getUserId?: () => string }).getUserId?.()
      if (!userId) return false
      const devices = await matrixCryptoService.getDevices(userId)
      if (!Array.isArray(devices)) return false
      return devices.some((d) => !d.isVerified)
    } catch (err) {
      // R-01: 未验证设备检查失败不应静默，记录日志便于排查鉴权/网络问题
      logger.error('checkUnverifiedDevices 失败:', err)
      return false
    }
  }

  private async checkKeyBackupSync(): Promise<boolean> {
    try {
      const versions = await matrixKeyBackupService.getBackupVersions()
      if (!versions || (Array.isArray(versions) && versions.length === 0)) {
        return false
      }
      return true
    } catch (err) {
      // R-02: 备份检查失败不能误报 true（"已同步"），否则会掩盖真实的备份缺失风险
      logger.error('checkKeyBackupSync 失败，降级为未同步:', err)
      return false
    }
  }

  private async checkCrossSigningReady(): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return false
      const crypto = (
        client as unknown as { getCrypto?: () => { isCrossSigningReady?: () => Promise<boolean> } }
      ).getCrypto?.()
      if (crypto?.isCrossSigningReady) {
        return await crypto.isCrossSigningReady()
      }
      return false
    } catch (err) {
      // R-03: 跨签名检查失败不应静默
      logger.error('checkCrossSigningReady 失败:', err)
      return false
    }
  }

  private countUndecryptableMessages(): number {
    try {
      const client = matrixClientService.getClient()
      if (!client) return 0
      const rooms = client.getRooms()
      let count = 0
      for (const room of rooms) {
        for (const event of room.timeline) {
          const content = event.getContent()
          if (content && (content as Record<string, unknown>).msgtype === 'm.bad.encrypted') {
            count++
          }
        }
      }
      return count
    } catch (err) {
      // R-04: 不可解密消息计数失败不应静默
      logger.error('countUndecryptableMessages 失败:', err)
      return 0
    }
  }

  private async triggerKeyRequests(): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return
      const rooms = client.getRooms()
      for (const room of rooms) {
        for (const event of room.timeline) {
          const content = event.getContent()
          if (content && (content as Record<string, unknown>).msgtype === 'm.bad.encrypted') {
            const wireContent = event.getWireContent()
            const sessionId = (wireContent as Record<string, unknown>).session_id as string | undefined
            const roomId = (room as unknown as { roomId?: string }).roomId
            if (sessionId && roomId) {
              try {
                await matrixCryptoService.createRoomKeyRequest(roomId, sessionId, 'm.megolm.v1.aes-sha2', {})
                this.callbacks.onKeyRequestTriggered?.(roomId, sessionId)
              } catch {
                // silently continue to next
              }
            }
          }
        }
      }
    } catch (err) {
      logger.error('触发密钥请求失败:', err)
    }
  }

  destroy(): void {
    this.stop()
    this.callbacks = {}
  }
}

export const cryptoHealthMonitor = new CryptoHealthMonitor()
