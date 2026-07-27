import type {
  GeneratedSecretStorageKey,
  ISecuritySummary,
  SecureBackupInfo,
  SecureBackupRestoreResponse,
  VerificationRequest
} from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import endpointCapabilityService from '../EndpointCapabilityService'
import { MATRIX_PATHS } from '../paths'
import { cryptoSDKAdapter } from './CryptoSDKAdapter'

const logger = createLogger('MatrixCryptoService')

interface DeviceInfo {
  deviceId: string
  userId: string
  displayName?: string
  lastSeenTs?: number
  lastSeenIp?: string
  isVerified?: boolean
}

interface VerificationStatus {
  verified: boolean
  crossSigningVerified: boolean
  devicesCrossSigningVerified: boolean
}

interface CrossSigningStatus {
  privateKeysCached: boolean
  crossSigningVerified: boolean
}

export type EncryptionAlgorithm = 'm.megolm.v1.aes-sha2' | 'm.olm.v1.curve25519-aes-sha2'

interface KeyBackupVersionInfo {
  version: string
  algorithm: string
  auth_data: Record<string, unknown>
  count?: number
  etag?: string
}

interface KeyBackupWriteResult {
  etag: string
  count: number
}

interface RoomKeysResponse {
  rooms: Record<
    string,
    {
      sessions: Record<string, SessionKeyData>
    }
  >
}

interface RoomKeySessionsResponse {
  sessions: Record<string, SessionKeyData>
}

interface SessionKeyData {
  first_message_index: number
  forwarded_count: number
  is_verified: boolean
  session_data: {
    ciphertext?: string
    mac?: string
    ephemeral?: string
  }
}

interface RecoveryProgress {
  total: number
  recovered: number
  failed: number
  percentage: number
}

interface BackupVerifyResult {
  valid: boolean
  mismatch_count?: number
  message?: string
}

interface BatchRecoverResult {
  total: number
  recovered: number
  failed: number
  errors?: Array<{ room_id: string; session_id: string; error: string }>
}

interface SasVerificationStartResponse {
  transaction_id: string
  method: string
  key_agreement_protocol: string
  hash: string
  short_authentication_string: string[]
}

interface SasVerificationAcceptResponse {
  transaction_id: string
  method: string
  key_agreement_protocol: string
  hash: string
  short_authentication_string: string[]
  commitment?: string
}

interface SasKeyAgreementResponse {
  transaction_id: string
  confirmed: boolean
  short_authentication_string: Record<string, unknown>
}

interface SasMacResponse {
  transaction_id: string
  verified: boolean
}

interface SasDoneResponse {
  transaction_id: string
}

interface SasCancelResponse {
  transaction_id: string
  cancelled: boolean
}

interface PendingVerificationRequest {
  transaction_id: string
  from_device: string
  methods: string[]
  timestamp?: number
}

interface QrCodeShowResponse {
  transaction_id: string
  server_name: string
  user_id: string
  device_id: string
  device_ed25519_key: string
  device_curve25519_key: string
}

interface QrCodeScanResponse {
  transaction_id: string
  state: string
}

class MatrixCryptoService extends BaseMatrixService {
  async initializeCrypto(): Promise<void> {
    try {
      cryptoSDKAdapter.invalidateCryptoCache()
      const crypto = cryptoSDKAdapter.getCrypto()
      if (crypto) {
        logger.info('[MatrixCrypto] 加密模块初始化成功')
      } else {
        logger.warn('[MatrixCrypto] 加密模块未启用')
      }
    } catch (err) {
      logger.error(`[MatrixCrypto] 加密模块初始化失败: ${err}`)
      throw err
    }
  }

  async getCryptoStatus(): Promise<{ crossSigningReady: boolean; keyBackupEnabled: boolean } | null> {
    try {
      const result = await cryptoSDKAdapter.getCryptoStatus()
      return result
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取加密状态失败: ${err}`)
      return null
    }
  }

  async getDevices(userId: string): Promise<DeviceInfo[]> {
    try {
      return await cryptoSDKAdapter.getDevices(userId)
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取设备列表失败: ${err}`)
      throw err
    }
  }

  async getDevice(userId: string, deviceId: string): Promise<DeviceInfo | null> {
    try {
      return await cryptoSDKAdapter.getDevice(userId, deviceId)
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取设备信息失败: ${err}`)
      throw err
    }
  }

  async verifyDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await cryptoSDKAdapter.verifyDevice(userId, deviceId)
      logger.info(`[MatrixCrypto] 设备验证成功: ${userId}:${deviceId}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 设备验证失败: ${err}`)
      throw err
    }
  }

  async unverifyDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await cryptoSDKAdapter.unverifyDevice(userId, deviceId)
      logger.info(`[MatrixCrypto] 取消设备验证: ${userId}:${deviceId}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 取消设备验证失败: ${err}`)
      throw err
    }
  }

  async getDeviceVerificationStatus(userId: string, deviceId: string): Promise<VerificationStatus> {
    try {
      return await cryptoSDKAdapter.getDeviceVerificationStatus(userId, deviceId)
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取设备验证状态失败: ${err}`)
      throw err
    }
  }

  async requestDeviceVerification(userId: string, deviceId: string): Promise<VerificationRequest | null> {
    try {
      const result = await cryptoSDKAdapter.requestDeviceVerification(userId, deviceId)
      if (result) {
        logger.info(`[MatrixCrypto] 设备验证请求已发送(SDK): ${userId}:${deviceId}`)
      } else {
        const trustManager = cryptoSDKAdapter.getManagerAccessors().deviceTrust()
        if (trustManager) {
          logger.info(`[MatrixCrypto] 设备验证请求已发送: ${userId}:${deviceId}`)
        }
      }
      return result
    } catch (err) {
      logger.error(`[MatrixCrypto] 请求设备验证失败: ${err}`)
      throw err
    }
  }

  async respondToDeviceVerification(token: string, approved: boolean): Promise<boolean> {
    try {
      const trustManager = cryptoSDKAdapter.getManagerAccessors().deviceTrust()
      if (trustManager) {
        const result = await trustManager.respondToVerification(token, approved)
        logger.info(`[MatrixCrypto] 设备验证响应: token=${token}, approved=${approved}, success=${result.success}`)
        return result.success
      }
      return false
    } catch (err) {
      logger.error(`[MatrixCrypto] 响应设备验证失败: ${err}`)
      throw err
    }
  }

  async getSecuritySummary(): Promise<ISecuritySummary | null> {
    try {
      return await cryptoSDKAdapter.getSecuritySummary()
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取安全摘要失败: ${err}`)
      return null
    }
  }

  async backupKeys(): Promise<void> {
    try {
      await cryptoSDKAdapter.backupKeys()
      logger.info('[MatrixCrypto] 备份密钥成功')
    } catch (err) {
      logger.error(`[MatrixCrypto] 备份密钥失败: ${err}`)
      throw err
    }
  }

  async setupKeyBackup(passphrase: string): Promise<void> {
    try {
      await cryptoSDKAdapter.setupKeyBackup(passphrase)
      logger.info('[MatrixCrypto] 设置密钥备份成功')
    } catch (err) {
      logger.error(`[MatrixCrypto] 设置密钥备份失败: ${err}`)
      throw err
    }
  }

  async restoreKeys(backupKey: string): Promise<void> {
    try {
      const result = await cryptoSDKAdapter.restoreKeys(backupKey)
      logger.info(`[MatrixCrypto] 恢复密钥成功: ${result.imported}/${result.total}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 恢复密钥失败: ${err}`)
      throw err
    }
  }

  async exportKeys(passphrase: string): Promise<string> {
    try {
      const result = await cryptoSDKAdapter.exportKeys(passphrase)
      logger.info('[MatrixCrypto] 导出密钥成功')
      return result.data
    } catch (err) {
      if (err instanceof Error && err.message === '密码验证失败') {
        throw new Error(this.t('matrix_error.crypto.passphrase_verification_failed'))
      }
      logger.error(`[MatrixCrypto] 导出密钥失败: ${err}`)
      throw err
    }
  }

  async importKeys(data: string, passphrase: string): Promise<void> {
    try {
      const result = await cryptoSDKAdapter.importKeys(data)
      logger.info(`[MatrixCrypto] 导入密钥成功: ${result.imported}/${result.total}`)

      if (passphrase) {
        const secureBackupManager = cryptoSDKAdapter.getManagerAccessors().secureBackup()
        if (secureBackupManager) {
          const backups = await this.getSecureBackupList()
          if (backups.length > 0) {
            logger.info('[MatrixCrypto] 将导入的密钥同步到安全备份')
          }
        }
      }
    } catch (err) {
      logger.error(`[MatrixCrypto] 导入密钥失败: ${err}`)
      throw err
    }
  }

  async createRecoveryKeyFromPassphrase(password?: string): Promise<GeneratedSecretStorageKey | null> {
    try {
      const result = await cryptoSDKAdapter.createRecoveryKeyFromPassphrase(password)
      if (!result) {
        logger.error('[MatrixCrypto] 创建恢复密钥失败: CryptoApi 不可用或方法不存在')
        return null
      }
      logger.info(`[MatrixCrypto] 创建恢复密钥成功${password ? '（使用短语）' : '（随机生成）'}`)
      return result
    } catch (err) {
      logger.error(`[MatrixCrypto] 创建恢复密钥失败: ${err}`)
      throw err
    }
  }

  async createSecureBackup(passphrase: string): Promise<SecureBackupInfo | null> {
    try {
      const secureBackupManager = cryptoSDKAdapter.getManagerAccessors().secureBackup()
      if (secureBackupManager) {
        const result = await secureBackupManager.createSecureBackup(passphrase)
        logger.info(`[MatrixCrypto] 创建安全备份成功: ${result.backup_id}`)
        return result
      }
      return null
    } catch (err) {
      logger.error(`[MatrixCrypto] 创建安全备份失败: ${err}`)
      throw err
    }
  }

  async verifySecureBackup(backupId: string, passphrase: string): Promise<boolean> {
    try {
      const secureBackupManager = cryptoSDKAdapter.getManagerAccessors().secureBackup()
      if (secureBackupManager) {
        const result = await secureBackupManager.verifySecureBackup(backupId, passphrase)
        logger.info(`[MatrixCrypto] 验证安全备份: ${result.valid}`)
        return result.valid
      }
      return false
    } catch (err) {
      logger.error(`[MatrixCrypto] 验证安全备份失败: ${err}`)
      return false
    }
  }

  async restoreFromSecureBackup(backupId: string, passphrase: string): Promise<SecureBackupRestoreResponse | null> {
    try {
      const secureBackupManager = cryptoSDKAdapter.getManagerAccessors().secureBackup()
      if (secureBackupManager) {
        const result = await secureBackupManager.restoreFromSecureBackup(backupId, passphrase)
        logger.info(`[MatrixCrypto] 从安全备份恢复: recovered=${result.recovered_keys}, total=${result.total_keys}`)
        return result
      }
      return null
    } catch (err) {
      logger.error(`[MatrixCrypto] 从安全备份恢复失败: ${err}`)
      throw err
    }
  }

  private async getSecureBackupList(): Promise<SecureBackupInfo[]> {
    try {
      const versions = await this.getBackupVersions()
      return versions.map((v) => ({
        backup_id: v.version,
        algorithm: v.algorithm,
        auth_data: v.auth_data,
        created_ts: 0,
        key_count: v.count,
        version: v.version
      }))
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取安全备份列表失败: ${err}`)
      return []
    }
  }

  async isRoomEncrypted(roomId: string): Promise<boolean> {
    try {
      return await cryptoSDKAdapter.isRoomEncrypted(roomId)
    } catch (err) {
      logger.error(`[MatrixCrypto] 检查房间加密状态失败: ${err}`)
      return false
    }
  }

  async enableEncryption(roomId: string, algorithm: EncryptionAlgorithm = 'm.megolm.v1.aes-sha2'): Promise<void> {
    try {
      await cryptoSDKAdapter.enableEncryption(roomId, algorithm)
      logger.info(`[MatrixCrypto] 启用房间加密: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 启用房间加密失败: ${err}`)
      throw err
    }
  }

  async requestVerification(userId: string, deviceId: string): Promise<string> {
    try {
      const request = await cryptoSDKAdapter.requestDeviceVerification(userId, deviceId)
      if (request) {
        logger.info(`[MatrixCrypto] 请求验证: ${userId}:${deviceId}`)
        return request.transactionId
      }
      return ''
    } catch (err) {
      logger.error(`[MatrixCrypto] 请求验证失败: ${err}`)
      throw err
    }
  }

  async getCrossSigningStatus(): Promise<CrossSigningStatus> {
    try {
      const result = await cryptoSDKAdapter.getCrossSigningStatus()
      return {
        privateKeysCached: result.privateKeysCached,
        crossSigningVerified: result.crossSigningVerified
      }
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取跨设备签名状态失败: ${err}`)
      return { privateKeysCached: false, crossSigningVerified: false }
    }
  }

  async uploadKeys(
    deviceKeys?: Record<string, unknown>,
    oneTimeKeys?: Record<string, unknown>,
    fallbackKeys?: Record<string, unknown>
  ): Promise<{ oneTimeKeyCounts: Record<string, number> }> {
    try {
      const manager = cryptoSDKAdapter.requireSDKDeviceKeysManager()
      const requestBody: Record<string, unknown> = {
        // biome-ignore lint/suspicious/noExplicitAny: Service layer uses generic types; SDK expects DeviceKeys/OneTimeKeys
        deviceKeys: deviceKeys as any,
        // biome-ignore lint/suspicious/noExplicitAny: Service layer uses generic types; SDK expects DeviceKeys/OneTimeKeys
        oneTimeKeys: oneTimeKeys as any
      }
      if (fallbackKeys) {
        requestBody.fallback_keys = fallbackKeys
      }
      // biome-ignore lint/suspicious/noExplicitAny: SDK expects DeviceKeys/OneTimeKeys types
      const result = await manager.uploadKeys(requestBody as any)
      logger.info('[MatrixCrypto] 上传密钥成功')
      return { oneTimeKeyCounts: result.one_time_key_counts ?? {} }
    } catch (err) {
      logger.error(`[MatrixCrypto] 上传密钥失败: ${err}`)
      throw err
    }
  }

  async queryKeys(userIds: string[], _timeout?: number): Promise<Record<string, unknown>> {
    try {
      const manager = cryptoSDKAdapter.requireSDKDeviceKeysManager()
      const deviceKeys: Record<string, string[]> = {}
      for (const userId of userIds) {
        deviceKeys[userId] = []
      }
      const result = await manager.queryKeys({
        device_keys: deviceKeys
      })
      logger.info(`[MatrixCrypto] 查询密钥成功: ${userIds.length} 个用户`)
      return result as unknown as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixCrypto] 查询密钥失败: ${err}`)
      throw err
    }
  }

  async claimKeys(claims: Record<string, Record<string, string>>): Promise<Record<string, unknown>> {
    try {
      const manager = cryptoSDKAdapter.requireSDKDeviceKeysManager()
      const result = await manager.claimKeys({ one_time_keys: claims })
      logger.info('[MatrixCrypto] 声明密钥成功')
      return result as unknown as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixCrypto] 声明密钥失败: ${err}`)
      throw err
    }
  }

  async getKeyChanges(fromToken: string, toToken: string): Promise<{ changed: string[]; left: string[] }> {
    try {
      const manager = cryptoSDKAdapter.requireSDKDeviceKeysManager()
      const result = await manager.getKeyChanges(fromToken, toToken)
      return {
        changed: result.changed ?? [],
        left: result.left ?? []
      }
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取密钥变化失败: ${err}`)
      return { changed: [], left: [] }
    }
  }

  async sendToDevice(eventType: string, contentMap: Record<string, Record<string, unknown>>): Promise<void> {
    try {
      const manager = cryptoSDKAdapter.requireSDKDeviceKeysManager()
      const txnId = `txn_${Date.now()}`
      await manager.sendToDevice(eventType, txnId, contentMap as Parameters<typeof manager.sendToDevice>[2])
      logger.info(`[MatrixCrypto] 发送ToDevice消息成功: ${eventType}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 发送ToDevice消息失败: ${err}`)
      throw err
    }
  }

  async uploadSignatures(signatures: Record<string, unknown>): Promise<void> {
    try {
      const manager = cryptoSDKAdapter.requireSDKDeviceKeysManager()
      await manager.uploadSignatures(signatures as Parameters<typeof manager.uploadSignatures>[0])
      logger.info('[MatrixCrypto] 上传签名成功')
    } catch (err) {
      logger.error(`[MatrixCrypto] 上传签名失败: ${err}`)
      throw err
    }
  }

  async uploadDeviceSigningKeys(
    masterKey?: Record<string, unknown>,
    selfSigningKey?: Record<string, unknown>,
    userSigningKey?: Record<string, unknown>,
    auth?: Record<string, unknown>
  ): Promise<void> {
    try {
      const manager = cryptoSDKAdapter.requireSDKDeviceKeysManager()
      const keys: Record<string, unknown> = {}
      if (masterKey) keys.master_key = masterKey
      if (selfSigningKey) keys.self_signing_key = selfSigningKey
      if (userSigningKey) keys.user_signing_key = userSigningKey
      if (auth) keys.auth = auth
      await manager.uploadDeviceSigning(keys as Parameters<typeof manager.uploadDeviceSigning>[0])
      logger.info('[MatrixCrypto] 上传设备签名密钥成功')
    } catch (err) {
      logger.error(`[MatrixCrypto] 上传设备签名密钥失败: ${err}`)
      throw err
    }
  }

  async createRoomKeyRequest(
    roomId: string,
    sessionId: string,
    algorithm: string,
    _devices: Record<string, string[]>
  ): Promise<void> {
    try {
      const manager = cryptoSDKAdapter.requireSDKDeviceKeysManager()
      await manager.createRoomKeyRequest({
        room_id: roomId,
        session_id: sessionId,
        algorithm,
        request_id: `req_${Date.now()}`
      })
      logger.info(`[MatrixCrypto] 创建房间密钥请求成功: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 创建房间密钥请求失败: ${err}`)
      throw err
    }
  }

  // ============================================
  // Key Backup REST API (契约 key-backup.md)
  // ============================================

  async getBackupVersions(): Promise<KeyBackupVersionInfo[]> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.getBackupVersions()
      const versions = result.versions
      if (!Array.isArray(versions) && versions && typeof versions === 'object') {
        return [versions as unknown as KeyBackupVersionInfo]
      }
      return versions as unknown as KeyBackupVersionInfo[]
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取备份版本列表失败: ${err}`)
      return []
    }
  }

  async createBackupVersion(
    algorithm: string,
    authData: Record<string, unknown>,
    auth?: Record<string, unknown>
  ): Promise<KeyBackupVersionInfo> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.createBackupVersion(
        algorithm,
        authData as unknown as Parameters<typeof manager.createBackupVersion>[1],
        auth as Parameters<typeof manager.createBackupVersion>[2]
      )
      return { version: result.version, algorithm, auth_data: authData } as KeyBackupVersionInfo
    } catch (err) {
      logger.error(`[MatrixCrypto] 创建备份版本失败: ${err}`)
      throw err
    }
  }

  async getBackupVersion(version: string): Promise<KeyBackupVersionInfo | null> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.getBackupVersion(version)
      return result as unknown as KeyBackupVersionInfo
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取备份版本失败: ${err}`)
      return null
    }
  }

  async updateBackupVersion(version: string, _algorithm: string, authData: Record<string, unknown>): Promise<void> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      await manager.updateBackupVersion(
        version,
        authData as unknown as Parameters<typeof manager.updateBackupVersion>[1]
      )
      logger.info(`[MatrixCrypto] 更新备份版本成功: ${version}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 更新备份版本失败: ${err}`)
      throw err
    }
  }

  async deleteBackupVersionViaApi(version: string): Promise<void> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      await manager.deleteBackupVersion(version)
      logger.info(`[MatrixCrypto] 删除备份版本成功: ${version}`)
    } catch (err) {
      logger.error(`[MatrixCrypto] 删除备份版本失败: ${err}`)
      throw err
    }
  }

  async getAllRoomKeys(version: string): Promise<RoomKeysResponse | null> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.getAllRoomKeys(version)
      return result as unknown as RoomKeysResponse
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取所有房间密钥失败: ${err}`)
      return null
    }
  }

  async addAllRoomKeys(version: string, rooms: RoomKeysResponse['rooms']): Promise<KeyBackupWriteResult> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.putAllRoomKeys(version, { rooms } as Parameters<typeof manager.putAllRoomKeys>[1])
      logger.info(`[MatrixCrypto] 添加所有房间密钥成功: etag=${result.etag}, count=${result.count}`)
      return result as unknown as KeyBackupWriteResult
    } catch (err) {
      logger.error(`[MatrixCrypto] 添加所有房间密钥失败: ${err}`)
      throw err
    }
  }

  async deleteAllRoomKeys(version: string): Promise<KeyBackupWriteResult> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.deleteAllRoomKeys(version)
      logger.info(`[MatrixCrypto] 删除所有房间密钥成功: etag=${result.etag}`)
      return result as unknown as KeyBackupWriteResult
    } catch (err) {
      logger.error(`[MatrixCrypto] 删除所有房间密钥失败: ${err}`)
      throw err
    }
  }

  async getRoomKeys(version: string, roomId: string): Promise<RoomKeySessionsResponse | null> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.getRoomKeys(version, roomId)
      return result as unknown as RoomKeySessionsResponse
    } catch {
      logger.error(`[MatrixCrypto] 获取房间密钥失败: ${roomId}`)
      return null
    }
  }

  async addRoomKeys(
    version: string,
    roomId: string,
    sessions: RoomKeySessionsResponse['sessions']
  ): Promise<KeyBackupWriteResult> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.putRoomKeys(version, roomId, { sessions } as Parameters<
        typeof manager.putRoomKeys
      >[2])
      logger.info(`[MatrixCrypto] 添加房间密钥成功: ${roomId}, count=${result.count}`)
      return result as unknown as KeyBackupWriteResult
    } catch (err) {
      logger.error(`[MatrixCrypto] 添加房间密钥失败: ${roomId}`)
      throw err
    }
  }

  async deleteRoomKeys(version: string, roomId: string): Promise<KeyBackupWriteResult> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.deleteRoomKeys(version, roomId)
      logger.info(`[MatrixCrypto] 删除房间密钥成功: ${roomId}`)
      return result as unknown as KeyBackupWriteResult
    } catch (err) {
      logger.error(`[MatrixCrypto] 删除房间密钥失败: ${roomId}`)
      throw err
    }
  }

  async getSessionKey(version: string, roomId: string, sessionId: string): Promise<SessionKeyData | null> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.getSessionKey(version, roomId, sessionId)
      return result as unknown as SessionKeyData
    } catch {
      logger.error(`[MatrixCrypto] 获取会话密钥失败: ${roomId}/${sessionId}`)
      return null
    }
  }

  async addSessionKey(
    version: string,
    roomId: string,
    sessionId: string,
    sessionData: SessionKeyData
  ): Promise<KeyBackupWriteResult> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.putSessionKey(
        version,
        roomId,
        sessionId,
        sessionData as Parameters<typeof manager.putSessionKey>[3]
      )
      logger.info(`[MatrixCrypto] 添加会话密钥成功: ${roomId}/${sessionId}`)
      return result as unknown as KeyBackupWriteResult
    } catch (err) {
      logger.error(`[MatrixCrypto] 添加会话密钥失败: ${roomId}/${sessionId}`)
      throw err
    }
  }

  async deleteSessionKey(version: string, roomId: string, sessionId: string): Promise<KeyBackupWriteResult> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.deleteSessionKey(version, roomId, sessionId)
      logger.info(`[MatrixCrypto] 删除会话密钥成功: ${roomId}/${sessionId}`)
      return result as unknown as KeyBackupWriteResult
    } catch (err) {
      logger.error(`[MatrixCrypto] 删除会话密钥失败: ${roomId}/${sessionId}`)
      throw err
    }
  }

  async recoverKey(
    version: string,
    roomId: string,
    sessionId: string,
    _sessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    try {
      const available = await endpointCapabilityService.check('POST', MATRIX_PATHS.CRYPTO.ROOM_KEYS_RECOVER)
      if (!available) {
        logger.warn('[MatrixCrypto] 密钥恢复端点不可用')
        return null
      }

      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.recoverKeys(version, roomId ? [roomId] : undefined)
      logger.info(`[MatrixCrypto] 恢复密钥成功: ${roomId}/${sessionId}`)
      return result as unknown as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixCrypto] 恢复密钥失败: ${err}`)
      return null
    }
  }

  async getRecoveryProgress(version: string): Promise<RecoveryProgress | null> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.getRecoveryProgress(version)
      return result as unknown as RecoveryProgress
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取恢复进度失败: ${err}`)
      return null
    }
  }

  async verifyBackupVersion(version: string): Promise<BackupVerifyResult | null> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.verifyBackup(version)
      logger.info(`[MatrixCrypto] 验证备份版本: ${version}, valid=${result.valid}`)
      return result as unknown as BackupVerifyResult
    } catch (err) {
      logger.error(`[MatrixCrypto] 验证备份版本失败: ${err}`)
      return null
    }
  }

  async batchRecoverKeys(
    version: string,
    sessions: Array<{ room_id: string; session_id: string; session_data: Record<string, unknown> }>
  ): Promise<BatchRecoverResult | null> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const roomIds = [...new Set(sessions.map((s) => s.room_id))]
      const result = await manager.batchRecover(version, roomIds)
      logger.info(`[MatrixCrypto] 批量恢复密钥: ${result.total_sessions} 个会话`)
      return result as unknown as BatchRecoverResult
    } catch (err) {
      logger.error(`[MatrixCrypto] 批量恢复密钥失败: ${err}`)
      return null
    }
  }

  async recoverRoomKeys(version: string, roomId: string): Promise<Record<string, unknown> | null> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.recoverRoomKeys(version, roomId)
      return result as unknown as Record<string, unknown>
    } catch {
      logger.error(`[MatrixCrypto] 恢复房间密钥失败: ${roomId}`)
      return null
    }
  }

  async recoverSessionKey(version: string, roomId: string, sessionId: string): Promise<Record<string, unknown> | null> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.recoverSessionKey(version, roomId, sessionId)
      return result as unknown as Record<string, unknown>
    } catch {
      logger.error(`[MatrixCrypto] 恢复会话密钥失败: ${roomId}/${sessionId}`)
      return null
    }
  }

  async exportRoomKeysByVersion(version?: string): Promise<Array<Record<string, unknown>>> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.exportKeys(version)
      logger.info(`[MatrixCrypto] 导出密钥成功: ${result.room_keys.length} 个, version=${version ?? 'latest'}`)
      return result.room_keys as Array<Record<string, unknown>>
    } catch (err) {
      logger.error(`[MatrixCrypto] 导出密钥失败: ${err}`)
      return []
    }
  }

  async importRoomKeysByVersion(
    keys: Array<Record<string, unknown>>,
    version?: string
  ): Promise<KeyBackupWriteResult | null> {
    try {
      const manager = cryptoSDKAdapter.requireSDKKeyBackupManager()
      const result = await manager.importKeys(keys as Parameters<typeof manager.importKeys>[0], version)
      logger.info(`[MatrixCrypto] 导入密钥成功: count=${result.count}, version=${version ?? 'latest'}`)
      return { etag: '', count: result.count } as KeyBackupWriteResult
    } catch (err) {
      logger.error(`[MatrixCrypto] 导入密钥失败: ${err}`)
      return null
    }
  }

  // ============================================
  // SAS/QR Verification REST API (契约 verification.md)
  // ============================================

  private sasEndpointAvailable: boolean | null = null

  private async isSasEndpointAvailable(): Promise<boolean> {
    if (this.sasEndpointAvailable !== null) return this.sasEndpointAvailable
    this.sasEndpointAvailable = await endpointCapabilityService.check('POST', MATRIX_PATHS.CRYPTO.VERIFY_START)
    return this.sasEndpointAvailable
  }

  async startSasVerification(
    toUser: string,
    toDevice?: string,
    transactionId?: string,
    method?: string
  ): Promise<SasVerificationStartResponse | null> {
    try {
      const available = await this.isSasEndpointAvailable()
      if (!available) {
        logger.warn('[MatrixCrypto] SAS 验证端点不可用，使用标准 to-device 协议')
        return null
      }

      const manager = cryptoSDKAdapter.requireSDKKeyVerificationManager()
      const result = await manager.startDeviceSigningVerification({
        from_device: this.getClient().getDeviceId() ?? '',
        to_user: toUser,
        to_device: toDevice,
        transaction_id: transactionId,
        method: method ?? 'm.sas.v1'
      } as Parameters<typeof manager.startDeviceSigningVerification>[0])
      logger.info(`[MatrixCrypto] SAS验证已启动: txn=${result.transaction_id}`)
      return result as unknown as SasVerificationStartResponse
    } catch (err) {
      logger.error(`[MatrixCrypto] 启动SAS验证失败: ${err}`)
      return null
    }
  }

  async acceptVerification(
    transactionId: string,
    keyAgreementProtocol: string,
    hash: string,
    _shortAuthenticationString: string[],
    commitment?: string
  ): Promise<SasVerificationAcceptResponse | null> {
    try {
      const available = await this.isSasEndpointAvailable()
      if (!available) {
        logger.warn('[MatrixCrypto] SAS 验证端点不可用')
        return null
      }

      const manager = cryptoSDKAdapter.requireSDKKeyVerificationManager()
      const result = await manager.acceptDeviceSigningVerification({
        transaction_id: transactionId,
        key_agreement_protocol: keyAgreementProtocol,
        hash,
        commitment
      } as Parameters<typeof manager.acceptDeviceSigningVerification>[0])
      logger.info(`[MatrixCrypto] 接受验证: txn=${transactionId}`)
      return result as unknown as SasVerificationAcceptResponse
    } catch (err) {
      logger.error(`[MatrixCrypto] 接受验证失败: ${err}`)
      return null
    }
  }

  async exchangeKeys(transactionId: string, pubkey: string): Promise<SasKeyAgreementResponse | null> {
    try {
      if (!(await this.isSasEndpointAvailable())) return null
      const manager = cryptoSDKAdapter.requireSDKKeyVerificationManager()
      const result = await manager.sendDeviceSigningVerificationKeyAgreement({
        transaction_id: transactionId,
        pubkey
      })
      logger.info(`[MatrixCrypto] 密钥交换: txn=${transactionId}, confirmed=${result.confirmed}`)
      return result as unknown as SasKeyAgreementResponse
    } catch (err) {
      logger.error(`[MatrixCrypto] 密钥交换失败: ${err}`)
      return null
    }
  }

  async confirmMac(transactionId: string, mac: string | Record<string, string>): Promise<SasMacResponse | null> {
    try {
      if (!(await this.isSasEndpointAvailable())) return null
      const manager = cryptoSDKAdapter.requireSDKKeyVerificationManager()
      const macValue = typeof mac === 'object' ? JSON.stringify(mac) : mac
      const result = await manager.confirmDeviceSigningVerificationMac({
        transaction_id: transactionId,
        mac: macValue as Parameters<typeof manager.confirmDeviceSigningVerificationMac>[0]['mac']
      } as Parameters<typeof manager.confirmDeviceSigningVerificationMac>[0])
      logger.info(`[MatrixCrypto] 确认MAC: txn=${transactionId}, verified=${result.verified}`)
      return result as unknown as SasMacResponse
    } catch (err) {
      logger.error(`[MatrixCrypto] 确认MAC失败: ${err}`)
      return null
    }
  }

  async completeVerification(transactionId: string): Promise<SasDoneResponse | null> {
    try {
      if (!(await this.isSasEndpointAvailable())) return null
      const manager = cryptoSDKAdapter.requireSDKKeyVerificationManager()
      const result = await manager.completeDeviceSigningVerification({
        transaction_id: transactionId
      })
      logger.info(`[MatrixCrypto] 验证完成: txn=${transactionId}`)
      return result as unknown as SasDoneResponse
    } catch (err) {
      logger.error(`[MatrixCrypto] 完成验证失败: ${err}`)
      return null
    }
  }

  async cancelVerification(transactionId: string, reason?: string): Promise<SasCancelResponse | null> {
    try {
      if (!(await this.isSasEndpointAvailable())) return null
      const manager = cryptoSDKAdapter.requireSDKKeyVerificationManager()
      const result = await manager.cancelDeviceSigningVerification({
        transaction_id: transactionId,
        code: 'm.user',
        reason: reason ?? 'Cancelled by user'
      })
      logger.info(`[MatrixCrypto] 取消验证: txn=${transactionId}, cancelled=true`)
      return { transaction_id: result.transaction_id as string, cancelled: result.state === 'cancelled' }
    } catch (err) {
      logger.error(`[MatrixCrypto] 取消验证失败: ${err}`)
      return null
    }
  }

  async listPendingVerifications(): Promise<PendingVerificationRequest[]> {
    try {
      if (!(await this.isSasEndpointAvailable())) return []
      const manager = cryptoSDKAdapter.requireSDKKeyVerificationManager()
      const result = await manager.getVerificationRequestsHttp()
      return (result.requests ?? []) as unknown as PendingVerificationRequest[]
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取待处理验证请求失败: ${err}`)
      return []
    }
  }

  async showQrCode(): Promise<QrCodeShowResponse | null> {
    try {
      const available = await endpointCapabilityService.check('GET', MATRIX_PATHS.CRYPTO.QR_CODE_SHOW)
      if (!available) {
        logger.warn('[MatrixCrypto] QR 码验证端点不可用')
        return null
      }

      const manager = cryptoSDKAdapter.requireSDKKeyVerificationManager()
      const result = await manager.showQrCodeHttp()
      logger.info(`[MatrixCrypto] 获取二维码: txn=${result.transaction_id}`)
      return result as unknown as QrCodeShowResponse
    } catch (err) {
      logger.error(`[MatrixCrypto] 获取二维码失败: ${err}`)
      return null
    }
  }

  async scanQrCode(
    transactionId: string,
    serverName: string,
    userId: string,
    deviceId: string,
    deviceEd25519Key: string,
    deviceCurve25519Key: string
  ): Promise<QrCodeScanResponse | null> {
    try {
      const available = await endpointCapabilityService.check('POST', MATRIX_PATHS.CRYPTO.QR_CODE_SCAN)
      if (!available) {
        logger.warn('[MatrixCrypto] QR 码扫描端点不可用')
        return null
      }

      const manager = cryptoSDKAdapter.requireSDKKeyVerificationManager()
      const result = await manager.scanQrCodeHttp({
        transaction_id: transactionId,
        server_name: serverName,
        user_id: userId,
        device_id: deviceId,
        device_ed25519_key: deviceEd25519Key,
        device_curve25519_key: deviceCurve25519Key
      })
      logger.info(`[MatrixCrypto] 扫描二维码: txn=${result.transaction_id}, state=${result.state}`)
      return result as unknown as QrCodeScanResponse
    } catch (err) {
      logger.error(`[MatrixCrypto] 扫描二维码失败: ${err}`)
      return null
    }
  }
}

const matrixCryptoService = new MatrixCryptoService()
export default matrixCryptoService
export { matrixCryptoService }
