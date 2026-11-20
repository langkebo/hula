import type { MatrixClient } from 'matrix-js-sdk'
import type {
  KeyBackupBatchRecoverResult,
  KeyBackupExportResult,
  KeyBackupImportResult,
  KeyBackupRecoveryProgress,
  KeyBackupRoomKeyBackup,
  KeyBackupVerifyResult,
  KeyBackupVersionInfo,
  RecoverRoomKeysResult,
  RecoverSessionKeyResult,
  RoomSessions,
  SessionData
} from '@/services/matrix/sdk'
import type { BackupInfo, KeyBackupManager, MatrixClientExtended } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { extractRoomKeys } from './ssssKeyDescription'

const logger = createLogger('MatrixKeyBackupService')

/**
 * 备份版本概要。
 *
 * auth_data 随备份算法变化（curve25519-aes-sha2 用 `public_key`，aes-sha2 用 `iv`/`mac`），
 * 直接派生自 SDK `BackupVersionInfo` 契约，不再手写匿名 Record。
 */
export type BackupVersionInfo = Pick<KeyBackupVersionInfo, 'version' | 'algorithm' | 'auth_data'>

/** 备份版本详情（含 count / etag） */
type BackupVersion = KeyBackupVersionInfo

/** 全量房间会话备份载荷（rooms → sessions → session_data 三层均为 SDK 契约） */
type RoomKeyBackup = KeyBackupRoomKeyBackup

/** 备份恢复进度 */
type RecoveryProgress = KeyBackupRecoveryProgress

/** 批量恢复结果 */
type BatchRecoverResult = KeyBackupBatchRecoverResult

/** 导出结果（room_keys 条目含 room_id / session_id / session_data） */
type ExportResult = KeyBackupExportResult

/** 导入结果 */
export type ImportResult = KeyBackupImportResult

/** 校验结果（auth_data 为算法联合，signatures 为设备签名映射） */
export type VerifyResult = KeyBackupVerifyResult

interface RestoreBackupResult {
  total: number
  imported: number
}

interface CreateKeyBackupVersionRequest {
  algorithm: string
  auth_data: BackupVersionInfo['auth_data']
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
    const client: MatrixClientExtended = this.getClient() as MatrixClient & MatrixClientExtended
    return client.getKeyBackupManager?.() ?? null
  }

  async checkKeyBackup(): Promise<BackupInfo | null> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const info = await keyBackupManager.getLatestBackupVersion()
      return {
        version: info.version,
        algorithm: info.algorithm,
        auth_data: info.auth_data,
        ...(info.count !== undefined ? { count: info.count } : {}),
        ...(info.etag !== undefined ? { etag: info.etag } : {})
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
      return {
        total: result.total_keys ?? 0,
        imported: result.recovered_keys ?? 0
      }
    } catch (err) {
      logger.error(`[KeyBackup] 恢复密钥备份失败: ${err}`)
      throw err
    }
  }

  async getBackupVersions(): Promise<BackupVersionInfo[]> {
    const backupInfo = await this.checkKeyBackup()
    return backupInfo ? [backupInfo] : []
  }

  async createBackupVersion(algorithm: string, authData: BackupVersionInfo['auth_data']): Promise<BackupVersion> {
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
        auth_data: info.auth_data,
        ...(info.count !== undefined ? { count: info.count } : {}),
        ...(info.etag !== undefined ? { etag: info.etag } : {})
      }
    } catch (err) {
      logger.error(`[KeyBackup] 获取备份版本详情失败: ${version}, ${err}`)
      throw err
    }
  }

  async updateBackupVersion(
    version: string,
    _algorithm: string,
    authData: BackupVersionInfo['auth_data']
  ): Promise<void> {
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
      return result
    } catch (err) {
      logger.error(`[KeyBackup] 获取所有备份密钥失败: ${version}, ${err}`)
      throw err
    }
  }

  async uploadKeys(version: string, keys: RoomKeyBackup): Promise<void> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      await keyBackupManager.putAllRoomKeys(version, keys)
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
      return result
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
      return result
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
      return result
    } catch (err) {
      logger.error(`[KeyBackup] 导出密钥失败: ${err}`)
      throw err
    }
  }

  async importKeys(keys: ExportResult | ExportResult['room_keys'], version?: string): Promise<ImportResult> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.importKeys(extractRoomKeys(keys), version)
      logger.info('[KeyBackup] 导入密钥成功')
      return result
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
      return result
    } catch (err) {
      logger.error(`[KeyBackup] 获取指定版本密钥失败: ${version}, ${err}`)
      throw err
    }
  }

  async uploadKeysToVersion(version: string, keys: RoomKeyBackup): Promise<void> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      await keyBackupManager.putAllRoomKeys(version, keys)
      logger.info(`[KeyBackup] 上传密钥到指定版本成功: ${version}`)
    } catch (err) {
      logger.error(`[KeyBackup] 上传密钥到指定版本失败: ${version}, ${err}`)
      throw err
    }
  }

  async getRoomBackupKeys(version: string, roomId: string): Promise<RoomSessions> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.getRoomKeys(version, roomId)
      return result
    } catch (err) {
      logger.error(`[KeyBackup] 获取房间备份密钥失败: ${roomId}, ${err}`)
      throw err
    }
  }

  async getSessionBackupKey(version: string, roomId: string, sessionId: string): Promise<SessionData['session_data']> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.getSessionKey(version, roomId, sessionId)
      return result
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
      return result
    } catch (err) {
      logger.error(`[KeyBackup] 批量恢复失败: ${err}`)
      throw err
    }
  }

  async recoverRoomKeys(version: string, roomId: string): Promise<RecoverRoomKeysResult> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.recoverRoomKeys(version, roomId)
      logger.info(`[KeyBackup] 房间级恢复成功: ${roomId}`)
      return result
    } catch (err) {
      logger.error(`[KeyBackup] 房间级恢复失败: ${roomId}, ${err}`)
      throw err
    }
  }

  async recoverSessionKey(version: string, roomId: string, sessionId: string): Promise<RecoverSessionKeyResult> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.recoverSessionKey(version, roomId, sessionId)
      logger.info(`[KeyBackup] 会话级恢复成功: ${roomId}/${sessionId}`)
      return result
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
      return result
    } catch (err) {
      logger.error(`[KeyBackup] 按版本导出密钥失败: ${version}, ${err}`)
      throw err
    }
  }

  async importKeysToVersion(version: string, keys: ExportResult | ExportResult['room_keys']): Promise<ImportResult> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (!keyBackupManager) throw new Error('[KeyBackup] KeyBackupManager 不可用')
      const result = await keyBackupManager.importKeys(extractRoomKeys(keys), version)
      return result
    } catch (err) {
      logger.error(`[KeyBackup] 按版本导入密钥失败: ${version}, ${err}`)
      throw err
    }
  }
}

export const matrixKeyBackupService = new MatrixKeyBackupService()
