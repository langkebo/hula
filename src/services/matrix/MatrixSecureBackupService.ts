import type { MatrixClient } from 'matrix-js-sdk'
import { BaseManager } from './BaseManager'

export interface SecureBackupInfo {
  backupId: string
  version: string
  algorithm: string
  authData: Record<string, unknown>
  keyCount: number
}

class MatrixSecureBackupService extends BaseManager {
  private client: MatrixClient | null = null
  private secureBackupManager: any = null

  initialize(client: MatrixClient): void {
    this.client = client
    this.secureBackupManager = (client as any).getSecureBackupManager?.() ?? null
  }

  private getManager() {
    if (!this.client) throw new Error('客户端未初始化')
    if (!this.secureBackupManager) throw new Error('SecureBackupManager 不可用')
    return this.secureBackupManager
  }

  async createSecureBackup(password: string, throwOnError = false): Promise<SecureBackupInfo | null> {
    try {
      const manager = this.getManager()
      const result = await manager.createSecureBackup(password)
      return {
        backupId: result?.backup_id ?? result?.backupId ?? '',
        version: result?.version ?? '',
        algorithm: result?.algorithm ?? '',
        authData: result?.auth_data ?? result?.authData ?? {},
        keyCount: result?.key_count ?? result?.keyCount ?? 0
      }
    } catch (error) {
      return this.handleError(error, 'createSecureBackup', null, throwOnError)
    }
  }

  async getSecureBackup(throwOnError = true): Promise<SecureBackupInfo | null> {
    try {
      const manager = this.getManager()
      const result = await manager.getSecureBackup()
      if (!result) return null
      return {
        backupId: result?.backup_id ?? result?.backupId ?? '',
        version: result?.version ?? '',
        algorithm: result?.algorithm ?? '',
        authData: result?.auth_data ?? result?.authData ?? {},
        keyCount: result?.key_count ?? result?.keyCount ?? 0
      }
    } catch (error) {
      return this.handleError(error, 'getSecureBackup', null, throwOnError)
    }
  }

  async deleteSecureBackup(throwOnError = false): Promise<void> {
    try {
      const manager = this.getManager()
      await manager.deleteSecureBackup()
    } catch (error) {
      this.handleError(error, 'deleteSecureBackup', undefined as unknown as void, throwOnError)
    }
  }

  async addKeysToSecureBackup(keys: Record<string, unknown>, throwOnError = false): Promise<void> {
    try {
      const manager = this.getManager()
      await manager.addKeysToSecureBackup(keys)
    } catch (error) {
      this.handleError(error, 'addKeysToSecureBackup', undefined as unknown as void, throwOnError)
    }
  }

  async restoreFromSecureBackup(password: string, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getManager()
      await manager.restoreFromSecureBackup(password)
      return true
    } catch (error) {
      return this.handleError(error, 'restoreFromSecureBackup', false, throwOnError)
    }
  }

  async verifySecureBackup(throwOnError = true): Promise<{ valid: boolean; algorithm?: string; keyCount?: number }> {
    try {
      const manager = this.getManager()
      const result = await manager.verifySecureBackup()
      return {
        valid: result?.valid ?? false,
        algorithm: result?.algorithm,
        keyCount: result?.key_count ?? result?.keyCount
      }
    } catch (error) {
      return this.handleError(error, 'verifySecureBackup', { valid: false }, throwOnError)
    }
  }
}

export const matrixSecureBackupService = new MatrixSecureBackupService()
export default matrixSecureBackupService
