import { error, info, warn } from '@tauri-apps/plugin-log'
import type { MatrixClient } from 'matrix-js-sdk'
import type { BackupInfo, KeyBackupManager, MatrixClientExtended } from '@/types/matrix-extensions'
import { BaseMatrixService } from '../BaseMatrixService'

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

interface HttpCapableClient {
  http: {
    authedRequest: <T = unknown>(
      method: string,
      path: string,
      queryParams?: Record<string, string>,
      body?: object
    ) => Promise<T>
  }
}

interface BackupVersionsResponse {
  current_version?: string
  version?: string
  algorithm?: string
  auth_data?: Record<string, unknown>
  count?: number
  etag?: string
  versions?: BackupVersionInfo[]
}

type MatrixHttpErrorLike = {
  httpStatus?: number
  errcode?: string
}

interface RestoreBackupResult {
  total: number
  imported: number
}

interface CreateKeyBackupVersionRequest {
  algorithm: string
  auth_data: Record<string, unknown>
}

class MatrixKeyBackupService extends BaseMatrixService {
  initialize(client: MatrixClient): void {
    this.setFallbackClient(client)
    info('[KeyBackup] 服务已初始化')
  }

  private ensureClient(): HttpCapableClient {
    return this.getClient() as HttpCapableClient
  }

  private getKeyBackupManager(): KeyBackupManager | null {
    const client = this.ensureClient() as MatrixClientExtended
    return client.getKeyBackupManager?.() ?? null
  }

  private async request<T>(method: string, path: string, body?: object): Promise<T> {
    const client = this.ensureClient()
    return (await client.http.authedRequest(method, path, undefined, body)) as T
  }

  async checkKeyBackup(): Promise<BackupInfo | null> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (keyBackupManager) {
        return await keyBackupManager.checkKeyBackup()
      }

      const response = await this.request<BackupVersionsResponse>('GET', '/_matrix/client/v3/room_keys/version')
      if (!response.version || !response.algorithm || !response.auth_data) {
        return null
      }

      return {
        version: response.version,
        algorithm: response.algorithm,
        auth_data: response.auth_data,
        count: response.count,
        etag: response.etag
      }
    } catch (err: unknown) {
      const matrixError = err as MatrixHttpErrorLike
      // 13.4.4: /room_keys/version 404 表示尚无备份，是规范允许的语义，静默处理
      if (
        matrixError?.httpStatus === 404 ||
        matrixError?.errcode === 'M_NOT_FOUND' ||
        (err instanceof Error && err.message.includes('404'))
      ) {
        info('[KeyBackup] 尚无密钥备份版本 (404)')
        return null
      }
      error(`[KeyBackup] 检查备份失败: ${err}`)
      throw err
    }
  }

  async createKeyBackupVersion(infoRequest: CreateKeyBackupVersionRequest): Promise<{ version: string }> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (keyBackupManager) {
        return await keyBackupManager.createKeyBackupVersion(infoRequest)
      }

      const response = await this.request<{ version: string }>(
        'POST',
        '/_matrix/client/v3/room_keys/version',
        infoRequest
      )
      return response
    } catch (err) {
      error(`[KeyBackup] 创建密钥备份版本失败: ${err}`)
      throw err
    }
  }

  async deleteKeyBackupVersion(version: string): Promise<void> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (keyBackupManager) {
        await keyBackupManager.deleteKeyBackupVersion(version)
        return
      }

      await this.request('DELETE', `/_matrix/client/v3/room_keys/version/${encodeURIComponent(version)}`)
    } catch (err) {
      error(`[KeyBackup] 删除密钥备份版本失败: ${version}, ${err}`)
      throw err
    }
  }

  async restoreKeyBackup(
    recoveryKey: string,
    roomId?: string,
    sessionId?: string,
    backupInfo?: BackupInfo
  ): Promise<RestoreBackupResult> {
    try {
      const keyBackupManager = this.getKeyBackupManager()
      if (keyBackupManager) {
        return await keyBackupManager.restoreKeyBackupWithRecoveryKey(recoveryKey, roomId, sessionId, backupInfo)
      }

      return await this.request<RestoreBackupResult>('POST', '/_matrix/client/v3/room_keys/restore', {
        recovery_key: recoveryKey,
        room_id: roomId,
        session_id: sessionId,
        backup_info: backupInfo
      })
    } catch (err) {
      error(`[KeyBackup] 恢复密钥备份失败: ${err}`)
      throw err
    }
  }

  scheduleKeyBackup(): void {
    const keyBackupManager = this.getKeyBackupManager()
    if (!keyBackupManager) {
      warn('[KeyBackup] KeyBackupManager 不可用，跳过调度')
      return
    }
    keyBackupManager.scheduleKeyBackupSend()
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
      return await this.request<BackupVersion>(
        'GET',
        `/_matrix/client/v3/room_keys/version/${encodeURIComponent(version)}`
      )
    } catch (err) {
      error(`[KeyBackup] 获取备份版本详情失败: ${version}, ${err}`)
      throw err
    }
  }

  async updateBackupVersion(version: string, algorithm: string, authData: Record<string, unknown>): Promise<void> {
    try {
      await this.request('PUT', `/_matrix/client/v3/room_keys/version/${encodeURIComponent(version)}`, {
        algorithm,
        auth_data: authData
      })
      info(`[KeyBackup] 更新备份版本成功: ${version}`)
    } catch (err) {
      error(`[KeyBackup] 更新备份版本失败: ${version}, ${err}`)
      throw err
    }
  }

  async deleteBackupVersion(version: string): Promise<void> {
    await this.deleteKeyBackupVersion(version)
    info(`[KeyBackup] 删除备份版本成功: ${version}`)
  }

  async getAllBackupKeys(version: string): Promise<RoomKeyBackup> {
    try {
      const response = await this.request<RoomKeyBackup>(
        'GET',
        `/_matrix/client/v3/room_keys/keys/${encodeURIComponent(version)}`
      )
      info(`[KeyBackup] 获取所有备份密钥成功: ${version}`)
      return response
    } catch (err) {
      error(`[KeyBackup] 获取所有备份密钥失败: ${version}, ${err}`)
      throw err
    }
  }

  async uploadKeys(version: string, keys: RoomKeyBackup | Record<string, unknown>): Promise<void> {
    try {
      await this.request('PUT', `/_matrix/client/v3/room_keys/keys/${encodeURIComponent(version)}`, keys)
      info(`[KeyBackup] 上传密钥成功: ${version}`)
    } catch (err) {
      error(`[KeyBackup] 上传密钥失败: ${version}, ${err}`)
      throw err
    }
  }

  async recoverKeys(version: string, recoveryKey: string): Promise<void> {
    const backupInfo = await this.getBackupVersion(version)
    await this.restoreKeyBackup(recoveryKey, undefined, undefined, backupInfo)
    info(`[KeyBackup] 恢复密钥成功: ${version}`)
  }

  async getRecoveryProgress(version: string): Promise<RecoveryProgress> {
    try {
      const response = await this.request<RecoveryProgress>(
        'GET',
        `/_matrix/client/v3/room_keys/recovery/${encodeURIComponent(version)}/progress`
      )
      info(`[KeyBackup] 获取恢复进度成功: ${version}`)
      return response
    } catch (err) {
      error(`[KeyBackup] 获取恢复进度失败: ${version}, ${err}`)
      throw err
    }
  }

  async verifyBackup(version: string): Promise<VerifyResult> {
    try {
      const response = await this.request<VerifyResult>(
        'GET',
        `/_matrix/client/v3/room_keys/verify/${encodeURIComponent(version)}`
      )
      info(`[KeyBackup] 验证备份成功: ${version}`)
      return response
    } catch (err) {
      error(`[KeyBackup] 验证备份失败: ${version}, ${err}`)
      throw err
    }
  }

  async exportKeys(version?: string): Promise<ExportResult> {
    try {
      const path = version
        ? `/_matrix/client/v3/room_keys/export/${encodeURIComponent(version)}`
        : '/_matrix/client/v3/room_keys/export'
      const response = await this.request<ExportResult>('GET', path)
      info('[KeyBackup] 导出密钥成功')
      return response
    } catch (err) {
      error(`[KeyBackup] 导出密钥失败: ${err}`)
      throw err
    }
  }

  async importKeys(keys: ExportResult | Record<string, unknown>, version?: string): Promise<ImportResult> {
    try {
      const path = version
        ? `/_matrix/client/v3/room_keys/import/${encodeURIComponent(version)}`
        : '/_matrix/client/v3/room_keys/import'
      const response = await this.request<ImportResult>('POST', path, keys)
      info('[KeyBackup] 导入密钥成功')
      return response
    } catch (err) {
      error(`[KeyBackup] 导入密钥失败: ${err}`)
      throw err
    }
  }

  async getBackupKeysByVersion(version: string): Promise<RoomKeyBackup> {
    try {
      return await this.request<RoomKeyBackup>(
        'GET',
        `/_matrix/client/v3/room_keys/keys/${encodeURIComponent(version)}`
      )
    } catch (err) {
      error(`[KeyBackup] 获取指定版本密钥失败: ${version}, ${err}`)
      throw err
    }
  }

  async uploadKeysToVersion(version: string, keys: RoomKeyBackup | Record<string, unknown>): Promise<void> {
    try {
      await this.request('PUT', `/_matrix/client/v3/room_keys/keys/${encodeURIComponent(version)}`, keys)
      info(`[KeyBackup] 上传密钥到指定版本成功: ${version}`)
    } catch (err) {
      error(`[KeyBackup] 上传密钥到指定版本失败: ${version}, ${err}`)
      throw err
    }
  }

  async getRoomBackupKeys(version: string, roomId: string): Promise<Record<string, unknown>> {
    try {
      return await this.request<Record<string, unknown>>(
        'GET',
        `/_matrix/client/v3/room_keys/keys/${encodeURIComponent(version)}/${encodeURIComponent(roomId)}`
      )
    } catch (err) {
      error(`[KeyBackup] 获取房间备份密钥失败: ${roomId}, ${err}`)
      throw err
    }
  }

  async getSessionBackupKey(version: string, roomId: string, sessionId: string): Promise<Record<string, unknown>> {
    try {
      return await this.request<Record<string, unknown>>(
        'GET',
        `/_matrix/client/v3/room_keys/keys/${encodeURIComponent(version)}/${encodeURIComponent(roomId)}/${encodeURIComponent(sessionId)}`
      )
    } catch (err) {
      error(`[KeyBackup] 获取会话备份密钥失败: ${roomId}/${sessionId}, ${err}`)
      throw err
    }
  }

  async batchRecover(version: string, options?: { rooms?: string[]; limit?: number }): Promise<BatchRecoverResult> {
    try {
      const body: Record<string, unknown> = {}
      if (options?.rooms) body.rooms = options.rooms
      if (options?.limit) body.limit = options.limit
      const response = await this.request<BatchRecoverResult>('POST', `/_matrix/client/v3/room_keys/batch_recover`, {
        version,
        ...body
      })
      info(`[KeyBackup] 批量恢复成功: ${version}`)
      return response
    } catch (err) {
      error(`[KeyBackup] 批量恢复失败: ${err}`)
      throw err
    }
  }

  async recoverRoomKeys(version: string, roomId: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.request<Record<string, unknown>>(
        'GET',
        `/_matrix/client/v3/room_keys/recover/${encodeURIComponent(version)}/${encodeURIComponent(roomId)}`
      )
      info(`[KeyBackup] 房间级恢复成功: ${roomId}`)
      return response
    } catch (err) {
      error(`[KeyBackup] 房间级恢复失败: ${roomId}, ${err}`)
      throw err
    }
  }

  async recoverSessionKey(version: string, roomId: string, sessionId: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.request<Record<string, unknown>>(
        'GET',
        `/_matrix/client/v3/room_keys/recover/${encodeURIComponent(version)}/${encodeURIComponent(roomId)}/${encodeURIComponent(sessionId)}`
      )
      info(`[KeyBackup] 会话级恢复成功: ${roomId}/${sessionId}`)
      return response
    } catch (err) {
      error(`[KeyBackup] 会话级恢复失败: ${roomId}/${sessionId}, ${err}`)
      throw err
    }
  }

  async exportKeysByVersion(version: string): Promise<ExportResult> {
    try {
      return await this.request<ExportResult>(
        'GET',
        `/_matrix/client/v3/room_keys/export/${encodeURIComponent(version)}`
      )
    } catch (err) {
      error(`[KeyBackup] 按版本导出密钥失败: ${version}, ${err}`)
      throw err
    }
  }

  async importKeysToVersion(version: string, keys: ExportResult | Record<string, unknown>): Promise<ImportResult> {
    try {
      return await this.request<ImportResult>(
        'POST',
        `/_matrix/client/v3/room_keys/import/${encodeURIComponent(version)}`,
        keys
      )
    } catch (err) {
      error(`[KeyBackup] 按版本导入密钥失败: ${version}, ${err}`)
      throw err
    }
  }

  // ==================== Secure Backup ====================

  async createSecureBackup(options: {
    algorithm?: string
    auth_data?: Record<string, unknown>
  }): Promise<{ id: string; algorithm: string }> {
    try {
      const body: Record<string, unknown> = {}
      if (options.algorithm) body.algorithm = options.algorithm
      if (options.auth_data) body.auth_data = options.auth_data
      const response = await this.request<{ id: string; algorithm: string }>(
        'POST',
        '/_matrix/client/v3/keys/backup/secure',
        body
      )
      info('[KeyBackup] 创建安全备份成功')
      return response
    } catch (err) {
      error(`[KeyBackup] 创建安全备份失败: ${err}`)
      throw err
    }
  }

  async getSecureBackup(backupId: string): Promise<Record<string, unknown> | null> {
    try {
      return await this.request<Record<string, unknown>>(
        'GET',
        `/_matrix/client/v3/keys/backup/secure/${encodeURIComponent(backupId)}`
      )
    } catch (err) {
      error(`[KeyBackup] 获取安全备份失败: ${backupId}, ${err}`)
      return null
    }
  }

  async deleteSecureBackup(backupId: string): Promise<void> {
    try {
      await this.request('DELETE', `/_matrix/client/v3/keys/backup/secure/${encodeURIComponent(backupId)}`)
      info(`[KeyBackup] 删除安全备份成功: ${backupId}`)
    } catch (err) {
      error(`[KeyBackup] 删除安全备份失败: ${backupId}, ${err}`)
      throw err
    }
  }

  async addKeysToSecureBackup(backupId: string, keys: Record<string, unknown>): Promise<void> {
    try {
      await this.request('POST', `/_matrix/client/v3/keys/backup/secure/${encodeURIComponent(backupId)}/keys`, keys)
      info(`[KeyBackup] 写入安全备份密钥成功: ${backupId}`)
    } catch (err) {
      error(`[KeyBackup] 写入安全备份密钥失败: ${backupId}, ${err}`)
      throw err
    }
  }

  async restoreFromSecureBackup(backupId: string, recoveryKey: string): Promise<ImportResult> {
    try {
      const response = await this.request<ImportResult>(
        'POST',
        `/_matrix/client/v3/keys/backup/secure/${encodeURIComponent(backupId)}/restore`,
        { recovery_key: recoveryKey }
      )
      info(`[KeyBackup] 安全备份恢复成功: ${backupId}`)
      return response
    } catch (err) {
      error(`[KeyBackup] 安全备份恢复失败: ${backupId}, ${err}`)
      throw err
    }
  }

  async verifySecureBackup(backupId: string): Promise<VerifyResult> {
    try {
      const response = await this.request<VerifyResult>(
        'POST',
        `/_matrix/client/v3/keys/backup/secure/${encodeURIComponent(backupId)}/verify`
      )
      info(`[KeyBackup] 安全备份校验成功: ${backupId}`)
      return response
    } catch (err) {
      error(`[KeyBackup] 安全备份校验失败: ${backupId}, ${err}`)
      throw err
    }
  }
}

export const matrixKeyBackupService = new MatrixKeyBackupService()

export default matrixKeyBackupService
