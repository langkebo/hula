import { formatMatrixError } from '@/common/matrixErrorTranslator'
import type { VerificationRequest } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'
import type { CryptoHealthCallbacks, CryptoHealthStatus } from './CryptoHealthMonitor'
import { CryptoHealthMonitor } from './CryptoHealthMonitor'
import type {
  CrossSigningStatusResult,
  DeviceVerificationResult,
  KeyBackupRestoreResult,
  KeyBackupSetupResult,
  KeyExportResult,
  KeyImportResult
} from './CryptoSDKAdapter'
import { cryptoSDKAdapter } from './CryptoSDKAdapter'
import type { EncryptionAlgorithm } from './MatrixCryptoService'
import { matrixCryptoService } from './MatrixCryptoService'

const logger = createLogger('E2EEManager')

interface E2EEStatus {
  isInitialized: boolean
  isCryptoEnabled: boolean
  isCrossSigningReady: boolean
  isKeyBackupEnabled: boolean
}

class MatrixE2EEManager {
  private isInitialized = false
  private healthMonitor: CryptoHealthMonitor = new CryptoHealthMonitor()

  async bootstrapE2EE(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('客户端未初始化，跳过 E2EE 初始化')
      return
    }

    try {
      logger.info('开始初始化 E2EE 环境...')

      await matrixCryptoService.initializeCrypto()

      await this.validateAndSetupE2EE()

      this.healthMonitor.start()

      this.isInitialized = true
      logger.info('E2EE 环境初始化完成')
    } catch (err) {
      logger.error(`E2EE 环境初始化失败: ${formatMatrixError(err)}`)
      throw err
    }
  }

  private async validateAndSetupE2EE(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) return

    try {
      const isCryptoEnabled = await cryptoSDKAdapter.isEncryptionAvailable()
      if (!isCryptoEnabled) {
        logger.warn('加密模块未在客户端启用')
        return
      }

      const status = await matrixCryptoService.getCryptoStatus()
      logger.debug('当前 E2EE 状态:', status)

      if (status && !status.crossSigningReady) {
        logger.info('跨签名未就绪，尝试同步密钥...')
      }

      if (status && !status.keyBackupEnabled) {
        logger.warn('密钥备份未启用，建议用户设置密钥备份以防密钥丢失')
      }
    } catch (err) {
      logger.error(`校验 E2EE 环境失败: ${formatMatrixError(err)}`)
    }
  }

  async getE2EESettingsStatus(): Promise<E2EEStatus> {
    const client = matrixClientService.getClient()
    if (!client) {
      return {
        isInitialized: false,
        isCryptoEnabled: false,
        isCrossSigningReady: false,
        isKeyBackupEnabled: false
      }
    }

    const cryptoStatus = await matrixCryptoService.getCryptoStatus()
    const isCryptoEnabled = await cryptoSDKAdapter.isEncryptionAvailable()

    return {
      isInitialized: this.isInitialized,
      isCryptoEnabled,
      isCrossSigningReady: cryptoStatus?.crossSigningReady ?? false,
      isKeyBackupEnabled: cryptoStatus?.keyBackupEnabled ?? false
    }
  }

  async ensureE2EEReady(): Promise<void> {
    if (!this.isInitialized) {
      await this.bootstrapE2EE()
    }
  }

  async getCryptoStatus(): Promise<{ crossSigningReady: boolean; keyBackupEnabled: boolean } | null> {
    return cryptoSDKAdapter.getCryptoStatus()
  }

  async getCrossSigningStatus(): Promise<CrossSigningStatusResult> {
    return cryptoSDKAdapter.getCrossSigningStatus()
  }

  async isEncryptionAvailable(): Promise<boolean> {
    return cryptoSDKAdapter.isEncryptionAvailable()
  }

  async getDevices(userId: string) {
    return cryptoSDKAdapter.getDevices(userId)
  }

  async getDevice(userId: string, deviceId: string) {
    return cryptoSDKAdapter.getDevice(userId, deviceId)
  }

  async verifyDevice(userId: string, deviceId: string): Promise<void> {
    return cryptoSDKAdapter.verifyDevice(userId, deviceId)
  }

  async unverifyDevice(userId: string, deviceId: string): Promise<void> {
    return cryptoSDKAdapter.unverifyDevice(userId, deviceId)
  }

  async getDeviceVerificationStatus(userId: string, deviceId: string): Promise<DeviceVerificationResult> {
    return cryptoSDKAdapter.getDeviceVerificationStatus(userId, deviceId)
  }

  async requestDeviceVerification(userId: string, deviceId: string): Promise<VerificationRequest | null> {
    return matrixCryptoService.requestDeviceVerification(userId, deviceId)
  }

  async backupKeys(): Promise<void> {
    return cryptoSDKAdapter.backupKeys()
  }

  async setupKeyBackup(passphrase: string): Promise<KeyBackupSetupResult> {
    return cryptoSDKAdapter.setupKeyBackup(passphrase)
  }

  async restoreKeys(backupKey: string): Promise<KeyBackupRestoreResult> {
    return cryptoSDKAdapter.restoreKeys(backupKey)
  }

  async exportKeys(passphrase?: string): Promise<KeyExportResult> {
    return cryptoSDKAdapter.exportKeys(passphrase)
  }

  async importKeys(data: string): Promise<KeyImportResult> {
    return cryptoSDKAdapter.importKeys(data)
  }

  async setupCrossSigning(authParams?: { password?: string; authData?: unknown }): Promise<void> {
    return cryptoSDKAdapter.setupCrossSigning(authParams)
  }

  async isRoomEncrypted(roomId: string): Promise<boolean> {
    return cryptoSDKAdapter.isRoomEncrypted(roomId)
  }

  async enableEncryption(roomId: string, algorithm?: EncryptionAlgorithm): Promise<void> {
    return matrixCryptoService.enableEncryption(roomId, algorithm)
  }

  startHealthMonitoring(): void {
    this.healthMonitor.start()
  }

  stopHealthMonitoring(): void {
    this.healthMonitor.stop()
  }

  getHealthStatus(): CryptoHealthStatus {
    return this.healthMonitor.getStatus()
  }

  registerHealthCallbacks(callbacks: CryptoHealthCallbacks): void {
    this.healthMonitor.registerCallbacks(callbacks)
  }

  reset(): void {
    this.healthMonitor.stop()
    cryptoSDKAdapter.invalidateCryptoCache()
    this.isInitialized = false
    logger.debug('E2EE 状态已重置')
  }
}

export const matrixE2EEBootstrapService = new MatrixE2EEManager()
const _matrixE2EEManager = matrixE2EEBootstrapService
