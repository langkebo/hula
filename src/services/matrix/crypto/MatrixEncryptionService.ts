import type { MatrixClient } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('MatrixEncryptionService')

export interface EncryptionSettings {
  algorithm: string
  rotationPeriodMs: number
  rotationPeriodMsgs: number
}

/**
 * @deprecated Use `CryptoSDKAdapter.CrossSigningStatusResult` from './CryptoSDKAdapter' instead.
 */
export interface CrossSigningInfo {
  isSetup: boolean
  masterPublicKey?: string
  selfSigningPublicKey?: string
  userSigningPublicKey?: string
}

/**
 * @deprecated Use `KeyBackupVersionInfo` from './MatrixCryptoService' or `KeyBackupManager` APIs instead.
 */
export interface KeyBackupInfo {
  version: string | null
  algorithm: string | null
  authData: Record<string, unknown>
  count: number
  etag: string
}

/**
 * @deprecated Use `VerificationRequest` from '@/types/matrix-extensions' or `matrixVerificationService` instead.
 */
export interface VerificationRequest {
  requestId: string
  phase: string
  methods: string[]
  otherParty: {
    userId: string
    deviceId: string
  }
}

export interface KeyRotationStatus {
  enabled: boolean
  intervalMs: number
  lastRotation?: number
  needsRotation: boolean
}

export interface KeyRotationRecord {
  keyId: string
  rotatedAt: number
  deviceId: string
}

/**
 * @deprecated Use `cryptoSDKAdapter.setupKeyBackupWithOptions()` from './CryptoSDKAdapter' instead.
 */
export interface SetupKeyBackupOptions {
  recoveryKey?: string
  password?: string
  authData?: import('@/types/matrix-extensions').MatrixAuthData
  generatedKey?: import('@/types/matrix-extensions').GeneratedSecretStorageKey | null
}

/**
 * @remarks 密钥轮换需要管理员权限，普通用户调用将降级处理
 */
class MatrixEncryptionService extends BaseMatrixService {
  async getEncryptionSettings(roomId: string): Promise<EncryptionSettings | null> {
    let client: MatrixClient
    try {
      client = this.getClient()
    } catch {
      return null
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) return null

      const encryptionEvent = room.currentState.getStateEvents('m.room.encryption', '')
      if (!encryptionEvent) return null

      const content = encryptionEvent.getContent() as {
        algorithm?: string
        rotation_period_ms?: number
        rotation_period_msgs?: number
      }
      return {
        algorithm: content.algorithm || 'm.megolm.v1.aes-sha2',
        rotationPeriodMs: content.rotation_period_ms || 604800000,
        rotationPeriodMsgs: content.rotation_period_msgs || 100
      }
    } catch (err) {
      logger.error(`[Encryption] 获取加密设置失败: ${err}`)
      return null
    }
  }

  async getKeyRotationStatus(): Promise<KeyRotationStatus> {
    let client: MatrixClient
    try {
      client = this.getClient()
    } catch {
      return { enabled: false, intervalMs: 0, needsRotation: false }
    }

    try {
      const response = await client.getKeyRotationManager().postCheck()
      return {
        enabled: response.enabled ?? true,
        intervalMs: response.interval_ms ?? 604800000,
        lastRotation: response.last_rotation ?? undefined,
        needsRotation: response.needs_rotation ?? true
      }
    } catch (err) {
      if (this.isForbiddenError(err)) {
        logger.warn('[Encryption] 密钥轮换需要管理员权限，降级返回默认值')
        return { enabled: false, intervalMs: 0, needsRotation: false, lastRotation: undefined }
      }
      logger.error(`[Encryption] 获取密钥轮换状态失败: ${err}`)
      return { enabled: true, intervalMs: 604800000, needsRotation: false }
    }
  }

  async checkNeedsRotation(): Promise<boolean> {
    let client: MatrixClient
    try {
      client = this.getClient()
    } catch {
      return false
    }

    try {
      const response = await client.getKeyRotationManager().postCheck()
      return response.needs_rotation ?? false
    } catch (err) {
      if (this.isForbiddenError(err)) {
        logger.warn('[Encryption] 检查密钥轮换需要管理员权限，降级返回 false')
        return false
      }
      logger.error(`[Encryption] 检查密钥轮换需求失败: ${err}`)
      return false
    }
  }

  async rotateKeys(): Promise<{ success: boolean; keyId: string; rotatedAt: number }> {
    const client = this.getClient()

    try {
      const response = await client.getKeyRotationManager().rotateKey()
      logger.info('[Encryption] 密钥轮换成功')
      return {
        success: response.success,
        keyId: response.key_id ?? '',
        rotatedAt: response.rotated_at ?? Date.now()
      }
    } catch (err) {
      if (this.isForbiddenError(err)) {
        logger.warn('[Encryption] 密钥轮换需要管理员权限，降级返回失败结果')
        return { success: false, keyId: '', rotatedAt: 0 }
      }
      logger.error(`[Encryption] 密钥轮换失败: ${err}`)
      throw err
    }
  }

  getCurrentDeviceId(): string | null {
    let client: MatrixClient
    try {
      client = this.getClient()
      return client.deviceId ?? null
    } catch {
      return null
    }
  }

  async getRotationHistory(deviceId: string): Promise<KeyRotationRecord[]> {
    let client: MatrixClient
    try {
      client = this.getClient()
    } catch {
      return []
    }

    try {
      const response = await client.getKeyRotationManager().getRotationHistory(deviceId)
      return (response.rotations ?? []).map((r: { key_id: string | null; rotated_ts: number | null }) => ({
        keyId: r.key_id ?? '',
        rotatedAt: r.rotated_ts ?? 0,
        deviceId
      }))
    } catch (err) {
      if (this.isForbiddenError(err)) {
        logger.warn('[Encryption] 获取轮换历史需要管理员权限，降级返回空数组')
        return []
      }
      logger.error(`[Encryption] 获取轮换历史失败: ${err}`)
      return []
    }
  }

  async revokeOldKeys(_deviceId: string, keyIds: string[]): Promise<number> {
    const client = this.getClient()

    try {
      let totalRevoked = 0
      for (const keyId of keyIds) {
        const response = await client.getKeyRotationManager().revokeKey({ key_id: keyId })
        totalRevoked += response.revoked
      }
      logger.info(`[Encryption] 撤销旧密钥成功: ${totalRevoked} 个`)
      return totalRevoked
    } catch (err) {
      if (this.isForbiddenError(err)) {
        logger.warn('[Encryption] 撤销旧密钥需要管理员权限，降级返回 0')
        return 0
      }
      logger.error(`[Encryption] 撤销旧密钥失败: ${err}`)
      throw err
    }
  }

  async configureKeyRotation(enabled: boolean, intervalDays: number = 30): Promise<void> {
    const client = this.getClient()

    try {
      await client.getKeyRotationManager().updateConfig({
        enabled,
        interval_ms: intervalDays * 24 * 60 * 60 * 1000
      })
      logger.info('[Encryption] 密钥轮换配置已更新')
    } catch (err) {
      if (this.isForbiddenError(err)) {
        logger.warn('[Encryption] 配置密钥轮换需要管理员权限，降级跳过')
        return
      }
      logger.error(`[Encryption] 配置密钥轮换失败: ${err}`)
      throw err
    }
  }

  private isForbiddenError(err: unknown): boolean {
    if (err instanceof Error) {
      const msg = err.message.toLowerCase()
      if (msg.includes('403') || msg.includes('forbidden') || msg.includes('forbidden access')) {
        return true
      }
    }
    if (typeof err === 'object' && err !== null) {
      const code = (err as Record<string, unknown>).httpStatus
      if (code === 403) return true
      const errCode = (err as Record<string, unknown>).errcode || (err as Record<string, unknown>).error
      if (typeof errCode === 'string' && (errCode.includes('403') || errCode.toLowerCase().includes('forbidden'))) {
        return true
      }
    }
    return false
  }
}

export const matrixEncryptionService = new MatrixEncryptionService()
export default matrixEncryptionService
