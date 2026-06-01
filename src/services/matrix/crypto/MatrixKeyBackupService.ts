import type { MatrixClient } from 'matrix-js-sdk'
import type { BackupInfo, KeyBackupManager, MatrixClientExtended, SecureBackupManager } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('MatrixKeyBackupService')

export interface BackupVersionInfo {
  version: string
  algorithm: string
  auth_data: Record<string, unknown>
}

export interface BackupVersion {
  version: string
  algorithm: string
  auth_data: Record<string, unknown>
  count?: number
  etag?: string
}

export interface RoomKeyBackup {
  rooms: Record<
    string,
    {
      sessions: Record<
        string,
        {
          first_message_index: number
          forwarded_count: number
          is_verified: boolean
          session_data: Record<string, unknown>
        }
      >
    }
  >
  etag: string
}

export interface RecoveryProgress {
  user_id: string
  version: string
  total_keys: number
  recovered_keys: number
  status: string
  started_ts: number
  updated_ts: number
}

export interface BatchRecoverResult {
  rooms: Record<string, unknown>
  total_sessions: number
  has_more: boolean
  next_batch?: string
}

export interface ExportResult {
  room_keys: Array<{
    room_id: string
    session_id: string
    session_data: Record<string, unknown>
  }>
  version: string
}

export interface ImportResult {
  count: number
  failed: number
  total: number
}

export interface VerifyResult {
  valid: boolean
  algorithm: string
  auth_data: Record<string, unknown>
  key_count: number
  signatures?: Record<string, unknown>
}

interface RestoreBackupResult {
  total: number
  imported: number
}

interface CreateKeyBackupVersionRequest {
  algorithm: string
  auth_data: Record<string, unknown>
}

type MatrixHttpErrorLike = {
  httpStatus?: number
  errcode?: string
}

class MatrixKeyBackupService extends BaseMatrixService {
  initialize(client: MatrixClient): void {
    this.setFallbackClient(client)
    logger.info('[KeyBackup] 服务已初始化')
  }

  private getKeyBackupManager(): KeyBackupManager | null {
    const client = this.getClient() as MatrixClientExtended
    return client.getKeyBackupManager?.() ?? null
  }

  private getSecureBackupManager(): SecureBackupManager | null {
    const client = this.getClient() as MatrixClientExtended
    return client.getSecureBackupManager?.() ?? null
  }

  async checkKeyBackup(): Promise<BackupInfo | null> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const info = await keyBackupManager.getLatestBackupVersion()
      return {
        version: info.version,
        algorithm: info.algorithm,
        auth_data: info.auth_data as Record<string, unknown>,
        count: info.count,
        etag: info.etag
      }
    } catch (err: unknown) {
      const matrixError = err as MatrixHttpErrorLike
      if (
        matrixError?.httpStatus === 404 ||
        matrixError?.errcode === 'M_NOT_FOUND' ||
        (err instanceof Error && err.message.includes('404'))
      ) {
        logger.info('[KeyBackup] 尚无密钥备份版本 (404)')
        return null
      }
      logger.error(`[KeyBackup] 检查备份失败: ${err}`)
      throw err
    }
  }

  async createKeyBackupVersion(infoRequest: CreateKeyBackupVersionRequest): Promise<{ version: string }> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      return await keyBackupManager.createBackupVersion(infoRequest.algorithm, infoRequest.auth_data)
    } catch (err) {
      logger.error(`[KeyBackup] 创建密钥备份版本失败: ${err}`)
      throw err
    }
  }

  async deleteKeyBackupVersion(version: string): Promise<void> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      await keyBackupManager.deleteBackupVersion(version)
    } catch (err) {
      logger.error(`[KeyBackup] 删除密钥备份版本失败: ${version}, ${err}`)
      throw err
    }
  }

  async restoreKeyBackup(version: string, rooms?: string[]): Promise<RestoreBackupResult> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.recoverKeys(version, rooms)
      const data = result as Record<string, unknown>
      return {
        total: (data.total_keys as number) ?? 0,
        imported: (data.recovered_keys as number) ?? 0
      }
    } catch (err) {
      logger.error(`[KeyBackup] 恢复密钥备份失败: ${err}`)
      throw err
    }
  }

  scheduleKeyBackup(): void {
    const keyBackupManager = this.getKeyBackupManager()
    if (!keyBackupManager) {
      logger.warn('[KeyBackup] KeyBackupManager 不可用，跳过调度')
      return
    }
    if (
      'scheduleKeyBackupSend' in keyBackupManager &&
      typeof (keyBackupManager as unknown as Record<string, unknown>).scheduleKeyBackupSend === 'function'
    ) {
      ;(keyBackupManager as unknown as Record<string, () => void>).scheduleKeyBackupSend()
    } else {
      logger.warn('[KeyBackup] KeyBackupManager 不支持 scheduleKeyBackupSend，跳过调度')
    }
  }

  async getBackupVersions(): Promise<BackupVersionInfo[]> {
    const backupInfo = await this.checkKeyBackup()
    return backupInfo ? [backupInfo] : []
  }

  async createBackupVersion(algorithm: string, authData: Record<string, unknown>): Promise<BackupVersion> {
    const response = await this.createKeyBackupVersion({
      algorithm,
      auth_data: authData
    })

    return {
      version: response.version,
      algorithm,
      auth_data: authData
    }
  }

  async getBackupVersion(version: string): Promise<BackupVersion> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const info = await keyBackupManager.getBackupVersion(version)
      return {
        version: info.version,
        algorithm: info.algorithm,
        auth_data: info.auth_data as Record<string, unknown>,
        count: info.count,
        etag: info.etag
      }
    } catch (err) {
      logger.error(`[KeyBackup] 获取备份版本详情失败: ${version}, ${err}`)
      throw err
    }
  }

  async updateBackupVersion(version: string, _algorithm: string, authData: Record<string, unknown>): Promise<void> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      await keyBackupManager.updateBackupVersion(version, authData)
      logger.info(`[KeyBackup] 更新备份版本成功: ${version}`)
    } catch (err) {
      logger.error(`[KeyBackup] 更新备份版本失败: ${version}, ${err}`)
      throw err
    }
  }

  async deleteBackupVersion(version: string): Promise<void> {
    await this.deleteKeyBackupVersion(version)
    logger.info(`[KeyBackup] 删除备份版本成功: ${version}`)
  }

  async getAllBackupKeys(version: string): Promise<RoomKeyBackup> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.getAllRoomKeys(version)
      logger.info(`[KeyBackup] 获取所有备份密钥成功: ${version}`)
      return result as RoomKeyBackup
    } catch (err) {
      logger.error(`[KeyBackup] 获取所有备份密钥失败: ${version}, ${err}`)
      throw err
    }
  }

  async uploadKeys(version: string, keys: RoomKeyBackup | Record<string, unknown>): Promise<void> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      await keyBackupManager.putAllRoomKeys(version, keys as Record<string, unknown>)
      logger.info(`[KeyBackup] 上传密钥成功: ${version}`)
    } catch (err) {
      logger.error(`[KeyBackup] 上传密钥失败: ${version}, ${err}`)
      throw err
    }
  }

  async recoverKeys(version: string): Promise<void> {
    await this.restoreKeyBackup(version)
    logger.info(`[KeyBackup] 恢复密钥成功: ${version}`)
  }

  async getRecoveryProgress(version: string): Promise<RecoveryProgress> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.getRecoveryProgress(version)
      logger.info(`[KeyBackup] 获取恢复进度成功: ${version}`)
      return result as RecoveryProgress
    } catch (err) {
      logger.error(`[KeyBackup] 获取恢复进度失败: ${version}, ${err}`)
      throw err
    }
  }

  async verifyBackup(version: string): Promise<VerifyResult> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.verifyBackup(version)
      logger.info(`[KeyBackup] 验证备份成功: ${version}`)
      return result as VerifyResult
    } catch (err) {
      logger.error(`[KeyBackup] 验证备份失败: ${version}, ${err}`)
      throw err
    }
  }

  async exportKeys(version?: string): Promise<ExportResult> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.exportKeys(version)
      logger.info('[KeyBackup] 导出密钥成功')
      return result as ExportResult
    } catch (err) {
      logger.error(`[KeyBackup] 导出密钥失败: ${err}`)
      throw err
    }
  }

  async importKeys(keys: ExportResult | Record<string, unknown>, version?: string): Promise<ImportResult> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const roomKeys = ('room_keys' in keys ? keys.room_keys : keys) as Array<Record<string, unknown>>
      const result = await keyBackupManager.importKeys(roomKeys, version)
      logger.info('[KeyBackup] 导入密钥成功')
      return result as ImportResult
    } catch (err) {
      logger.error(`[KeyBackup] 导入密钥失败: ${err}`)
      throw err
    }
  }

  async getBackupKeysByVersion(version: string): Promise<RoomKeyBackup> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.getAllRoomKeys(version)
      return result as RoomKeyBackup
    } catch (err) {
      logger.error(`[KeyBackup] 获取指定版本密钥失败: ${version}, ${err}`)
      throw err
    }
  }

  async uploadKeysToVersion(version: string, keys: RoomKeyBackup | Record<string, unknown>): Promise<void> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      await keyBackupManager.putAllRoomKeys(version, keys as Record<string, unknown>)
      logger.info(`[KeyBackup] 上传密钥到指定版本成功: ${version}`)
    } catch (err) {
      logger.error(`[KeyBackup] 上传密钥到指定版本失败: ${version}, ${err}`)
      throw err
    }
  }

  async getRoomBackupKeys(version: string, roomId: string): Promise<Record<string, unknown>> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.getRoomKeys(version, roomId)
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[KeyBackup] 获取房间备份密钥失败: ${roomId}, ${err}`)
      throw err
    }
  }

  async getSessionBackupKey(version: string, roomId: string, sessionId: string): Promise<Record<string, unknown>> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.getSessionKey(version, roomId, sessionId)
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[KeyBackup] 获取会话备份密钥失败: ${roomId}/${sessionId}, ${err}`)
      throw err
    }
  }

  async batchRecover(version: string, options?: { rooms?: string[]; limit?: number }): Promise<BatchRecoverResult> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.batchRecover(version, options?.rooms ?? [], options?.limit)
      logger.info(`[KeyBackup] 批量恢复成功: ${version}`)
      return result as BatchRecoverResult
    } catch (err) {
      logger.error(`[KeyBackup] 批量恢复失败: ${err}`)
      throw err
    }
  }

  async recoverRoomKeys(version: string, roomId: string): Promise<Record<string, unknown>> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.recoverRoomKeys(version, roomId)
      logger.info(`[KeyBackup] 房间级恢复成功: ${roomId}`)
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[KeyBackup] 房间级恢复失败: ${roomId}, ${err}`)
      throw err
    }
  }

  async recoverSessionKey(version: string, roomId: string, sessionId: string): Promise<Record<string, unknown>> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.recoverSessionKey(version, roomId, sessionId)
      logger.info(`[KeyBackup] 会话级恢复成功: ${roomId}/${sessionId}`)
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[KeyBackup] 会话级恢复失败: ${roomId}/${sessionId}, ${err}`)
      throw err
    }
  }

  async exportKeysByVersion(version: string): Promise<ExportResult> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.exportKeys(version)
      return result as ExportResult
    } catch (err) {
      logger.error(`[KeyBackup] 按版本导出密钥失败: ${version}, ${err}`)
      throw err
    }
  }

  async importKeysToVersion(version: string, keys: ExportResult | Record<string, unknown>): Promise<ImportResult> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const roomKeys = ('room_keys' in keys ? keys.room_keys : keys) as Array<Record<string, unknown>>
      const result = await keyBackupManager.importKeys(roomKeys, version)
      return result as ImportResult
    } catch (err) {
      logger.error(`[KeyBackup] 按版本导入密钥失败: ${version}, ${err}`)
      throw err
    }
  }

  // ==================== Secure Backup ====================

  async createSecureBackup(passphrase: string): Promise<{ id: string; algorithm: string }> {
    try {
      const secureBackupManager = this.getSecureBackupManager()
      if (!secureBackupManager) throw new Error('[KeyBackup] SecureBackupManager 不可用')
      const result = await secureBackupManager.createSecureBackup(passphrase)
      logger.info('[KeyBackup] 创建安全备份成功')
      return { id: result.backup_id, algorithm: result.algorithm }
    } catch (err) {
      logger.error(`[KeyBackup] 创建安全备份失败: ${err}`)
      throw err
    }
  }

  async getSecureBackup(backupId: string): Promise<Record<string, unknown> | null> {
    try {
      const secureBackupManager = this.getSecureBackupManager()
      if (!secureBackupManager) throw new Error('[KeyBackup] SecureBackupManager 不可用')
      const result = await secureBackupManager.getSecureBackup(backupId)
      return result as unknown as Record<string, unknown>
    } catch (err) {
      logger.error(`[KeyBackup] 获取安全备份失败: ${backupId}, ${err}`)
      return null
    }
  }

  async deleteSecureBackup(backupId: string): Promise<void> {
    try {
      const secureBackupManager = this.getSecureBackupManager()
      if (!secureBackupManager) throw new Error('[KeyBackup] SecureBackupManager 不可用')
      await secureBackupManager.deleteSecureBackup(backupId)
      logger.info(`[KeyBackup] 删除安全备份成功: ${backupId}`)
    } catch (err) {
      logger.error(`[KeyBackup] 删除安全备份失败: ${backupId}, ${err}`)
      throw err
    }
  }

  async addKeysToSecureBackup(
    backupId: string,
    passphrase: string,
    sessionKeys: Array<{ session_id: string; session_data: Record<string, unknown> }>
  ): Promise<void> {
    try {
      const secureBackupManager = this.getSecureBackupManager()
      if (!secureBackupManager) throw new Error('[KeyBackup] SecureBackupManager 不可用')
      await secureBackupManager.addKeysToSecureBackup(backupId, passphrase, sessionKeys)
      logger.info(`[KeyBackup] 写入安全备份密钥成功: ${backupId}`)
    } catch (err) {
      logger.error(`[KeyBackup] 写入安全备份密钥失败: ${backupId}, ${err}`)
      throw err
    }
  }

  async restoreFromSecureBackup(backupId: string, passphrase: string): Promise<ImportResult> {
    try {
      const secureBackupManager = this.getSecureBackupManager()
      if (!secureBackupManager) throw new Error('[KeyBackup] SecureBackupManager 不可用')
      const result = await secureBackupManager.restoreFromSecureBackup(backupId, passphrase)
      logger.info(`[KeyBackup] 安全备份恢复成功: ${backupId}`)
      return {
        count: result.recovered_keys,
        failed: 0,
        total: result.total_keys
      }
    } catch (err) {
      logger.error(`[KeyBackup] 安全备份恢复失败: ${backupId}, ${err}`)
      throw err
    }
  }

  async verifySecureBackup(backupId: string, passphrase: string): Promise<VerifyResult> {
    try {
      const secureBackupManager = this.getSecureBackupManager()
      if (!secureBackupManager) throw new Error('[KeyBackup] SecureBackupManager 不可用')
      const result = await secureBackupManager.verifySecureBackup(backupId, passphrase)
      logger.info(`[KeyBackup] 安全备份校验成功: ${backupId}`)
      return { valid: result.valid, algorithm: '', auth_data: {}, key_count: 0 }
    } catch (err) {
      logger.error(`[KeyBackup] 安全备份校验失败: ${backupId}, ${err}`)
      throw err
    }
  }
}

export const matrixKeyBackupService = new MatrixKeyBackupService()

export default matrixKeyBackupService
