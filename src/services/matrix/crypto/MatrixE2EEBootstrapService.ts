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

  /**
   * 初始化 E2EE：初始化 crypto → 校验环境 → 启动健康巡检。client 未就绪时跳过（不抛错）。
   */
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

  /**
   * 汇总 E2EE 设置状态（是否初始化、加密是否启用、跨签名、密钥备份）。
   */
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

  /**
   * 惰性初始化：仅在尚未初始化时触发 bootstrapE2EE。
   */
  async ensureE2EEReady(): Promise<void> {
    if (!this.isInitialized) {
      await this.bootstrapE2EE()
    }
  }

  /**
   * 取跨签名与密钥备份的就绪状态；crypto 不可用时返回 null。
   */
  async getCryptoStatus(): Promise<{ crossSigningReady: boolean; keyBackupEnabled: boolean } | null> {
    return cryptoSDKAdapter.getCryptoStatus()
  }

  /**
   * 取跨签名私钥的就绪情况（三把私钥是否可用）。
   */
  async getCrossSigningStatus(): Promise<CrossSigningStatusResult> {
    return cryptoSDKAdapter.getCrossSigningStatus()
  }

  /**
   * crypto 是否已在该 client 上启用。
   */
  async isEncryptionAvailable(): Promise<boolean> {
    return cryptoSDKAdapter.isEncryptionAvailable()
  }

  /**
   * 列出指定用户的设备。这是查**他人**设备的唯一途径（`POST /keys/query`）。
   */
  async getDevices(userId: string) {
    return cryptoSDKAdapter.getDevices(userId)
  }

  /**
   * 取指定用户的单个设备信息。
   */
  async getDevice(userId: string, deviceId: string) {
    return cryptoSDKAdapter.getDevice(userId, deviceId)
  }

  /**
   * 把设备标记为已验证。
   * 写入的是**本地 crypto store**，不上报服务端；其他设备看不到这一判定。
   */
  async verifyDevice(userId: string, deviceId: string): Promise<void> {
    return cryptoSDKAdapter.verifyDevice(userId, deviceId)
  }

  /**
   * 取消设备的已验证标记（同样只作用于本地 crypto store）。
   */
  async unverifyDevice(userId: string, deviceId: string): Promise<void> {
    return cryptoSDKAdapter.unverifyDevice(userId, deviceId)
  }

  /**
   * 读设备的验证状态。
   * 唯一可信来源是本地 crypto store —— `/keys/query` 的响应里没有信任字段。
   */
  async getDeviceVerificationStatus(userId: string, deviceId: string): Promise<DeviceVerificationResult> {
    return cryptoSDKAdapter.getDeviceVerificationStatus(userId, deviceId)
  }

  /**
   * 发起设备验证请求。返回的只是请求对象：SAS 需**对端接受后**才产生，不能拿它当验证已完成。
   */
  async requestDeviceVerification(userId: string, deviceId: string): Promise<VerificationRequest | null> {
    return matrixCryptoService.requestDeviceVerification(userId, deviceId)
  }

  /**
   * 触发一次房间密钥备份上传到服务端备份版本。
   */
  async backupKeys(): Promise<void> {
    return cryptoSDKAdapter.backupKeys()
  }

  /**
   * 用口令初始化密钥备份（生成或恢复备份密钥）。
   */
  async setupKeyBackup(passphrase: string): Promise<KeyBackupSetupResult> {
    return cryptoSDKAdapter.setupKeyBackup(passphrase)
  }

  /**
   * 用备份密钥恢复房间密钥。
   */
  async restoreKeys(backupKey: string): Promise<KeyBackupRestoreResult> {
    return cryptoSDKAdapter.restoreKeys(backupKey)
  }

  /**
   * 导出房间密钥为可保存的字符串（可加口令保护）。
   */
  async exportKeys(passphrase?: string): Promise<KeyExportResult> {
    return cryptoSDKAdapter.exportKeys(passphrase)
  }

  /**
   * 导入此前导出的房间密钥。
   */
  async importKeys(data: string): Promise<KeyImportResult> {
    return cryptoSDKAdapter.importKeys(data)
  }

  /**
   * 初始化跨签名（可能需要密码或 UIA 认证参数）。
   */
  async setupCrossSigning(authParams?: { password?: string; authData?: unknown }): Promise<void> {
    return cryptoSDKAdapter.setupCrossSigning(authParams)
  }

  /**
   * 判断房间是否启用加密。
   */
  async isRoomEncrypted(roomId: string): Promise<boolean> {
    return cryptoSDKAdapter.isRoomEncrypted(roomId)
  }

  /**
   * 为房间开启加密；默认算法 m.megolm.v1.aes-sha2。
   */
  async enableEncryption(roomId: string, algorithm?: EncryptionAlgorithm): Promise<void> {
    return matrixCryptoService.enableEncryption(roomId, algorithm)
  }

  /**
   * 启动 crypto 健康巡检。
   */
  startHealthMonitoring(): void {
    this.healthMonitor.start()
  }

  /**
   * 停止 crypto 健康巡检。
   */
  stopHealthMonitoring(): void {
    this.healthMonitor.stop()
  }

  /**
   * 读取最近一次健康巡检结果。
   */
  getHealthStatus(): CryptoHealthStatus {
    return this.healthMonitor.getStatus()
  }

  /**
   * 注册健康状态回调（异常与恢复时触发）。
   */
  registerHealthCallbacks(callbacks: CryptoHealthCallbacks): void {
    this.healthMonitor.registerCallbacks(callbacks)
  }

  /**
   * 重置 E2EE 状态：停止巡检、清 crypto 缓存并复位初始化标记。登出/换账号时调用。
   */
  reset(): void {
    this.healthMonitor.stop()
    cryptoSDKAdapter.invalidateCryptoCache()
    this.isInitialized = false
    logger.debug('E2EE 状态已重置')
  }
}

export const matrixE2EEBootstrapService = new MatrixE2EEManager()
