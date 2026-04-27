import { error } from '@tauri-apps/plugin-log'
import matrixClientService from '../MatrixClientService'
import type { MatrixClientExtended } from '@/types/matrix-extensions'

export interface MatrixEncryptionSessionContext {
  userId: string | null
  deviceId: string | null
  isCryptoEnabled: boolean
}

export interface PreparedKeyBackupVersion {
  algorithm: string
  authData: Record<string, unknown>
  privateKey: Uint8Array
}

interface CryptoKeyBackupPreparer {
  prepareKeyBackupVersion?(key?: Uint8Array): Promise<{
    algorithm: string
    auth_data: Record<string, unknown>
    privateKey: Uint8Array
  }>
}

interface StoredDeviceLike {
  getFingerprint?(): string | undefined
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
      error(`[EncryptionContext] 获取当前设备指纹失败: ${err}`)
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

      const storedDevice = await this.getExtendedClient()?.getStoredDevice?.(resolvedUserId, resolvedDeviceId)
      return (storedDevice as StoredDeviceLike | null)?.getFingerprint?.() ?? null
    } catch (err) {
      error(`[EncryptionContext] 获取设备指纹失败: ${err}`)
      return null
    }
  }

  async prepareKeyBackupVersion(key?: Uint8Array): Promise<PreparedKeyBackupVersion | null> {
    try {
      const client = this.getExtendedClient()
      const preparedByManager = await client?.getKeyBackupManager?.()?.prepareKeyBackupVersion?.(key)
      if (preparedByManager) {
        return {
          algorithm: preparedByManager.algorithm,
          authData: preparedByManager.auth_data,
          privateKey: preparedByManager.privateKey
        }
      }

      const preparedByCrypto = await (this.getCrypto() as CryptoKeyBackupPreparer | null)?.prepareKeyBackupVersion?.(
        key
      )
      if (!preparedByCrypto) {
        return null
      }

      return {
        algorithm: preparedByCrypto.algorithm,
        authData: preparedByCrypto.auth_data,
        privateKey: preparedByCrypto.privateKey
      }
    } catch (err) {
      error(`[EncryptionContext] 准备密钥备份版本失败: ${err}`)
      return null
    }
  }
}

export const matrixEncryptionContextService = new MatrixEncryptionContextService()

export default matrixEncryptionContextService
