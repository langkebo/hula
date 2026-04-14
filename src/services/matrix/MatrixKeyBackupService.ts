import type { MatrixClient } from 'matrix-js-sdk'
import { BaseManager } from './BaseManager'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('KeyBackup')

export interface BackupVersionInfo {
  version: string
  algorithm: string
  authData: Record<string, unknown>
  count?: number
  etag?: string
}

export interface RecoveryProgress {
  totalKeys: number
  recoveredKeys: number
  status: string
}

class MatrixKeyBackupService extends BaseManager {
  private client: MatrixClient | null = null
  private keyBackupManager: any = null
  private hasRestoredKeys = false

  initialize(client: MatrixClient): void {
    this.client = client
    this.keyBackupManager = (client as any).getKeyBackupManager?.() ?? null
    logger.info('服务已初始化', this.keyBackupManager ? '(SDK)' : '(fallback)')
  }

  async autoRestoreKeysOnNewDevice(throwOnError = true): Promise<boolean> {
    if (this.hasRestoredKeys) {
      logger.info('密钥已恢复过，跳过')
      return true
    }

    if (!this.client) {
      logger.error('客户端未初始化')
      return false
    }

    try {
      const crypto = (this.client as any).crypto
      if (!crypto?.backupManager) {
        logger.warn('Crypto backupManager 不可用')
        return false
      }

      const backupInfo = await crypto.backupManager.getBackupInfo()
      if (!backupInfo) {
        logger.info('未找到云端密钥备份')
        return false
      }

      logger.info('发现云端密钥备份，开始恢复...')

      const recoveryKey = await this.promptForRecoveryKey()
      if (!recoveryKey) {
        logger.warn('未提供 recovery key，跳过自动恢复')
        return false
      }

      await crypto.backupManager.restoreKeyBackup(recoveryKey, undefined, undefined, backupInfo.version)
      await crypto.bootstrapCrossSigning({ setupNewCrossSigning: false })

      this.hasRestoredKeys = true
      logger.info('密钥恢复成功')
      return true
    } catch (err) {
      return this.handleError(err, 'autoRestoreKeysOnNewDevice', false, throwOnError)
    }
  }

  private async promptForRecoveryKey(): Promise<string | null> {
    return null
  }

  async restoreKeysWithRecoveryKey(recoveryKey: string, version?: string, throwOnError = false): Promise<boolean> {
    if (!this.client) {
      throw new Error('客户端未初始化')
    }

    try {
      const crypto = (this.client as any).crypto
      if (!crypto?.backupManager) {
        throw new Error('Crypto backupManager 不可用')
      }

      await crypto.backupManager.restoreKeyBackup(recoveryKey, undefined, undefined, version)
      await crypto.bootstrapCrossSigning({ setupNewCrossSigning: false })

      this.hasRestoredKeys = true
      logger.info('手动密钥恢复成功')
      return true
    } catch (err) {
      return this.handleError(err, 'restoreKeysWithRecoveryKey', false, throwOnError)
    }
  }

  hasRestored(): boolean {
    return this.hasRestoredKeys
  }

  resetRestoreState(): void {
    this.hasRestoredKeys = false
  }

  private getManager() {
    if (!this.client) throw new Error('客户端未初始化')
    if (!this.keyBackupManager) throw new Error('KeyBackupManager 不可用')
    return this.keyBackupManager
  }

  async getBackupVersions(throwOnError = true): Promise<BackupVersionInfo[]> {
    if (!this.client) throw new Error('客户端未初始化')
    try {
      if (this.keyBackupManager) {
        const versions = await this.keyBackupManager.getBackupVersions()
        return (versions || []).map((v: any) => ({
          version: v.version,
          algorithm: v.algorithm,
          authData: v.auth_data || v.authData || {},
          count: v.count,
          etag: v.etag
        }))
      }
      const crypto = (this.client as any).crypto
      if (crypto?.backupManager) {
        const info = await crypto.backupManager.getBackupInfo()
        return info
          ? [
              {
                version: info.version,
                algorithm: info.algorithm,
                authData: info.auth_data || {},
                count: info.count
              }
            ]
          : []
      }
      return []
    } catch (err) {
      return this.handleError(err, 'getBackupVersions', [] as BackupVersionInfo[], throwOnError)
    }
  }

  async createBackupVersion(
    info?: { algorithm?: string; authData?: Record<string, unknown> },
    throwOnError = false
  ): Promise<BackupVersionInfo | null> {
    try {
      const manager = this.getManager()
      const result = await manager.createBackupVersion(info)
      logger.info('备份版本已创建:', result?.version)
      return {
        version: result.version,
        algorithm: result.algorithm,
        authData: result.auth_data || result.authData || {}
      }
    } catch (err) {
      return this.handleError(err, 'createBackupVersion', null as BackupVersionInfo | null, throwOnError)
    }
  }

  async deleteBackupVersion(version: string, throwOnError = false): Promise<void> {
    try {
      const manager = this.getManager()
      await manager.deleteBackupVersion(version)
      logger.info('备份版本已删除:', version)
    } catch (err) {
      this.handleError(err, 'deleteBackupVersion', undefined as void, throwOnError)
    }
  }

  async uploadKeysToLatest(roomKeys: Record<string, unknown>, throwOnError = false): Promise<void> {
    try {
      const manager = this.getManager()
      await manager.uploadKeysToLatest(roomKeys)
      logger.info('密钥已上传到最新版本')
    } catch (err) {
      this.handleError(err, 'uploadKeysToLatest', undefined as void, throwOnError)
    }
  }

  async uploadBatchKeys(keys: Record<string, unknown>, version?: string, throwOnError = false): Promise<void> {
    try {
      const manager = this.getManager()
      await manager.uploadBatchKeys(keys, version)
      logger.info('批量密钥已上传')
    } catch (err) {
      this.handleError(err, 'uploadBatchKeys', undefined as void, throwOnError)
    }
  }

  async recoverKeys(recoveryKey: string, version?: string, throwOnError = true): Promise<boolean> {
    if (!this.client) throw new Error('客户端未初始化')
    try {
      if (this.keyBackupManager) {
        await this.keyBackupManager.recoverKeys(recoveryKey, version)
        logger.info('密钥已恢复')
        return true
      }
      const crypto = (this.client as any).crypto
      if (crypto?.backupManager) {
        const key = await crypto.backupManager.restoreKeyBackup(recoveryKey, undefined, undefined, version)
        logger.info('密钥已恢复(fallback):', key?.total ?? 0, '个')
        return true
      }
      return false
    } catch (err) {
      return this.handleError(err, 'recoverKeys', false, throwOnError)
    }
  }

  async getRecoveryProgress(throwOnError = true): Promise<RecoveryProgress | null> {
    try {
      const manager = this.getManager()
      const progress = await manager.getRecoveryProgress()
      return {
        totalKeys: progress?.total_keys ?? progress?.totalKeys ?? 0,
        recoveredKeys: progress?.recovered_keys ?? progress?.recoveredKeys ?? 0,
        status: progress?.status || 'unknown'
      }
    } catch (err) {
      return this.handleError(err, 'getRecoveryProgress', null as RecoveryProgress | null, throwOnError)
    }
  }

  async verifyBackup(version: string, throwOnError = false): Promise<{ valid: boolean; keyCount?: number }> {
    try {
      const manager = this.getManager()
      const result = await manager.verifyBackup(version)
      return {
        valid: result?.valid ?? false,
        keyCount: result?.key_count ?? result?.keyCount
      }
    } catch (err) {
      return this.handleError(err, 'verifyBackup', { valid: false }, throwOnError)
    }
  }

  async exportKeys(password: string, version?: string, throwOnError = false): Promise<Uint8Array | null> {
    try {
      const manager = this.getManager()
      return await manager.exportKeys(password, version)
    } catch (err) {
      return this.handleError(err, 'exportKeys', null as Uint8Array | null, throwOnError)
    }
  }

  async importKeys(
    data: Uint8Array | string,
    password: string,
    throwOnError = false
  ): Promise<{ count: number; failed: number; total: number } | null> {
    try {
      const manager = this.getManager()
      const result = await manager.importKeys(data, password)
      return {
        count: result?.count ?? 0,
        failed: result?.failed ?? 0,
        total: result?.total ?? 0
      }
    } catch (err) {
      return this.handleError(err, 'importKeys', null, throwOnError)
    }
  }
}

export const matrixKeyBackupService = new MatrixKeyBackupService()
export default matrixKeyBackupService
