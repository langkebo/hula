import matrixClientService from './MatrixClientService'
import matrixKeyBackupService from './MatrixKeyBackupService'
import matrixVerificationService from './MatrixVerificationService'
import { info, error, warn } from '@tauri-apps/plugin-log'
import { Method } from 'matrix-js-sdk'
import type { MatrixClient } from 'matrix-js-sdk'
import { BaseManager } from './BaseManager'
import type {
  ExtendedMatrixClient,
  MatrixCrypto,
  EncryptionEventContent,
  KeyRotationStatusResponse,
  KeyRotationCheckResponse,
  KeyRotationResponse,
  KeyRotationHistoryResponse,
  KeyRevocationResponse
} from '@/types/matrix-api'

export interface EncryptionSettings {
  algorithm: string
  rotationPeriodMs: number
  rotationPeriodMsgs: number
}

export interface CrossSigningInfo {
  isSetup: boolean
  masterPublicKey?: string
  selfSigningPublicKey?: string
  userSigningPublicKey?: string
}

export interface KeyBackupInfo {
  version: string | null
  algorithm: string | null
  authData: Record<string, unknown>
  count: number
  etag: string
}

export interface VerificationRequest {
  requestId: string
  phase: string
  methods: string[]
  otherParty: {
    userId: string
    deviceId: string
  }
}

export interface KeyRotationStatus {
  enabled: boolean
  intervalMs: number
  lastRotation?: number
  needsRotation: boolean
}

export interface KeyRotationRecord {
  keyId: string
  rotatedAt: number
  deviceId: string
}

class MatrixEncryptionService extends BaseManager {
  private crypto: MatrixClient['crypto'] | null = null

  async initialize(throwOnError = true): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('[Encryption] 客户端未初始化')
      }

      const extendedClient = client as unknown as ExtendedMatrixClient
      const isCryptoEnabled = extendedClient.isCryptoEnabled?.()
      if (isCryptoEnabled) {
        this.crypto = extendedClient.getCrypto?.() ?? null
        info('[Encryption] 加密模块初始化成功')
      } else {
        warn('[Encryption] 加密模块未启用')
      }
    } catch (err) {
      error(`[Encryption] 加密模块初始化失败: ${err}`)
      return this.handleError(err, 'initialize', undefined as unknown as void, throwOnError)
    }
  }

  private getCrypto(): MatrixClient['crypto'] | null {
    if (!this.crypto) {
      const client = matrixClientService.getClient()
      if (client) {
        const extendedClient = client as unknown as ExtendedMatrixClient
        this.crypto = extendedClient.getCrypto?.() ?? null
      }
    }
    return this.crypto
  }

  async isEncryptionAvailable(): Promise<boolean> {
    const crypto = this.getCrypto()
    return !!crypto
  }

  isEncryptionEnabled(): boolean {
    return !!this.getCrypto()
  }

  getDeviceId(): string | null {
    const client = matrixClientService.getClient()
    if (!client) return null
    return (client as any).deviceId ?? null
  }

  async getOwnDeviceKeys(): Promise<Record<string, string> | null> {
    const crypto = this.getCrypto()
    if (!crypto) return null
    try {
      if ((crypto as any).getOwnDeviceKeys) {
        return await (crypto as any).getOwnDeviceKeys()
      }
    } catch {
      return null
    }
    return null
  }

  isGlobalBlacklistUnverifiedDevices(): boolean {
    const crypto = this.getCrypto()
    if (!crypto) return false
    try {
      if ((crypto as any).getGlobalBlacklistUnverifiedDevices) {
        return (crypto as any).getGlobalBlacklistUnverifiedDevices()
      }
    } catch {
      return false
    }
    return false
  }

  async getStoredDevice(userId: string, deviceId: string): Promise<any | null> {
    const client = matrixClientService.getClient()
    if (!client) return null
    try {
      const extendedClient = client as unknown as ExtendedMatrixClient
      return (await extendedClient.getStoredDevice?.(userId, deviceId)) ?? null
    } catch {
      return null
    }
  }

  async isRoomEncrypted(roomId: string): Promise<boolean> {
    const client = matrixClientService.getClient()
    if (!client) return false

    try {
      const extendedClient = client as unknown as ExtendedMatrixClient
      return extendedClient.isRoomEncrypted?.(roomId) ?? false
    } catch {
      return false
    }
  }

  async enableRoomEncryption(roomId: string, settings?: Partial<EncryptionSettings>, throwOnError = false): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      return this.handleError(new Error('[Encryption] 客户端未初始化'), 'enableRoomEncryption', undefined as unknown as void, throwOnError)
    }

    try {
      const encryptionEventContent: EncryptionEventContent = {
        algorithm: settings?.algorithm || 'm.megolm.v1.aes-sha2'
      }

      if (settings?.rotationPeriodMs) {
        encryptionEventContent.rotation_period_ms = settings.rotationPeriodMs
      }
      if (settings?.rotationPeriodMsgs) {
        encryptionEventContent.rotation_period_msgs = settings.rotationPeriodMsgs
      }

      await client.sendStateEvent(roomId, 'm.room.encryption' as const, encryptionEventContent, '')
      info(`[Encryption] 启用房间加密: ${roomId}`)
    } catch (err) {
      error(`[Encryption] 启用房间加密失败: ${err}`)
      this.handleError(err, 'enableRoomEncryption', undefined as unknown as void, throwOnError)
    }
  }

  async getEncryptionSettings(roomId: string): Promise<EncryptionSettings | null> {
    const client = matrixClientService.getClient()
    if (!client) return null

    try {
      const room = client.getRoom(roomId)
      if (!room) return null

      const encryptionEvent = room.currentState.getStateEvents('m.room.encryption', '')
      if (!encryptionEvent) return null

      const content = encryptionEvent.getContent() as unknown as EncryptionEventContent
      return {
        algorithm: content.algorithm || 'm.megolm.v1.aes-sha2',
        rotationPeriodMs: content.rotation_period_ms || 604800000,
        rotationPeriodMsgs: content.rotation_period_msgs || 100
      }
    } catch (err) {
      error(`[Encryption] 获取加密设置失败: ${err}`)
      return null
    }
  }

  async setupCrossSigning(authParams?: { password?: string; authData?: Record<string, unknown> }, throwOnError = false): Promise<void> {
    const crypto = this.getCrypto()
    if (!crypto) {
      return this.handleError(new Error('[Encryption] 加密模块不可用'), 'setupCrossSigning', undefined as unknown as void, throwOnError)
    }

    try {
      await crypto.bootstrapCrossSigning?.({
        authUploadDeviceSigningKeys: async (
          makeRequest: (authData: Record<string, unknown>) => Promise<Record<string, unknown>>
        ) => {
          if (authParams?.authData) {
            return makeRequest(authParams.authData)
          }
          throw new Error('[Encryption] 需要认证参数')
        }
      })
      info('[Encryption] 交叉签名设置成功')
    } catch (err) {
      error(`[Encryption] 设置交叉签名失败: ${err}`)
      this.handleError(err, 'setupCrossSigning', undefined as unknown as void, throwOnError)
    }
  }

  async getCrossSigningInfo(): Promise<CrossSigningInfo> {
    const crypto = this.getCrypto()
    if (!crypto) {
      return { isSetup: false }
    }

    try {
      const status = await crypto.getCrossSigningStatus?.()
      const matrixCrypto = crypto as unknown as MatrixCrypto
      const crossSigningKeyId = matrixCrypto.crossSigningInfo?.getId?.()

      return {
        isSetup: status?.privateKeysCached ?? false,
        masterPublicKey: crossSigningKeyId,
        selfSigningPublicKey: matrixCrypto.crossSigningInfo?.getId?.('self_signing'),
        userSigningPublicKey: matrixCrypto.crossSigningInfo?.getId?.('user_signing')
      }
    } catch (err) {
      error(`[Encryption] 获取交叉签名信息失败: ${err}`)
      return { isSetup: false }
    }
  }

  async isCrossSigningReady(): Promise<boolean> {
    const client = matrixClientService.getClient()
    if (!client) return false

    try {
      const extendedClient = client as unknown as ExtendedMatrixClient
      return extendedClient.isCrossSigningReady?.() ?? false
    } catch {
      return false
    }
  }

  async setupKeyBackup(recoveryKey?: string, throwOnError = false): Promise<string> {
    try {
      if (recoveryKey) {
        await matrixKeyBackupService.recoverKeys(recoveryKey)
        return recoveryKey
      }
      const result = await matrixKeyBackupService.createBackupVersion()
      info('[Encryption] 密钥备份设置成功')
      return result?.version ?? ''
    } catch (err) {
      error(`[Encryption] 设置密钥备份失败: ${err}`)
      return this.handleError(err, 'setupKeyBackup', '', throwOnError)
    }
  }

  async getKeyBackupInfo(): Promise<KeyBackupInfo | null> {
    try {
      const versions = await matrixKeyBackupService.getBackupVersions()
      if (!versions || versions.length === 0) return null
      const latest = versions[0]
      return {
        version: latest.version,
        algorithm: latest.algorithm,
        authData: latest.authData,
        count: latest.count ?? 0,
        etag: latest.etag ?? ''
      }
    } catch (err) {
      error(`[Encryption] 获取密钥备份信息失败: ${err}`)
      return null
    }
  }

  async restoreFromBackup(recoveryKey: string, throwOnError = false): Promise<{ imported: number; total: number }> {
    try {
      await matrixKeyBackupService.recoverKeys(recoveryKey)
      info('[Encryption] 从备份恢复密钥成功')
      return { imported: 0, total: 0 }
    } catch (err) {
      error(`[Encryption] 从备份恢复密钥失败: ${err}`)
      return this.handleError(err, 'restoreFromBackup', { imported: 0, total: 0 }, throwOnError)
    }
  }

  async deleteKeyBackup(throwOnError = false): Promise<void> {
    try {
      const versions = await matrixKeyBackupService.getBackupVersions()
      if (versions && versions.length > 0) {
        await matrixKeyBackupService.deleteBackupVersion(versions[0].version)
        info('[Encryption] 删除密钥备份成功')
      }
    } catch (err) {
      error(`[Encryption] 删除密钥备份失败: ${err}`)
      this.handleError(err, 'deleteKeyBackup', undefined as unknown as void, throwOnError)
    }
  }

  async requestDeviceVerification(
    userId: string,
    _deviceId: string,
    methods: string[] = ['m.sas.v1', 'm.qr_code.show.v1', 'm.reciprocate.v1'],
    throwOnError = false
  ): Promise<VerificationRequest> {
    try {
      const request = await matrixVerificationService.requestVerification(userId, methods)
      return {
        requestId: request?.transactionId || '',
        phase: 'requested',
        methods: request?.methods || methods,
        otherParty: {
          userId,
          deviceId: request?.deviceId || ''
        }
      }
    } catch (err) {
      error(`[Encryption] 请求设备验证失败: ${err}`)
      return this.handleError(err, 'requestDeviceVerification', { requestId: '', phase: '', methods: [], otherParty: { userId, deviceId: '' } } as VerificationRequest, throwOnError)
    }
  }

  async requestUserVerification(userId: string, methods: string[] = ['m.sas.v1'], throwOnError = false): Promise<VerificationRequest> {
    try {
      const request = await matrixVerificationService.requestVerification(userId, methods)
      return {
        requestId: request?.transactionId || '',
        phase: 'requested',
        methods: request?.methods || methods,
        otherParty: {
          userId,
          deviceId: request?.deviceId || ''
        }
      }
    } catch (err) {
      error(`[Encryption] 请求用户验证失败: ${err}`)
      return this.handleError(err, 'requestUserVerification', { requestId: '', phase: '', methods: [], otherParty: { userId, deviceId: '' } } as VerificationRequest, throwOnError)
    }
  }

  async getVerificationRequests(userId: string): Promise<VerificationRequest[]> {
    try {
      const requests = await matrixVerificationService.getVerificationRequests(userId)
      return requests.map((r) => ({
        requestId: r.transactionId,
        phase: 'requested',
        methods: r.methods || [],
        otherParty: {
          userId: r.userId,
          deviceId: r.deviceId
        }
      }))
    } catch {
      return []
    }
  }

  async trustDevice(userId: string, deviceId: string, throwOnError = false): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      return this.handleError(new Error('[Encryption] 客户端未初始化'), 'trustDevice', undefined as unknown as void, throwOnError)
    }

    try {
      const extendedClient = client as unknown as ExtendedMatrixClient
      await extendedClient.setDeviceVerified?.(userId, deviceId)
      info(`[Encryption] 信任设备: ${userId}:${deviceId}`)
    } catch (err) {
      error(`[Encryption] 信任设备失败: ${err}`)
      this.handleError(err, 'trustDevice', undefined as unknown as void, throwOnError)
    }
  }

  async untrustDevice(userId: string, deviceId: string, throwOnError = false): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      return this.handleError(new Error('[Encryption] 客户端未初始化'), 'untrustDevice', undefined as unknown as void, throwOnError)
    }

    try {
      const extendedClient = client as unknown as ExtendedMatrixClient
      await extendedClient.setDeviceKnown?.(userId, deviceId, false)
      info(`[Encryption] 取消信任设备: ${userId}:${deviceId}`)
    } catch (err) {
      error(`[Encryption] 取消信任设备失败: ${err}`)
      this.handleError(err, 'untrustDevice', undefined as unknown as void, throwOnError)
    }
  }

  async blockDevice(userId: string, deviceId: string, throwOnError = false): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      return this.handleError(new Error('[Encryption] 客户端未初始化'), 'blockDevice', undefined as unknown as void, throwOnError)
    }

    try {
      const extendedClient = client as unknown as ExtendedMatrixClient
      await extendedClient.setDeviceBlocked?.(userId, deviceId, true)
      info(`[Encryption] 阻止设备: ${userId}:${deviceId}`)
    } catch (err) {
      error(`[Encryption] 阻止设备失败: ${err}`)
      this.handleError(err, 'blockDevice', undefined as unknown as void, throwOnError)
    }
  }

  async unblockDevice(userId: string, deviceId: string, throwOnError = false): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      return this.handleError(new Error('[Encryption] 客户端未初始化'), 'unblockDevice', undefined as unknown as void, throwOnError)
    }

    try {
      const extendedClient = client as unknown as ExtendedMatrixClient
      await extendedClient.setDeviceBlocked?.(userId, deviceId, false)
      info(`[Encryption] 取消阻止设备: ${userId}:${deviceId}`)
    } catch (err) {
      error(`[Encryption] 取消阻止设备失败: ${err}`)
      this.handleError(err, 'unblockDevice', undefined as unknown as void, throwOnError)
    }
  }

  async getDeviceTrustLevel(
    userId: string,
    deviceId: string
  ): Promise<{
    isVerified: boolean
    isCrossSigningVerified: boolean
    isTofu: boolean
  }> {
    const client = matrixClientService.getClient()
    if (!client) {
      return { isVerified: false, isCrossSigningVerified: false, isTofu: false }
    }

    try {
      const extendedClient = client as unknown as ExtendedMatrixClient
      const device = await extendedClient.getStoredDevice?.(userId, deviceId)
      if (!device) {
        return { isVerified: false, isCrossSigningVerified: false, isTofu: false }
      }

      const trustInfo = await extendedClient.checkDeviceTrust?.(userId, deviceId)

      return {
        isVerified: device.isVerified?.() ?? false,
        isCrossSigningVerified: trustInfo?.isCrossSigningVerified?.() ?? false,
        isTofu: !device.isUnverified?.()
      }
    } catch {
      return { isVerified: false, isCrossSigningVerified: false, isTofu: false }
    }
  }

  async exportRoomKeys(throwOnError = true): Promise<string> {
    const crypto = this.getCrypto()
    if (!crypto) {
      return this.handleError(new Error('[Encryption] 加密模块不可用'), 'exportRoomKeys', '', throwOnError)
    }

    try {
      const keys = await crypto.exportRoomKeys?.()
      const exported = JSON.stringify(keys, null, 2)
      info('[Encryption] 导出房间密钥成功')
      return exported
    } catch (err) {
      error(`[Encryption] 导出房间密钥失败: ${err}`)
      return this.handleError(err, 'exportRoomKeys', '', throwOnError)
    }
  }

  async importRoomKeys(keysJson: string, throwOnError = false): Promise<{ imported: number; total: number }> {
    const crypto = this.getCrypto()
    if (!crypto) {
      return this.handleError(new Error('[Encryption] 加密模块不可用'), 'importRoomKeys', { imported: 0, total: 0 }, throwOnError)
    }

    try {
      const keys = JSON.parse(keysJson)
      const result = await crypto.importRoomKeys?.(keys, {
        progressCallback: () => {}
      })

      info(`[Encryption] 导入房间密钥成功: ${result?.length || 0} 个`)
      return {
        imported: result?.length || 0,
        total: keys.length || 0
      }
    } catch (err) {
      error(`[Encryption] 导入房间密钥失败: ${err}`)
      return this.handleError(err, 'importRoomKeys', { imported: 0, total: 0 }, throwOnError)
    }
  }

  async getUnverifiedDevicesInRoom(roomId: string): Promise<string[]> {
    const client = matrixClientService.getClient()
    if (!client) return []

    try {
      const room = client.getRoom(roomId)
      if (!room) return []

      const members =
        (room as { getEncryptionTargetMembers?: () => unknown[] }).getEncryptionTargetMembers?.() ||
        room.getJoinedMembers?.() ||
        []
      const unverifiedDevices: string[] = []
      const extendedClient = client as unknown as ExtendedMatrixClient

      for (const member of members) {
        const userId = (member as { userId?: string }).userId || (member as string)
        const devices = (await extendedClient.getStoredDevicesForUser?.(userId)) || []

        for (const device of devices) {
          const isVerified = device.isVerified?.()
          if (!isVerified) {
            unverifiedDevices.push(`${userId}:${device.deviceId}`)
          }
        }
      }

      return unverifiedDevices
    } catch {
      return []
    }
  }

  async hasUndecryptableEvents(roomId: string): Promise<boolean> {
    const client = matrixClientService.getClient()
    if (!client) return false

    try {
      const room = client.getRoom(roomId)
      if (!room) return false

      const timeline = room.getLiveTimeline()
      const events = timeline.getEvents()

      for (const event of events) {
        if ((event as { isDecryptionFailure?: () => boolean }).isDecryptionFailure?.()) {
          return true
        }
      }

      return false
    } catch {
      return false
    }
  }

  async getKeyRotationStatus(): Promise<KeyRotationStatus> {
    const client = matrixClientService.getClient()
    if (!client) {
      return { enabled: false, intervalMs: 0, needsRotation: false }
    }

    try {
      const extendedClient = client as unknown as ExtendedMatrixClient
      const response = (await extendedClient.http.request(
        Method.Get,
        '/_matrix/client/v1/keys/rotation/status',
        undefined,
        undefined,
        { prefix: '' }
      )) as KeyRotationStatusResponse
      return {
        enabled: response.enabled ?? true,
        intervalMs: response.interval_ms ?? 604800000,
        lastRotation: response.last_rotation,
        needsRotation: response.needs_rotation ?? true
      }
    } catch (err) {
      error(`[Encryption] 获取密钥轮换状态失败: ${err}`)
      return { enabled: true, intervalMs: 604800000, needsRotation: false }
    }
  }

  async checkNeedsRotation(): Promise<boolean> {
    const client = matrixClientService.getClient()
    if (!client) return false

    try {
      const extendedClient = client as unknown as ExtendedMatrixClient
      const response = (await extendedClient.http.request(
        Method.Get,
        '/_matrix/client/v1/keys/rotation/check',
        undefined,
        undefined,
        { prefix: '' }
      )) as KeyRotationCheckResponse
      return response.needs_rotation ?? false
    } catch (err) {
      error(`[Encryption] 检查密钥轮换需求失败: ${err}`)
      return false
    }
  }

  async rotateKeys(throwOnError = false): Promise<{ success: boolean; keyId: string; rotatedAt: number }> {
    const client = matrixClientService.getClient()
    if (!client) {
      return this.handleError(new Error('[Encryption] 客户端未初始化'), 'rotateKeys', { success: false, keyId: '', rotatedAt: 0 }, throwOnError)
    }

    try {
      const extendedClient = client as unknown as ExtendedMatrixClient
      const response = (await extendedClient.http.request(
        Method.Post,
        '/_matrix/client/v1/keys/rotation/rotate',
        undefined,
        undefined,
        { prefix: '' }
      )) as KeyRotationResponse
      info('[Encryption] 密钥轮换成功')
      return {
        success: response.success ?? true,
        keyId: response.key_id ?? '',
        rotatedAt: response.rotated_at ?? Date.now()
      }
    } catch (err) {
      error(`[Encryption] 密钥轮换失败: ${err}`)
      return this.handleError(err, 'rotateKeys', { success: false, keyId: '', rotatedAt: 0 }, throwOnError)
    }
  }

  async getRotationHistory(deviceId: string): Promise<KeyRotationRecord[]> {
    const client = matrixClientService.getClient()
    if (!client) return []

    try {
      const extendedClient = client as unknown as ExtendedMatrixClient
      const response = (await extendedClient.http.request(
        Method.Get,
        `/_matrix/client/v1/keys/rotation/history/${encodeURIComponent(deviceId)}`,
        undefined,
        undefined,
        { prefix: '' }
      )) as KeyRotationHistoryResponse
      return (response.rotations ?? []).map((r) => ({
        keyId: r.key_id ?? '',
        rotatedAt: r.rotated_at ?? 0,
        deviceId
      }))
    } catch (err) {
      error(`[Encryption] 获取轮换历史失败: ${err}`)
      return []
    }
  }

  async revokeOldKeys(deviceId: string, keyIds: string[], throwOnError = false): Promise<number> {
    const client = matrixClientService.getClient()
    if (!client) {
      return this.handleError(new Error('[Encryption] 客户端未初始化'), 'revokeOldKeys', 0, throwOnError)
    }

    try {
      const extendedClient = client as unknown as ExtendedMatrixClient
      const response = (await extendedClient.http.request(
        Method.Post,
        '/_matrix/client/v1/keys/rotation/revoke',
        undefined,
        { device_id: deviceId, key_ids: keyIds },
        { prefix: '' }
      )) as KeyRevocationResponse
      info(`[Encryption] 撤销旧密钥成功: ${response.revoked ?? 0} 个`)
      return response.revoked ?? 0
    } catch (err) {
      error(`[Encryption] 撤销旧密钥失败: ${err}`)
      return this.handleError(err, 'revokeOldKeys', 0, throwOnError)
    }
  }

  async configureKeyRotation(enabled: boolean, intervalDays: number = 30, throwOnError = false): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      return this.handleError(new Error('[Encryption] 客户端未初始化'), 'configureKeyRotation', undefined as unknown as void, throwOnError)
    }

    try {
      const extendedClient = client as unknown as ExtendedMatrixClient
      await extendedClient.http.request(
        Method.Put,
        '/_matrix/client/v1/keys/rotation/config',
        undefined,
        { enabled, interval_days: intervalDays },
        { prefix: '' }
      )
      info('[Encryption] 密钥轮换配置已更新')
    } catch (err) {
      error(`[Encryption] 配置密钥轮换失败: ${err}`)
      this.handleError(err, 'configureKeyRotation', undefined as unknown as void, throwOnError)
    }
  }

  async resetCrossSigning(throwOnError = false): Promise<void> {
    const crypto = this.getCrypto()
    if (!crypto) {
      return this.handleError(new Error('[Encryption] 加密模块不可用'), 'resetCrossSigning', undefined as unknown as void, throwOnError)
    }

    try {
      if (crypto.resetCrossSigningKeys) {
        await crypto.resetCrossSigningKeys()
        info('[Encryption] 交叉签名已重置')
      } else {
        warn('[Encryption] 交叉签名重置方法不可用')
      }
    } catch (err) {
      error(`[Encryption] 重置交叉签名失败: ${err}`)
      this.handleError(err, 'resetCrossSigning', undefined as unknown as void, throwOnError)
    }
  }
}

export const matrixEncryptionService = new MatrixEncryptionService()
export default matrixEncryptionService
