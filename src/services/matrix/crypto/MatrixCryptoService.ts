import { error, info, warn } from '@tauri-apps/plugin-log'
import type {
  CryptoApi,
  DeviceTrustManager,
  ISecuritySummary,
  KeyBackupManager,
  LegacyStoredDevice,
  MatrixClientExtended,
  SecureBackupInfo,
  SecureBackupManager,
  SecureBackupRestoreResponse,
  VerificationRequest
} from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import endpointCapabilityService from '../EndpointCapabilityService'
import { MATRIX_PATHS } from '../paths'

const logger = createLogger('MatrixCryptoService')

export interface DeviceInfo {
  deviceId: string
  userId: string
  displayName?: string
  lastSeenTs?: number
  lastSeenIp?: string
  isVerified?: boolean
}

export interface VerificationStatus {
  verified: boolean
  crossSigningVerified: boolean
  devicesCrossSigningVerified: boolean
}

export interface CrossSigningStatus {
  privateKeysCached: boolean
  crossSigningVerified: boolean
}

export type EncryptionAlgorithm = 'm.megolm.v1.aes-sha2' | 'm.olm.v1.curve25519-aes-sha2'

export interface KeyBackupData {
  version: string
  algorithm: string
  auth_data: Record<string, unknown>
  count?: number
  etag?: string
}

export interface KeyBackupVersionInfo {
  version: string
  algorithm: string
  auth_data: Record<string, unknown>
  count?: number
  etag?: string
}

export interface KeyBackupWriteResult {
  etag: string
  count: number
}

export interface RoomKeysResponse {
  rooms: Record<
    string,
    {
      sessions: Record<string, SessionKeyData>
    }
  >
}

export interface RoomKeySessionsResponse {
  sessions: Record<string, SessionKeyData>
}

export interface SessionKeyData {
  first_message_index: number
  forwarded_count: number
  is_verified: boolean
  session_data: {
    ciphertext?: string
    mac?: string
    ephemeral?: string
  }
}

export interface RecoveryProgress {
  total: number
  recovered: number
  failed: number
  percentage: number
}

export interface BackupVerifyResult {
  valid: boolean
  mismatch_count?: number
  message?: string
}

export interface BatchRecoverResult {
  total: number
  recovered: number
  failed: number
  errors?: Array<{ room_id: string; session_id: string; error: string }>
}

export interface SasVerificationStartResponse {
  transaction_id: string
  method: string
  key_agreement_protocol: string
  hash: string
  short_authentication_string: string[]
}

export interface SasVerificationAcceptResponse {
  transaction_id: string
  method: string
  key_agreement_protocol: string
  hash: string
  short_authentication_string: string[]
  commitment?: string
}

export interface SasKeyAgreementResponse {
  transaction_id: string
  confirmed: boolean
  short_authentication_string: Record<string, unknown>
}

export interface SasMacResponse {
  transaction_id: string
  verified: boolean
}

export interface SasDoneResponse {
  transaction_id: string
}

export interface SasCancelResponse {
  transaction_id: string
  cancelled: boolean
}

export interface PendingVerificationRequest {
  transaction_id: string
  from_device: string
  methods: string[]
  timestamp?: number
}

export interface QrCodeShowResponse {
  transaction_id: string
  server_name: string
  user_id: string
  device_id: string
  device_ed25519_key: string
  device_curve25519_key: string
}

export interface QrCodeScanResponse {
  transaction_id: string
  state: string
}

class MatrixCryptoService extends BaseMatrixService {
  private crypto: CryptoApi | null = null

  private getExtendedClient(): MatrixClientExtended {
    return this.getClient() as unknown as MatrixClientExtended
  }

  private getCrypto(): CryptoApi | null {
    if (this.crypto) {
      return this.crypto
    }
    const client = this.getExtendedClient()
    this.crypto = client.getCrypto()
    return this.crypto
  }

  private getDeviceTrustManager(): DeviceTrustManager | null {
    const client = this.getExtendedClient()
    return client.getDeviceTrustManager?.() ?? null
  }

  private getSecureBackupManager(): SecureBackupManager | null {
    const client = this.getExtendedClient()
    return client.getSecureBackupManager?.() ?? null
  }

  private getKeyBackupManager(): KeyBackupManager | null {
    const client = this.getExtendedClient()
    return client.getKeyBackupManager?.() ?? null
  }

  async initializeCrypto(): Promise<void> {
    const client = this.getExtendedClient()
    try {
      const crypto = client.getCrypto()
      if (crypto) {
        this.crypto = crypto
        info('[MatrixCrypto] 加密模块初始化成功')
      } else {
        warn('[MatrixCrypto] 加密模块未启用')
      }
    } catch (err) {
      error(`[MatrixCrypto] 加密模块初始化失败: ${err}`)
      throw err
    }
  }

  async getCryptoStatus(): Promise<{ crossSigningReady: boolean; keyBackupEnabled: boolean } | null> {
    try {
      const crypto = this.getCrypto()
      if (!crypto) return null

      let crossSigningReady = false
      let keyBackupEnabled = false

      try {
        crossSigningReady = await crypto.isCrossSigningReady()
      } catch (err) {
        logger.warn('Check cross-signing ready failed:', err)
      }

      try {
        const backupManager = this.getKeyBackupManager()
        if (backupManager) {
          const backupInfo = await backupManager.checkKeyBackup()
          keyBackupEnabled = backupInfo !== null
        }
      } catch (err) {
        logger.warn('Check key backup status failed:', err)
      }

      return { crossSigningReady, keyBackupEnabled }
    } catch (err) {
      error(`[MatrixCrypto] 获取加密状态失败: ${err}`)
      return null
    }
  }

  async getDevices(userId: string): Promise<DeviceInfo[]> {
    try {
      const trustManager = this.getDeviceTrustManager()
      if (trustManager) {
        const trustList = await trustManager.getDeviceTrustList()
        return trustList
          .filter((d) => d.user_id === userId)
          .map((d) => ({
            deviceId: d.device_id,
            userId: d.user_id,
            displayName: d.display_name,
            lastSeenTs: d.last_seen_ts,
            lastSeenIp: d.last_seen_ip,
            isVerified: d.is_verified
          }))
      }

      const client = this.getExtendedClient()
      if (typeof client.getStoredDevicesForUser === 'function') {
        const devices = await client.getStoredDevicesForUser(userId)
        return devices.map((device: LegacyStoredDevice) => ({
          deviceId: device.deviceId,
          userId: device.userId,
          displayName: device.displayName,
          isVerified: device.isVerified()
        }))
      }

      return []
    } catch (err) {
      error(`[MatrixCrypto] 获取设备列表失败: ${err}`)
      throw err
    }
  }

  async getDevice(userId: string, deviceId: string): Promise<DeviceInfo | null> {
    try {
      const trustManager = this.getDeviceTrustManager()
      if (trustManager) {
        const trustInfo = await trustManager.getDeviceTrust(deviceId)
        if (!trustInfo) return null
        return {
          deviceId: trustInfo.device_id,
          userId: trustInfo.user_id,
          displayName: trustInfo.display_name,
          lastSeenTs: trustInfo.last_seen_ts,
          lastSeenIp: trustInfo.last_seen_ip,
          isVerified: trustInfo.is_verified
        }
      }

      const client = this.getExtendedClient()
      if (typeof client.getStoredDevice === 'function') {
        const device = client.getStoredDevice(userId, deviceId)
        if (!device) return null
        return {
          deviceId: device.deviceId,
          userId: device.userId,
          displayName: device.displayName,
          isVerified: device.isVerified()
        }
      }

      return null
    } catch (err) {
      error(`[MatrixCrypto] 获取设备信息失败: ${err}`)
      throw err
    }
  }

  async verifyDevice(userId: string, deviceId: string): Promise<void> {
    try {
      const crypto = this.getCrypto()
      if (crypto) {
        await crypto.setDeviceVerified(userId, deviceId)
        info(`[MatrixCrypto] 设备验证成功: ${userId}:${deviceId}`)
        return
      }

      const client = this.getExtendedClient()
      if (typeof client.setDeviceVerified === 'function') {
        await client.setDeviceVerified(userId, deviceId)
        info(`[MatrixCrypto] 设备验证成功(legacy): ${userId}:${deviceId}`)
      }
    } catch (err) {
      error(`[MatrixCrypto] 设备验证失败: ${err}`)
      throw err
    }
  }

  async unverifyDevice(userId: string, deviceId: string): Promise<void> {
    try {
      const crypto = this.getCrypto()
      if (crypto) {
        await crypto.setDeviceKnown(userId, deviceId)
        info(`[MatrixCrypto] 取消设备验证: ${userId}:${deviceId}`)
        return
      }

      const client = this.getExtendedClient()
      if (typeof client.setDeviceKnown === 'function') {
        await client.setDeviceKnown(userId, deviceId)
        info(`[MatrixCrypto] 取消设备验证(legacy): ${userId}:${deviceId}`)
      }
    } catch (err) {
      error(`[MatrixCrypto] 取消设备验证失败: ${err}`)
      throw err
    }
  }

  async getDeviceVerificationStatus(userId: string, deviceId: string): Promise<VerificationStatus> {
    try {
      const crypto = this.getCrypto()
      if (crypto) {
        const status = await crypto.getDeviceVerificationStatus(userId, deviceId)
        return {
          verified: status.isVerified(),
          crossSigningVerified: status.isCrossSigningVerified(),
          devicesCrossSigningVerified: status.isCrossSigningVerified()
        }
      }

      const client = this.getExtendedClient()
      if (typeof client.checkDeviceTrust === 'function') {
        const trust = await client.checkDeviceTrust(userId, deviceId)
        return {
          verified: trust.isVerified(),
          crossSigningVerified: trust.isCrossSigningVerified(),
          devicesCrossSigningVerified: trust.isCrossSigningVerified()
        }
      }

      return {
        verified: false,
        crossSigningVerified: false,
        devicesCrossSigningVerified: false
      }
    } catch (err) {
      error(`[MatrixCrypto] 获取设备验证状态失败: ${err}`)
      throw err
    }
  }

  async requestDeviceVerification(userId: string, deviceId: string): Promise<VerificationRequest | null> {
    try {
      const trustManager = this.getDeviceTrustManager()
      if (trustManager) {
        const response = await trustManager.requestVerification({
          new_device_id: deviceId,
          device_id: this.getClient().getDeviceId() ?? '',
          method: 'sas'
        })
        info(`[MatrixCrypto] 设备验证请求已发送: ${userId}:${deviceId}, token: ${response.token}`)
        return null
      }

      const crypto = this.getCrypto()
      if (crypto) {
        const request = await crypto.requestDeviceVerification(userId, deviceId)
        info(`[MatrixCrypto] 设备验证请求已发送(SDK): ${userId}:${deviceId}`)
        return request
      }

      return null
    } catch (err) {
      error(`[MatrixCrypto] 请求设备验证失败: ${err}`)
      throw err
    }
  }

  async respondToDeviceVerification(token: string, approved: boolean): Promise<boolean> {
    try {
      const trustManager = this.getDeviceTrustManager()
      if (trustManager) {
        const result = await trustManager.respondToVerification(token, approved)
        info(`[MatrixCrypto] 设备验证响应: token=${token}, approved=${approved}, success=${result.success}`)
        return result.success
      }
      return false
    } catch (err) {
      error(`[MatrixCrypto] 响应设备验证失败: ${err}`)
      throw err
    }
  }

  async getSecuritySummary(): Promise<ISecuritySummary | null> {
    try {
      const trustManager = this.getDeviceTrustManager()
      if (trustManager) {
        return await trustManager.getSecuritySummary()
      }
      return null
    } catch (err) {
      error(`[MatrixCrypto] 获取安全摘要失败: ${err}`)
      return null
    }
  }

  async backupKeys(): Promise<void> {
    try {
      const backupManager = this.getKeyBackupManager()
      if (backupManager) {
        const backupInfo = await backupManager.checkKeyBackup()
        if (!backupInfo) {
          const crypto = this.getCrypto()
          if (crypto) {
            await crypto.resetKeyBackup()
            info('[MatrixCrypto] 创建新的密钥备份')
          }
        } else {
          info('[MatrixCrypto] 密钥备份已存在')
        }
        backupManager.scheduleKeyBackupSend()
        return
      }

      const crypto = this.getCrypto()
      if (crypto) {
        const backupInfo = await crypto.getKeyBackupVersion()
        if (!backupInfo) {
          await crypto.resetKeyBackup()
          info('[MatrixCrypto] 创建新的密钥备份')
        } else {
          info('[MatrixCrypto] 密钥备份已存在')
        }
      }
    } catch (err) {
      error(`[MatrixCrypto] 备份密钥失败: ${err}`)
      throw err
    }
  }

  async setupKeyBackup(passphrase: string): Promise<void> {
    try {
      const secureBackupManager = this.getSecureBackupManager()
      if (secureBackupManager) {
        await secureBackupManager.createSecureBackup(passphrase)
        info('[MatrixCrypto] 安全密钥备份设置成功(passphrase加密)')
        return
      }

      const backupManager = this.getKeyBackupManager()
      if (backupManager) {
        const backupInfo = await backupManager.checkKeyBackup()
        if (!backupInfo) {
          const keyInfo = await backupManager.prepareKeyBackupVersion()
          await backupManager.createKeyBackupVersion({
            algorithm: keyInfo.algorithm,
            auth_data: keyInfo.auth_data
          })
        }
        backupManager.scheduleKeyBackupSend()
        info('[MatrixCrypto] 密钥备份设置成功')
        return
      }

      const crypto = this.getCrypto()
      if (crypto) {
        const backupInfo = await crypto.getKeyBackupVersion()
        if (!backupInfo) {
          await crypto.resetKeyBackup()
        }
        info('[MatrixCrypto] 密钥备份设置成功(基础)')
      }
    } catch (err) {
      error(`[MatrixCrypto] 设置密钥备份失败: ${err}`)
      throw err
    }
  }

  async restoreKeys(backupKey: string): Promise<void> {
    try {
      const secureBackupManager = this.getSecureBackupManager()
      if (secureBackupManager) {
        const backups = await this.getSecureBackupList()
        if (backups.length > 0) {
          const result = await secureBackupManager.restoreFromSecureBackup(backups[0].backup_id, backupKey)
          if (result.success) {
            info(`[MatrixCrypto] 安全恢复密钥成功: ${result.key_count} 个密钥`)
          } else {
            throw new Error(result.message ?? '恢复密钥失败')
          }
        }
        return
      }

      const backupManager = this.getKeyBackupManager()
      if (backupManager) {
        const backupInfo = await backupManager.checkKeyBackup()
        if (backupInfo) {
          const result = await backupManager.restoreKeyBackupWithRecoveryKey(backupKey)
          info(`[MatrixCrypto] 恢复密钥成功: ${result.imported}/${result.total}`)
        }
        return
      }

      const crypto = this.getCrypto()
      if (crypto) {
        const backupInfo = await crypto.getKeyBackupVersion()
        if (backupInfo) {
          await crypto.restoreKeyBackup(backupKey)
          info('[MatrixCrypto] 恢复密钥成功')
        }
      }
    } catch (err) {
      error(`[MatrixCrypto] 恢复密钥失败: ${err}`)
      throw err
    }
  }

  async exportKeys(passphrase: string): Promise<string> {
    try {
      const secureBackupManager = this.getSecureBackupManager()
      if (secureBackupManager) {
        const backups = await this.getSecureBackupList()
        if (backups.length > 0) {
          const backup = backups[0]
          const verifyResult = await secureBackupManager.verifySecureBackup(backup.backup_id, passphrase)
          if (!verifyResult.valid) {
            throw new Error(this.t('matrix_error.crypto.passphrase_verification_failed'))
          }
        }
      }

      const crypto = this.getCrypto()
      if (crypto) {
        const keys = await crypto.exportRoomKeys()
        const exportedData = JSON.stringify(keys)
        info('[MatrixCrypto] 导出密钥成功')
        return exportedData
      }
      return ''
    } catch (err) {
      error(`[MatrixCrypto] 导出密钥失败: ${err}`)
      throw err
    }
  }

  async importKeys(data: string, passphrase: string): Promise<void> {
    try {
      const keys = JSON.parse(data)
      const crypto = this.getCrypto()
      if (crypto) {
        const result = await crypto.importRoomKeys(keys)
        info(`[MatrixCrypto] 导入密钥成功: ${result.imported}/${result.total}`)

        const secureBackupManager = this.getSecureBackupManager()
        if (secureBackupManager && passphrase) {
          const backups = await this.getSecureBackupList()
          if (backups.length > 0) {
            info('[MatrixCrypto] 将导入的密钥同步到安全备份')
          }
        }
      }
    } catch (err) {
      error(`[MatrixCrypto] 导入密钥失败: ${err}`)
      throw err
    }
  }

  async createSecureBackup(passphrase: string): Promise<SecureBackupInfo | null> {
    try {
      const secureBackupManager = this.getSecureBackupManager()
      if (secureBackupManager) {
        const result = await secureBackupManager.createSecureBackup(passphrase)
        info(`[MatrixCrypto] 创建安全备份成功: ${result.backup_id}`)
        return result
      }
      return null
    } catch (err) {
      error(`[MatrixCrypto] 创建安全备份失败: ${err}`)
      throw err
    }
  }

  async verifySecureBackup(backupId: string, passphrase: string): Promise<boolean> {
    try {
      const secureBackupManager = this.getSecureBackupManager()
      if (secureBackupManager) {
        const result = await secureBackupManager.verifySecureBackup(backupId, passphrase)
        info(`[MatrixCrypto] 验证安全备份: ${result.valid}`)
        return result.valid
      }
      return false
    } catch (err) {
      error(`[MatrixCrypto] 验证安全备份失败: ${err}`)
      return false
    }
  }

  async restoreFromSecureBackup(backupId: string, passphrase: string): Promise<SecureBackupRestoreResponse | null> {
    try {
      const secureBackupManager = this.getSecureBackupManager()
      if (secureBackupManager) {
        const result = await secureBackupManager.restoreFromSecureBackup(backupId, passphrase)
        info(`[MatrixCrypto] 从安全备份恢复: success=${result.success}, key_count=${result.key_count}`)
        return result
      }
      return null
    } catch (err) {
      error(`[MatrixCrypto] 从安全备份恢复失败: ${err}`)
      throw err
    }
  }

  private async getSecureBackupList(): Promise<SecureBackupInfo[]> {
    try {
      const client = this.getClient()
      const response = (await client.http.authedRequest('GET', MATRIX_PATHS.CRYPTO.SECURE_BACKUP)) as Record<
        string,
        unknown
      >
      const backups: SecureBackupInfo[] = []
      if (response && typeof response === 'object') {
        for (const [id, data] of Object.entries(response)) {
          if (data && typeof data === 'object') {
            const d = data as Record<string, unknown>
            backups.push({
              backup_id: id,
              algorithm: (d.algorithm as string) ?? '',
              auth_data: (d.auth_data as Record<string, unknown>) ?? {},
              created_ts: (d.created_ts as number) ?? 0,
              key_count: d.key_count as number | undefined,
              version: (d.version as string) ?? id
            })
          }
        }
      }
      return backups
    } catch (err) {
      error(`[MatrixCrypto] 获取安全备份列表失败: ${err}`)
      return []
    }
  }

  async isRoomEncrypted(roomId: string): Promise<boolean> {
    const client = this.getClient()
    try {
      const room = client.getRoom(roomId)
      if (!room) return false
      const crypto = this.getCrypto()
      if (crypto) {
        return (room as unknown as { hasEncryptionStateEvent: () => boolean }).hasEncryptionStateEvent()
      }
      return false
    } catch (err) {
      error(`[MatrixCrypto] 检查房间加密状态失败: ${err}`)
      return false
    }
  }

  async enableEncryption(roomId: string, algorithm: EncryptionAlgorithm = 'm.megolm.v1.aes-sha2'): Promise<void> {
    const client = this.getClient()
    try {
      await client.sendStateEvent(roomId, 'm.room.encryption', { algorithm })
      info(`[MatrixCrypto] 启用房间加密: ${roomId}`)
    } catch (err) {
      error(`[MatrixCrypto] 启用房间加密失败: ${err}`)
      throw err
    }
  }

  async requestVerification(userId: string, deviceId: string): Promise<string> {
    try {
      const crypto = this.getCrypto()
      if (crypto) {
        const request = await crypto.requestDeviceVerification(userId, deviceId)
        info(`[MatrixCrypto] 请求验证: ${userId}:${deviceId}`)
        return request.transactionId
      }
      return ''
    } catch (err) {
      error(`[MatrixCrypto] 请求验证失败: ${err}`)
      throw err
    }
  }

  async getCrossSigningStatus(): Promise<CrossSigningStatus> {
    try {
      const crypto = this.getCrypto()
      if (!crypto) {
        return { privateKeysCached: false, crossSigningVerified: false }
      }

      let privateKeysCached = false
      let crossSigningVerified = false

      try {
        const status = await crypto.getCrossSigningStatus()
        privateKeysCached = status.crossSigningPrivateKeysInStorage
      } catch (err) {
        logger.warn('Get cross-signing status failed:', err)
      }

      try {
        crossSigningVerified = await crypto.isCrossSigningReady()
      } catch (err) {
        logger.warn('Check cross-signing ready failed:', err)
      }

      return { privateKeysCached, crossSigningVerified }
    } catch (err) {
      error(`[MatrixCrypto] 获取跨设备签名状态失败: ${err}`)
      return { privateKeysCached: false, crossSigningVerified: false }
    }
  }

  async uploadKeys(
    deviceKeys?: Record<string, unknown>,
    oneTimeKeys?: Record<string, unknown>
  ): Promise<{ oneTimeKeyCounts: Record<string, number> }> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest('POST', MATRIX_PATHS.CRYPTO.KEYS_UPLOAD, undefined, {
        device_keys: deviceKeys,
        one_time_keys: oneTimeKeys
      })) as Record<string, unknown>
      info('[MatrixCrypto] 上传密钥成功')
      return { oneTimeKeyCounts: (result.one_time_key_counts as Record<string, number>) ?? {} }
    } catch (err) {
      error(`[MatrixCrypto] 上传密钥失败: ${err}`)
      throw err
    }
  }

  async queryKeys(userIds: string[], timeout?: number): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const deviceKeys: Record<string, string[]> = {}
      for (const userId of userIds) {
        deviceKeys[userId] = []
      }
      const result = (await client.http.authedRequest('POST', MATRIX_PATHS.CRYPTO.KEYS_QUERY, undefined, {
        device_keys: deviceKeys,
        timeout: timeout ?? 10000
      })) as Record<string, unknown>
      info(`[MatrixCrypto] 查询密钥成功: ${userIds.length} 个用户`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 查询密钥失败: ${err}`)
      throw err
    }
  }

  async claimKeys(claims: Record<string, Record<string, string>>): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest('POST', MATRIX_PATHS.CRYPTO.KEYS_CLAIM, undefined, {
        one_time_keys: claims
      })) as Record<string, unknown>
      info('[MatrixCrypto] 声明密钥成功')
      return result
    } catch (err) {
      error(`[MatrixCrypto] 声明密钥失败: ${err}`)
      throw err
    }
  }

  async getKeyChanges(fromToken: string, toToken: string): Promise<{ changed: string[]; left: string[] }> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest('GET', MATRIX_PATHS.CRYPTO.KEYS_CHANGES, {
        from: fromToken,
        to: toToken
      })) as Record<string, unknown>
      return {
        changed: (result.changed as string[]) ?? [],
        left: (result.left as string[]) ?? []
      }
    } catch (err) {
      error(`[MatrixCrypto] 获取密钥变化失败: ${err}`)
      return { changed: [], left: [] }
    }
  }

  async sendToDevice(eventType: string, contentMap: Record<string, Record<string, unknown>>): Promise<void> {
    const client = this.getClient()
    try {
      const txnId = `txn_${Date.now()}`
      await client.http.authedRequest('PUT', MATRIX_PATHS.CRYPTO.SEND_TO_DEVICE(eventType, txnId), undefined, {
        messages: contentMap
      })
      info(`[MatrixCrypto] 发送ToDevice消息成功: ${eventType}`)
    } catch (err) {
      error(`[MatrixCrypto] 发送ToDevice消息失败: ${err}`)
      throw err
    }
  }

  async uploadSignatures(signatures: Record<string, unknown>): Promise<void> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('POST', MATRIX_PATHS.CRYPTO.SIGNATURES_UPLOAD, undefined, signatures)
      info('[MatrixCrypto] 上传签名成功')
    } catch (err) {
      error(`[MatrixCrypto] 上传签名失败: ${err}`)
      throw err
    }
  }

  async uploadDeviceSigningKeys(
    masterKey?: Record<string, unknown>,
    selfSigningKey?: Record<string, unknown>,
    userSigningKey?: Record<string, unknown>
  ): Promise<void> {
    const client = this.getClient()
    try {
      const body: Record<string, unknown> = {}
      if (masterKey) body.master_key = masterKey
      if (selfSigningKey) body.self_signing_key = selfSigningKey
      if (userSigningKey) body.user_signing_key = userSigningKey
      await client.http.authedRequest('POST', MATRIX_PATHS.CRYPTO.DEVICE_SIGNING_UPLOAD, undefined, body)
      info('[MatrixCrypto] 上传设备签名密钥成功')
    } catch (err) {
      error(`[MatrixCrypto] 上传设备签名密钥失败: ${err}`)
      throw err
    }
  }

  async createRoomKeyRequest(
    roomId: string,
    sessionId: string,
    algorithm: string,
    devices: Record<string, string[]>
  ): Promise<void> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('POST', MATRIX_PATHS.CRYPTO.ROOM_KEYS_REQUEST, undefined, {
        action: 'request',
        requesting_device_id: client.getDeviceId(),
        request_id: `req_${Date.now()}`,
        room_id: roomId,
        session_id: sessionId,
        algorithm,
        devices
      })
      info(`[MatrixCrypto] 创建房间密钥请求成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixCrypto] 创建房间密钥请求失败: ${err}`)
      throw err
    }
  }

  // ============================================
  // Key Backup REST API (契约 key-backup.md)
  // ============================================

  async getBackupVersions(): Promise<KeyBackupVersionInfo[]> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest('GET', MATRIX_PATHS.CRYPTO.ROOM_KEYS_VERSION)) as Record<
        string,
        unknown
      >
      if (Array.isArray(result)) {
        return result as KeyBackupVersionInfo[]
      }
      const versions = result.versions as KeyBackupVersionInfo[] | undefined
      if (versions) return versions
      return [result as unknown as KeyBackupVersionInfo]
    } catch (err) {
      error(`[MatrixCrypto] 获取备份版本列表失败: ${err}`)
      return []
    }
  }

  async createBackupVersion(
    algorithm: string,
    authData: Record<string, unknown>,
    auth?: Record<string, unknown>
  ): Promise<KeyBackupVersionInfo> {
    const client = this.getClient()
    try {
      const body: Record<string, unknown> = { algorithm, auth_data: authData }
      if (auth) body.auth = auth
      const result = (await client.http.authedRequest(
        'POST',
        MATRIX_PATHS.CRYPTO.ROOM_KEYS_VERSION,
        undefined,
        body
      )) as KeyBackupVersionInfo
      info(`[MatrixCrypto] 创建备份版本成功: ${result.version}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 创建备份版本失败: ${err}`)
      throw err
    }
  }

  async getBackupVersion(version: string): Promise<KeyBackupVersionInfo | null> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'GET',
        MATRIX_PATHS.CRYPTO.ROOM_KEYS_VERSION_BY_ID(version)
      )) as KeyBackupVersionInfo
      return result
    } catch (err) {
      error(`[MatrixCrypto] 获取备份版本失败: ${err}`)
      return null
    }
  }

  async updateBackupVersion(version: string, algorithm: string, authData: Record<string, unknown>): Promise<void> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('PUT', MATRIX_PATHS.CRYPTO.ROOM_KEYS_VERSION_BY_ID(version), undefined, {
        algorithm,
        auth_data: authData
      })
      info(`[MatrixCrypto] 更新备份版本成功: ${version}`)
    } catch (err) {
      error(`[MatrixCrypto] 更新备份版本失败: ${err}`)
      throw err
    }
  }

  async deleteBackupVersionViaApi(version: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('DELETE', MATRIX_PATHS.CRYPTO.ROOM_KEYS_VERSION_BY_ID(version))
      info(`[MatrixCrypto] 删除备份版本成功: ${version}`)
    } catch (err) {
      error(`[MatrixCrypto] 删除备份版本失败: ${err}`)
      throw err
    }
  }

  async getAllRoomKeys(version: string): Promise<RoomKeysResponse | null> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest('GET', MATRIX_PATHS.CRYPTO.ROOM_KEYS_KEYS, {
        version
      })) as RoomKeysResponse
      return result
    } catch (err) {
      error(`[MatrixCrypto] 获取所有房间密钥失败: ${err}`)
      return null
    }
  }

  async addAllRoomKeys(version: string, rooms: RoomKeysResponse['rooms']): Promise<KeyBackupWriteResult> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'PUT',
        MATRIX_PATHS.CRYPTO.ROOM_KEYS_KEYS,
        { version },
        { rooms }
      )) as KeyBackupWriteResult
      info(`[MatrixCrypto] 添加所有房间密钥成功: etag=${result.etag}, count=${result.count}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 添加所有房间密钥失败: ${err}`)
      throw err
    }
  }

  async deleteAllRoomKeys(version: string): Promise<KeyBackupWriteResult> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest('DELETE', MATRIX_PATHS.CRYPTO.ROOM_KEYS_KEYS, {
        version
      })) as KeyBackupWriteResult
      info(`[MatrixCrypto] 删除所有房间密钥成功: etag=${result.etag}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 删除所有房间密钥失败: ${err}`)
      throw err
    }
  }

  async getRoomKeys(version: string, roomId: string): Promise<RoomKeySessionsResponse | null> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest('GET', MATRIX_PATHS.CRYPTO.ROOM_KEYS_KEYS_BY_ROOM(roomId), {
        version
      })) as RoomKeySessionsResponse
      return result
    } catch {
      error(`[MatrixCrypto] 获取房间密钥失败: ${roomId}`)
      return null
    }
  }

  async addRoomKeys(
    version: string,
    roomId: string,
    sessions: RoomKeySessionsResponse['sessions']
  ): Promise<KeyBackupWriteResult> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'PUT',
        MATRIX_PATHS.CRYPTO.ROOM_KEYS_KEYS_BY_ROOM(roomId),
        { version },
        { sessions }
      )) as KeyBackupWriteResult
      info(`[MatrixCrypto] 添加房间密钥成功: ${roomId}, count=${result.count}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 添加房间密钥失败: ${roomId}`)
      throw err
    }
  }

  async deleteRoomKeys(version: string, roomId: string): Promise<KeyBackupWriteResult> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest('DELETE', MATRIX_PATHS.CRYPTO.ROOM_KEYS_KEYS_BY_ROOM(roomId), {
        version
      })) as KeyBackupWriteResult
      info(`[MatrixCrypto] 删除房间密钥成功: ${roomId}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 删除房间密钥失败: ${roomId}`)
      throw err
    }
  }

  async getSessionKey(version: string, roomId: string, sessionId: string): Promise<SessionKeyData | null> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'GET',
        MATRIX_PATHS.CRYPTO.ROOM_KEYS_KEYS_BY_SESSION(roomId, sessionId),
        { version }
      )) as SessionKeyData
      return result
    } catch {
      error(`[MatrixCrypto] 获取会话密钥失败: ${roomId}/${sessionId}`)
      return null
    }
  }

  async addSessionKey(
    version: string,
    roomId: string,
    sessionId: string,
    sessionData: SessionKeyData
  ): Promise<KeyBackupWriteResult> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'PUT',
        MATRIX_PATHS.CRYPTO.ROOM_KEYS_KEYS_BY_SESSION(roomId, sessionId),
        { version },
        sessionData
      )) as KeyBackupWriteResult
      info(`[MatrixCrypto] 添加会话密钥成功: ${roomId}/${sessionId}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 添加会话密钥失败: ${roomId}/${sessionId}`)
      throw err
    }
  }

  async deleteSessionKey(version: string, roomId: string, sessionId: string): Promise<KeyBackupWriteResult> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'DELETE',
        MATRIX_PATHS.CRYPTO.ROOM_KEYS_KEYS_BY_SESSION(roomId, sessionId),
        { version }
      )) as KeyBackupWriteResult
      info(`[MatrixCrypto] 删除会话密钥成功: ${roomId}/${sessionId}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 删除会话密钥失败: ${roomId}/${sessionId}`)
      throw err
    }
  }

  async recoverKey(
    version: string,
    roomId: string,
    sessionId: string,
    sessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const client = this.getClient()
    try {
      const available = await endpointCapabilityService.check('POST', MATRIX_PATHS.CRYPTO.ROOM_KEYS_RECOVER)
      if (!available) {
        warn('[MatrixCrypto] 密钥恢复端点不可用')
        return null
      }

      const result = (await client.http.authedRequest('POST', MATRIX_PATHS.CRYPTO.ROOM_KEYS_RECOVER, undefined, {
        version,
        room_id: roomId,
        session_id: sessionId,
        session_data: sessionData
      })) as Record<string, unknown>
      info(`[MatrixCrypto] 恢复密钥成功: ${roomId}/${sessionId}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 恢复密钥失败: ${err}`)
      return null
    }
  }

  async getRecoveryProgress(version: string): Promise<RecoveryProgress | null> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'GET',
        MATRIX_PATHS.CRYPTO.ROOM_KEYS_RECOVERY_PROGRESS(version)
      )) as RecoveryProgress
      return result
    } catch (err) {
      error(`[MatrixCrypto] 获取恢复进度失败: ${err}`)
      return null
    }
  }

  async verifyBackupVersion(version: string): Promise<BackupVerifyResult | null> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'GET',
        MATRIX_PATHS.CRYPTO.ROOM_KEYS_VERIFY(version)
      )) as BackupVerifyResult
      info(`[MatrixCrypto] 验证备份版本: ${version}, valid=${result.valid}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 验证备份版本失败: ${err}`)
      return null
    }
  }

  async batchRecoverKeys(
    version: string,
    sessions: Array<{ room_id: string; session_id: string; session_data: Record<string, unknown> }>
  ): Promise<BatchRecoverResult | null> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest('POST', MATRIX_PATHS.CRYPTO.ROOM_KEYS_BATCH_RECOVER, undefined, {
        version,
        sessions
      })) as BatchRecoverResult
      info(`[MatrixCrypto] 批量恢复密钥: ${result.recovered}/${result.total}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 批量恢复密钥失败: ${err}`)
      return null
    }
  }

  async recoverRoomKeys(version: string, roomId: string): Promise<Record<string, unknown> | null> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'GET',
        MATRIX_PATHS.CRYPTO.ROOM_KEYS_RECOVER_ROOM(version, roomId)
      )) as Record<string, unknown>
      return result
    } catch {
      error(`[MatrixCrypto] 恢复房间密钥失败: ${roomId}`)
      return null
    }
  }

  async recoverSessionKey(version: string, roomId: string, sessionId: string): Promise<Record<string, unknown> | null> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest(
        'GET',
        MATRIX_PATHS.CRYPTO.ROOM_KEYS_RECOVER_SESSION(version, roomId, sessionId)
      )) as Record<string, unknown>
      return result
    } catch {
      error(`[MatrixCrypto] 恢复会话密钥失败: ${roomId}/${sessionId}`)
      return null
    }
  }

  async exportRoomKeysByVersion(version?: string): Promise<Array<Record<string, unknown>>> {
    const client = this.getClient()
    try {
      const path = version ? MATRIX_PATHS.CRYPTO.ROOM_KEYS_EXPORT(version) : MATRIX_PATHS.CRYPTO.ROOM_KEYS_EXPORT()
      const result = (await client.http.authedRequest('GET', path)) as Array<Record<string, unknown>>
      info(`[MatrixCrypto] 导出密钥成功: ${result.length} 个, version=${version ?? 'latest'}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 导出密钥失败: ${err}`)
      return []
    }
  }

  async importRoomKeysByVersion(
    keys: Array<Record<string, unknown>>,
    version?: string
  ): Promise<KeyBackupWriteResult | null> {
    const client = this.getClient()
    try {
      const path = version ? MATRIX_PATHS.CRYPTO.ROOM_KEYS_IMPORT(version) : MATRIX_PATHS.CRYPTO.ROOM_KEYS_IMPORT()
      const result = (await client.http.authedRequest('POST', path, undefined, {
        keys
      })) as KeyBackupWriteResult
      info(`[MatrixCrypto] 导入密钥成功: count=${result.count}, version=${version ?? 'latest'}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 导入密钥失败: ${err}`)
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
    const client = this.getClient()
    try {
      const available = await this.isSasEndpointAvailable()
      if (!available) {
        warn('[MatrixCrypto] SAS 验证端点不可用，使用标准 to-device 协议')
        return null
      }

      const body: Record<string, unknown> = {
        from_device: client.getDeviceId(),
        to_user: toUser,
        method: method ?? 'm.sas.v1'
      }
      if (toDevice) body.to_device = toDevice
      if (transactionId) body.transaction_id = transactionId
      const result = (await client.http.authedRequest(
        'POST',
        MATRIX_PATHS.CRYPTO.VERIFY_START,
        undefined,
        body
      )) as SasVerificationStartResponse
      info(`[MatrixCrypto] SAS验证已启动: txn=${result.transaction_id}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 启动SAS验证失败: ${err}`)
      return null
    }
  }

  async acceptVerification(
    transactionId: string,
    keyAgreementProtocol: string,
    hash: string,
    shortAuthenticationString: string[],
    commitment?: string
  ): Promise<SasVerificationAcceptResponse | null> {
    const client = this.getClient()
    try {
      const available = await this.isSasEndpointAvailable()
      if (!available) {
        warn('[MatrixCrypto] SAS 验证端点不可用')
        return null
      }

      const body: Record<string, unknown> = {
        transaction_id: transactionId,
        key_agreement_protocol: keyAgreementProtocol,
        hash,
        short_authentication_string: shortAuthenticationString
      }
      if (commitment) body.commitment = commitment
      const result = (await client.http.authedRequest(
        'PUT',
        MATRIX_PATHS.CRYPTO.VERIFY_ACCEPT,
        undefined,
        body
      )) as SasVerificationAcceptResponse
      info(`[MatrixCrypto] 接受验证: txn=${transactionId}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 接受验证失败: ${err}`)
      return null
    }
  }

  async exchangeKeys(transactionId: string, pubkey: string): Promise<SasKeyAgreementResponse | null> {
    const client = this.getClient()
    try {
      if (!(await this.isSasEndpointAvailable())) return null
      const result = (await client.http.authedRequest('POST', MATRIX_PATHS.CRYPTO.VERIFY_KEY_AGREEMENT, undefined, {
        transaction_id: transactionId,
        pubkey
      })) as SasKeyAgreementResponse
      info(`[MatrixCrypto] 密钥交换: txn=${transactionId}, confirmed=${result.confirmed}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 密钥交换失败: ${err}`)
      return null
    }
  }

  async confirmMac(transactionId: string, mac: Record<string, string>): Promise<SasMacResponse | null> {
    const client = this.getClient()
    try {
      if (!(await this.isSasEndpointAvailable())) return null
      const result = (await client.http.authedRequest('POST', MATRIX_PATHS.CRYPTO.VERIFY_MAC, undefined, {
        transaction_id: transactionId,
        mac
      })) as SasMacResponse
      info(`[MatrixCrypto] 确认MAC: txn=${transactionId}, verified=${result.verified}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 确认MAC失败: ${err}`)
      return null
    }
  }

  async completeVerification(transactionId: string): Promise<SasDoneResponse | null> {
    const client = this.getClient()
    try {
      if (!(await this.isSasEndpointAvailable())) return null
      const result = (await client.http.authedRequest('POST', MATRIX_PATHS.CRYPTO.VERIFY_DONE, undefined, {
        transaction_id: transactionId
      })) as SasDoneResponse
      info(`[MatrixCrypto] 验证完成: txn=${transactionId}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 完成验证失败: ${err}`)
      return null
    }
  }

  async cancelVerification(transactionId: string, reason?: string): Promise<SasCancelResponse | null> {
    const client = this.getClient()
    try {
      if (!(await this.isSasEndpointAvailable())) return null
      const body: Record<string, unknown> = { transaction_id: transactionId }
      if (reason) body.reason = reason
      const result = (await client.http.authedRequest(
        'POST',
        MATRIX_PATHS.CRYPTO.VERIFY_CANCEL,
        undefined,
        body
      )) as SasCancelResponse
      info(`[MatrixCrypto] 取消验证: txn=${transactionId}, cancelled=${result.cancelled}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 取消验证失败: ${err}`)
      return null
    }
  }

  async listPendingVerifications(): Promise<PendingVerificationRequest[]> {
    const client = this.getClient()
    try {
      if (!(await this.isSasEndpointAvailable())) return []
      const result = (await client.http.authedRequest('GET', MATRIX_PATHS.CRYPTO.VERIFY_REQUESTS)) as {
        requests: PendingVerificationRequest[]
      }
      return result.requests ?? []
    } catch (err) {
      error(`[MatrixCrypto] 获取待处理验证请求失败: ${err}`)
      return []
    }
  }

  async showQrCode(): Promise<QrCodeShowResponse | null> {
    const client = this.getClient()
    try {
      const available = await endpointCapabilityService.check('GET', MATRIX_PATHS.CRYPTO.QR_CODE_SHOW)
      if (!available) {
        warn('[MatrixCrypto] QR 码验证端点不可用')
        return null
      }

      const result = (await client.http.authedRequest('GET', MATRIX_PATHS.CRYPTO.QR_CODE_SHOW)) as QrCodeShowResponse
      info(`[MatrixCrypto] 获取二维码: txn=${result.transaction_id}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 获取二维码失败: ${err}`)
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
    const client = this.getClient()
    try {
      const available = await endpointCapabilityService.check('POST', MATRIX_PATHS.CRYPTO.QR_CODE_SCAN)
      if (!available) {
        warn('[MatrixCrypto] QR 码扫描端点不可用')
        return null
      }

      const result = (await client.http.authedRequest('POST', MATRIX_PATHS.CRYPTO.QR_CODE_SCAN, undefined, {
        transaction_id: transactionId,
        server_name: serverName,
        user_id: userId,
        device_id: deviceId,
        device_ed25519_key: deviceEd25519Key,
        device_curve25519_key: deviceCurve25519Key
      })) as QrCodeScanResponse
      info(`[MatrixCrypto] 扫描二维码: txn=${result.transaction_id}, state=${result.state}`)
      return result
    } catch (err) {
      error(`[MatrixCrypto] 扫描二维码失败: ${err}`)
      return null
    }
  }
}

const matrixCryptoService = new MatrixCryptoService()
export default matrixCryptoService
export { matrixCryptoService }
