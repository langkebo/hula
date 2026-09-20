import type { MatrixClientExtended } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'

const logger = createLogger('MatrixEncryptionContextService')

interface MatrixEncryptionSessionContext {
  userId: string | null
  deviceId: string | null
  isCryptoEnabled: boolean
}

class MatrixEncryptionContextService {
  private getExtendedClient(): MatrixClientExtended | null {
    return matrixClientService.getClient() as MatrixClientExtended | null
  }

  private getCrypto() {
    return this.getExtendedClient()?.getCrypto?.() ?? null
  }

  getCurrentSessionContext(): MatrixEncryptionSessionContext {
    return {
      userId: matrixClientService.getUserId(),
      deviceId: matrixClientService.getDeviceId(),
      isCryptoEnabled: !!this.getCrypto()
    }
  }

  async getCurrentDeviceFingerprint(): Promise<string | null> {
    try {
      const keys = await this.getCrypto()?.getOwnDeviceKeys?.()
      return keys?.ed25519 ?? null
    } catch (err) {
      logger.error(`[EncryptionContext] 获取当前设备指纹失败: ${err}`)
      return null
    }
  }

  async getDeviceFingerprint(userId?: string | null, deviceId?: string | null): Promise<string | null> {
    const sessionContext = this.getCurrentSessionContext()
    const resolvedUserId = userId ?? sessionContext.userId
    const resolvedDeviceId = deviceId ?? sessionContext.deviceId

    if (!resolvedUserId || !resolvedDeviceId) {
      return null
    }

    try {
      if (resolvedDeviceId === sessionContext.deviceId) {
        const ownFingerprint = await this.getCurrentDeviceFingerprint()
        if (ownFingerprint) {
          return ownFingerprint
        }
      }

      // 历史缺陷：此处曾用 `client.getStoredDevice` 兜底——该方法在 SDK 中不存在，
      // 兜底永远返回 null，指纹获取静默失败。现在直接返回 null，由调用方处理缺失。
      return null
    } catch (err) {
      logger.error(`[EncryptionContext] 获取设备指纹失败: ${err}`)
      return null
    }
  }

  /**
   * 确保存在可用的密钥备份版本。
   *
   * 使用 SDK 的真实 API `CryptoApi.resetKeyBackup()`：一步完成
   * "生成备份解密密钥 → 存入 SSSS → 创建新备份版本 → 启用备份引擎"。
   *
   * 历史缺陷（F-11）：旧实现调用 `KeyBackupManager.prepareKeyBackupVersion` 与
   * `CryptoApi.prepareKeyBackupVersion`，两者在 vendored SDK 中**都不存在**
   * （只有本仓自造类型声称有），且用了可选链，于是恒返回 null——
   * 移动端"启用备份"必然只弹一个"已禁用"提示，功能完全不可用且无报错。
   *
   * @returns `true` 备份版本已就绪；`false` 加密未启用
   * @throws 创建备份失败时抛出，由调用方走失败分支
   */
  async ensureKeyBackupVersion(): Promise<boolean> {
    const crypto = this.getCrypto()
    if (!crypto) {
      return false
    }
    await crypto.resetKeyBackup()
    return true
  }
}

export const matrixEncryptionContextService = new MatrixEncryptionContextService()
