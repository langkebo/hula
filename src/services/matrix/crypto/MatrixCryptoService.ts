import type { GeneratedSecretStorageKey, SecureBackupInfo, VerificationRequest } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { cryptoSDKAdapter } from './CryptoSDKAdapter'

const logger = createLogger('MatrixCryptoService')

interface DeviceInfo {
  deviceId: string
  userId: string
  displayName?: string
  lastSeenTs?: number
  lastSeenIp?: string
  isVerified?: boolean
}

interface VerificationStatus {
  verified: boolean
  crossSigningVerified: boolean
  devicesCrossSigningVerified: boolean
}

export type EncryptionAlgorithm = 'm.megolm.v1.aes-sha2' | 'm.olm.v1.curve25519-aes-sha2'

/**
 * 加密核心服务（CryptoCore）。
 *
 * 2026-08 拆分说明：本类原为 1096 行的上帝服务，其中约 700 行是与
 * MatrixKeyBackupService / MatrixVerificationService 重复的死代码
 * （备份 CRUD、SAS/QR 验证流、设备密钥 REST 封装——零外部调用、零内部引用，
 * 调用方早已切到上述专职服务）。拆分将这些死代码整体删除而非再次搬运，
 * 消除双重维护。保留的 15 个方法均有真实调用方：
 * - 初始化/状态：initializeCrypto、getCryptoStatus
 * - 设备信任：getDevices、verifyDevice、unverifyDevice、getDeviceVerificationStatus、requestDeviceVerification
 * - 备份流程：setupKeyBackup、exportKeys、createRecoveryKeyFromPassphrase、createSecureBackup
 * - 房间加密：isRoomEncrypted、enableEncryption
 * - 密钥请求：createRoomKeyRequest
 */
class MatrixCryptoService extends BaseMatrixService {
  async initializeCrypto(): Promise<void> {
    try {
      cryptoSDKAdapter.invalidateCryptoCache()
      const crypto = cryptoSDKAdapter.getCrypto()
      if (crypto) {
        logger.info('[MatrixCrypto] 加密模块初始化成功')
      } else {
        logger.warn('[MatrixCrypto] 加密模块未启用')
      }
    } catch (err) {
      logger.error(`[MatrixCrypto] 加密模块初始化失败: ${err}`)
      throw err
    }
  }

  async getCryptoStatus(): Promise<{ crossSigningReady: boolean; keyBackupEnabled: boolean } | null> {
    try {
      const result = await cryptoSDKAdapter.getCryptoStatus()
      return result
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取加密状态失败: ${err}`)
      return null
    }
  }

  async getDevices(userId: string): Promise<DeviceInfo[]> {
    try {
      return await cryptoSDKAdapter.getDevices(userId)
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取设备列表失败: ${err}`)
      throw err
    }
  }

  async verifyDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await cryptoSDKAdapter.verifyDevice(userId, deviceId)
      logger.info(`[MatrixCrypto] 设备验证成功: ${userId}:${deviceId}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 设备验证失败: ${err}`)
      throw err
    }
  }

  async unverifyDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await cryptoSDKAdapter.unverifyDevice(userId, deviceId)
      logger.info(`[MatrixCrypto] 取消设备验证: ${userId}:${deviceId}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 取消设备验证失败: ${err}`)
      throw err
    }
  }

  async getDeviceVerificationStatus(userId: string, deviceId: string): Promise<VerificationStatus> {
    try {
      return await cryptoSDKAdapter.getDeviceVerificationStatus(userId, deviceId)
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取设备验证状态失败: ${err}`)
      throw err
    }
  }

  async requestDeviceVerification(userId: string, deviceId: string): Promise<VerificationRequest | null> {
    try {
      const result = await cryptoSDKAdapter.requestDeviceVerification(userId, deviceId)
      if (result) {
        logger.info(`[MatrixCrypto] 设备验证请求已发送(SDK): ${userId}:${deviceId}`)
      } else {
        const trustManager = cryptoSDKAdapter.getManagerAccessors().deviceTrust()
        if (trustManager) {
          logger.info(`[MatrixCrypto] 设备验证请求已发送: ${userId}:${deviceId}`)
        }
      }
      return result
    } catch (err) {
      logger.error(`[MatrixCrypto] 请求设备验证失败: ${err}`)
      throw err
    }
  }

  async setupKeyBackup(passphrase: string): Promise<void> {
    try {
      await cryptoSDKAdapter.setupKeyBackup(passphrase)
      logger.info('[MatrixCrypto] 设置密钥备份成功')
    } catch (err) {
      logger.error(`[MatrixCrypto] 设置密钥备份失败: ${err}`)
      throw err
    }
  }

  async exportKeys(passphrase: string): Promise<string> {
    try {
      const result = await cryptoSDKAdapter.exportKeys(passphrase)
      logger.info('[MatrixCrypto] 导出密钥成功')
      return result.data
    } catch (err) {
      if (err instanceof Error && err.message === '密码验证失败') {
        throw new Error(this.t('matrix_error.crypto.passphrase_verification_failed'))
      }
      logger.error(`[MatrixCrypto] 导出密钥失败: ${err}`)
      throw err
    }
  }

  async createRecoveryKeyFromPassphrase(password?: string): Promise<GeneratedSecretStorageKey | null> {
    try {
      const result = await cryptoSDKAdapter.createRecoveryKeyFromPassphrase(password)
      if (!result) {
        logger.error('[MatrixCrypto] 创建恢复密钥失败: CryptoApi 不可用或方法不存在')
        return null
      }
      logger.info(`[MatrixCrypto] 创建恢复密钥成功${password ? '（使用短语）' : '（随机生成）'}`)
      return result
    } catch (err) {
      logger.error(`[MatrixCrypto] 创建恢复密钥失败: ${err}`)
      throw err
    }
  }

  async createSecureBackup(passphrase: string): Promise<SecureBackupInfo | null> {
    try {
      const secureBackupManager = cryptoSDKAdapter.getManagerAccessors().secureBackup()
      if (secureBackupManager) {
        const result = await secureBackupManager.createSecureBackup(passphrase)
        logger.info(`[MatrixCrypto] 创建安全备份成功: ${result.backup_id}`)
        return result
      }
      return null
    } catch (err) {
      logger.error(`[MatrixCrypto] 创建安全备份失败: ${err}`)
      throw err
    }
  }

  async isRoomEncrypted(roomId: string): Promise<boolean> {
    try {
      return await cryptoSDKAdapter.isRoomEncrypted(roomId)
    } catch (err) {
      logger.error(`[MatrixCrypto] 检查房间加密状态失败: ${err}`)
      return false
    }
  }

  async enableEncryption(roomId: string, algorithm: EncryptionAlgorithm = 'm.megolm.v1.aes-sha2'): Promise<void> {
    try {
      await cryptoSDKAdapter.enableEncryption(roomId, algorithm)
      logger.info(`[MatrixCrypto] 启用房间加密: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 启用房间加密失败: ${err}`)
      throw err
    }
  }

  async createRoomKeyRequest(
    roomId: string,
    sessionId: string,
    algorithm: string,
    _devices: Record<string, string[]>
  ): Promise<void> {
    try {
      const manager = cryptoSDKAdapter.requireSDKDeviceKeysManager()
      await manager.createRoomKeyRequest({
        room_id: roomId,
        session_id: sessionId,
        algorithm,
        request_id: `req_${Date.now()}`
      })
      logger.info(`[MatrixCrypto] 创建房间密钥请求成功: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 创建房间密钥请求失败: ${err}`)
      throw err
    }
  }
}

const matrixCryptoService = new MatrixCryptoService()
export default matrixCryptoService
export { matrixCryptoService }
