import { formatMatrixError } from '@/common/matrixErrorTranslator'
import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'
import { initializeDeviceService } from '../user/MatrixDeviceService'
import matrixCryptoService from './MatrixCryptoService'
import { matrixEncryptionService } from './MatrixEncryptionService'
import { initializeKeyBackupService } from './MatrixKeyBackupService'
import { initializeVerificationService } from './MatrixVerificationService'

const logger = createLogger('E2EEBootstrap')

export interface E2EEStatus {
  isInitialized: boolean
  isCryptoEnabled: boolean
  isCrossSigningReady: boolean
  isKeyBackupEnabled: boolean
}

class MatrixE2EEBootstrapService {
  private isInitialized = false

  /**
   * 初始化 E2EE 环境
   * 整合分散的加密相关服务初始化逻辑
   */
  async bootstrapE2EE(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('客户端未初始化，跳过 E2EE 初始化')
      return
    }

    try {
      logger.info('开始初始化 E2EE 环境...')

      // 1. 初始化核心加密模块
      await matrixCryptoService.initializeCrypto()
      await matrixEncryptionService.initialize()

      // 2. 初始化子服务
      initializeDeviceService()
      initializeKeyBackupService()
      initializeVerificationService()

      // 3. 校验并确保基本配置正确
      await this.validateAndSetupE2EE()

      this.isInitialized = true
      logger.info('E2EE 环境初始化完成')
    } catch (err) {
      logger.error(`E2EE 环境初始化失败: ${formatMatrixError(err)}`)
      throw err
    }
  }

  /**
   * 校验并设置 E2EE 环境
   * 确保跨签名和密钥备份等核心功能处于预期状态
   */
  private async validateAndSetupE2EE(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) return

    try {
      // 检查加密是否真正启用
      const isCryptoEnabled = await matrixEncryptionService.isEncryptionAvailable()
      if (!isCryptoEnabled) {
        logger.warn('加密模块未在客户端启用')
        return
      }

      // 获取当前加密状态
      const status = await matrixCryptoService.getCryptoStatus()
      logger.debug('当前 E2EE 状态:', status)

      // 如果跨签名未就绪，尝试下载密钥
      if (status && !status.crossSigningReady) {
        logger.info('跨签名未就绪，尝试同步密钥...')
        // 这里可以添加同步密钥的逻辑，如果 SDK 支持的话
      }

      // 如果密钥备份未启用，记录警告（通常由用户手动启用）
      if (status && !status.keyBackupEnabled) {
        logger.warn('密钥备份未启用，建议用户设置密钥备份以防密钥丢失')
      }
    } catch (err) {
      logger.error(`校验 E2EE 环境失败: ${formatMatrixError(err)}`)
      // 校验失败不一定阻塞整个启动流程，但需要记录
    }
  }

  /**
   * 校验 E2EE 环境状态
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
    const isCryptoEnabled = await matrixEncryptionService.isEncryptionAvailable()

    return {
      isInitialized: this.isInitialized,
      isCryptoEnabled,
      isCrossSigningReady: cryptoStatus?.crossSigningReady ?? false,
      isKeyBackupEnabled: cryptoStatus?.keyBackupEnabled ?? false
    }
  }

  /**
   * 确保 E2EE 已准备就绪，如果未初始化则进行初始化
   */
  async ensureE2EEReady(): Promise<void> {
    if (!this.isInitialized) {
      await this.bootstrapE2EE()
    }
  }

  /**
   * 重置 E2EE 状态（例如退出登录时）
   */
  reset(): void {
    this.isInitialized = false
    logger.debug('E2EE 状态已重置')
  }
}

export const matrixE2EEBootstrapService = new MatrixE2EEBootstrapService()
export default matrixE2EEBootstrapService
