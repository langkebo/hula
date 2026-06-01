import type { MatrixClient } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('MatrixQrLoginBridgeService')

export interface QrCodeResult {
  transactionId: string
  mode: string
  challenge: string
  expiresIn: number
}

export interface QrLoginStatusResult {
  transactionId: string
  userId: string
  status: 'pending' | 'confirmed' | 'expired' | 'invalidated'
}

interface QrLoginManagerLike {
  getQrCode(): Promise<{ transaction_id: string; mode: string; challenge: string; expires_in: number }>
  startQrLogin(req: { transaction_id: string; device_id?: string; initial_display_name?: string }): Promise<unknown>
  confirmQrLogin(req: { transaction_id: string }): Promise<unknown>
  getQrStatus(
    transactionId: string
  ): Promise<{ transaction_id: string; user_id: string; status: 'pending' | 'confirmed' | 'expired' | 'invalidated' }>
  invalidateQrLogin(req: { transaction_id: string }): Promise<unknown>
  waitForConfirmation(
    transactionId: string,
    timeoutMs?: number,
    pollIntervalMs?: number
  ): Promise<{ transaction_id: string; user_id: string; status: string }>
}

class MatrixQrLoginBridgeService extends BaseMatrixService {
  private ensureQrLoginManager(): QrLoginManagerLike {
    const client = this.getClient()
    return (client as MatrixClient & { getQrLoginManager(): QrLoginManagerLike }).getQrLoginManager()
  }

  async getQrCode(): Promise<QrCodeResult> {
    const manager = this.ensureQrLoginManager()
    try {
      const result = await manager.getQrCode()
      logger.info(`[QrLoginBridge] 获取二维码成功: ${result.transaction_id}`)
      return {
        transactionId: result.transaction_id,
        mode: result.mode,
        challenge: result.challenge,
        expiresIn: result.expires_in
      }
    } catch (err) {
      logger.error(`[QrLoginBridge] 获取二维码失败: ${err}`)
      throw err
    }
  }

  async startQrLogin(transactionId: string, deviceId?: string, displayName?: string): Promise<void> {
    const manager = this.ensureQrLoginManager()
    try {
      await manager.startQrLogin({
        transaction_id: transactionId,
        device_id: deviceId,
        initial_display_name: displayName
      })
      logger.info(`[QrLoginBridge] 启动二维码登录事务: ${transactionId}`)
    } catch (err) {
      logger.error(`[QrLoginBridge] 启动二维码登录失败: ${err}`)
      throw err
    }
  }

  async confirmQrLogin(transactionId: string): Promise<void> {
    const manager = this.ensureQrLoginManager()
    try {
      await manager.confirmQrLogin({ transaction_id: transactionId })
      logger.info(`[QrLoginBridge] 确认二维码登录: ${transactionId}`)
    } catch (err) {
      logger.error(`[QrLoginBridge] 确认二维码登录失败: ${err}`)
      throw err
    }
  }

  async getQrStatus(transactionId: string): Promise<QrLoginStatusResult> {
    const manager = this.ensureQrLoginManager()
    try {
      const result = await manager.getQrStatus(transactionId)
      return {
        transactionId: result.transaction_id,
        userId: result.user_id,
        status: result.status
      }
    } catch (err) {
      logger.error(`[QrLoginBridge] 查询二维码状态失败: ${err}`)
      throw err
    }
  }

  async invalidateQrLogin(transactionId: string): Promise<void> {
    const manager = this.ensureQrLoginManager()
    try {
      await manager.invalidateQrLogin({ transaction_id: transactionId })
      logger.info(`[QrLoginBridge] 使二维码登录失效: ${transactionId}`)
    } catch (err) {
      logger.error(`[QrLoginBridge] 使二维码登录失效失败: ${err}`)
      throw err
    }
  }

  async waitForConfirmation(
    transactionId: string,
    timeoutMs: number = 300000,
    pollIntervalMs: number = 2000
  ): Promise<QrLoginStatusResult> {
    const manager = this.ensureQrLoginManager()
    try {
      const result = await manager.waitForConfirmation(transactionId, timeoutMs, pollIntervalMs)
      logger.info(`[QrLoginBridge] 二维码登录已确认: ${result.user_id}`)
      return {
        transactionId: result.transaction_id,
        userId: result.user_id,
        status: result.status as QrLoginStatusResult['status']
      }
    } catch (err) {
      logger.error(`[QrLoginBridge] 等待二维码确认失败: ${err}`)
      throw err
    }
  }
}

export const matrixQrLoginBridgeService = new MatrixQrLoginBridgeService()
export default matrixQrLoginBridgeService
