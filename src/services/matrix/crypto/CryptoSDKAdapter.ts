/**
 * CryptoSDKAdapter — main crypto adapter (delegation pattern).
 *
 * Owns client/cache state and accessors. Heavy operations are delegated to:
 *  - CryptoDeviceAdapter: device trust and verification
 *  - CryptoKeyBackupAdapter: key backup, restore, import/export
 *  - CryptoSecurityAdapter: security summary, cross-signing status and setup
 *
 * Room encryption helpers (isRoomEncrypted/enableEncryption/getCryptoStatus)
 * are kept here because they are thin and directly use client/crypto access.
 */

import type {
  DeviceKeysManager,
  KeyVerificationManager,
  MatrixClient,
  SDKKeyBackupManager
} from '@/services/matrix/sdk'
import type {
  CryptoApi,
  DeviceTrustManager,
  GeneratedSecretStorageKey,
  ISecuritySummary,
  KeyBackupManager,
  MatrixClientExtended,
  SecureBackupManager,
  VerificationRequest
} from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '../MatrixClientService'
import { CryptoDeviceAdapter } from './CryptoDeviceAdapter'
import { CryptoKeyBackupAdapter } from './CryptoKeyBackupAdapter'
import { CryptoSecurityAdapter } from './CryptoSecurityAdapter'
import type {
  CrossSigningStatusResult,
  CryptoAdapterAccessors,
  DeviceInfo,
  DeviceVerificationResult,
  KeyBackupRestoreResult,
  KeyBackupSetupResult,
  KeyExportResult,
  KeyImportResult
} from './cryptoAdapterTypes'

// Re-export types for backward compatibility with existing consumers
export type {
  CrossSigningStatusResult,
  DeviceInfo,
  DeviceVerificationResult,
  KeyBackupRestoreResult,
  KeyBackupSetupResult,
  KeyExportResult,
  KeyImportResult
}

const logger = createLogger('CryptoSDKAdapter')

class CryptoSDKAdapter implements CryptoAdapterAccessors {
  private cryptoCache: CryptoApi | null = null
  private readonly deviceAdapter: CryptoDeviceAdapter
  private readonly keyBackupAdapter: CryptoKeyBackupAdapter
  private readonly securityAdapter: CryptoSecurityAdapter

  constructor() {
    this.deviceAdapter = new CryptoDeviceAdapter(this)
    this.keyBackupAdapter = new CryptoKeyBackupAdapter(this)
    this.securityAdapter = new CryptoSecurityAdapter(this)
  }

  // ==================== Accessors ====================

  /** 获取扩展加密客户端实例
   */
  getExtendedClient(): MatrixClientExtended {
    return matrixClientService.getClient() as unknown as MatrixClientExtended
  }

  /** 获取 Matrix 客户端实例
   */
  getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('Matrix client not initialized')
    return client
  }

  getCrypto(): CryptoApi | null {
    if (this.cryptoCache) return this.cryptoCache
    const client = this.getExtendedClient()
    this.cryptoCache = client.getCrypto()
    return this.cryptoCache
  }

  invalidateCryptoCache(): void {
    this.cryptoCache = null
  }

  /** 获取设备信任管理器
   */
  getDeviceTrustManager(): DeviceTrustManager | null {
    return this.getExtendedClient().getDeviceTrustManager?.() ?? null
  }

  /** 获取安全备份管理器
   */
  getSecureBackupManager(): SecureBackupManager | null {
    return this.getExtendedClient().getSecureBackupManager?.() ?? null
  }

  /** 获取密钥备份管理器
   */
  getKeyBackupManager(): KeyBackupManager | null {
    return this.getExtendedClient().getKeyBackupManager?.() ?? null
  }

  /** 获取 SDK 设备密钥管理器
   */
  getSDKDeviceKeysManager(): DeviceKeysManager | null {
    return this.getExtendedClient().getDeviceKeysManager?.() ?? null
  }

  /** 获取 SDK 密钥备份管理器
   */
  getSDKKeyBackupManager(): SDKKeyBackupManager | null {
    return this.getExtendedClient().getSDKKeyBackupManager?.() ?? null
  }

  /** 获取 SDK 密钥验证管理器
   */
  getSDKKeyVerificationManager(): KeyVerificationManager | null {
    return this.getExtendedClient().getKeyVerificationManager?.() ?? null
  }

  getManagerAccessors() {
    return {
      deviceTrust: () => this.getDeviceTrustManager(),
      secureBackup: () => this.getSecureBackupManager(),
      keyBackup: () => this.getKeyBackupManager(),
      sdkDeviceKeys: () => this.getSDKDeviceKeysManager(),
      sdkKeyBackup: () => this.getSDKKeyBackupManager(),
      sdkKeyVerification: () => this.getSDKKeyVerificationManager()
    }
  }

  // ==================== Device Trust (delegated) ====================

  getDevices(userId: string): Promise<DeviceInfo[]> {
    return this.deviceAdapter.getDevices(userId)
  }

  /** 获取指定设备信息
   */
  getDevice(userId: string, deviceId: string): Promise<DeviceInfo | null> {
    return this.deviceAdapter.getDevice(userId, deviceId)
  }

  verifyDevice(userId: string, deviceId: string): Promise<void> {
    return this.deviceAdapter.verifyDevice(userId, deviceId)
  }

  unverifyDevice(userId: string, deviceId: string): Promise<void> {
    return this.deviceAdapter.unverifyDevice(userId, deviceId)
  }

  getDeviceVerificationStatus(userId: string, deviceId: string): Promise<DeviceVerificationResult> {
    return this.deviceAdapter.getDeviceVerificationStatus(userId, deviceId)
  }

  requestDeviceVerification(userId: string, deviceId: string): Promise<VerificationRequest | null> {
    return this.deviceAdapter.requestDeviceVerification(userId, deviceId)
  }

  blockDevice(userId: string, deviceId: string): Promise<void> {
    return this.deviceAdapter.blockDevice(userId, deviceId)
  }

  unblockDevice(userId: string, deviceId: string): Promise<void> {
    return this.deviceAdapter.unblockDevice(userId, deviceId)
  }

  // ==================== Security Summary & Cross-Signing (delegated) ====================

  getSecuritySummary(): Promise<ISecuritySummary | null> {
    return this.securityAdapter.getSecuritySummary()
  }

  getCrossSigningStatus(): Promise<CrossSigningStatusResult> {
    return this.securityAdapter.getCrossSigningStatus()
  }

  isCrossSigningReady(): Promise<boolean> {
    return this.securityAdapter.isCrossSigningReady()
  }

  setupCrossSigning(authParams?: { password?: string; authData?: unknown }): Promise<void> {
    return this.securityAdapter.setupCrossSigning(authParams)
  }

  // ==================== Key Backup (delegated) ====================

  backupKeys(): Promise<void> {
    return this.keyBackupAdapter.backupKeys()
  }

  setupKeyBackup(passphrase: string): Promise<KeyBackupSetupResult> {
    return this.keyBackupAdapter.setupKeyBackup(passphrase)
  }

  setupKeyBackupWithOptions(
    input?:
      | string
      | {
          recoveryKey?: string
          password?: string
          authData?: unknown
          generatedKey?: GeneratedSecretStorageKey | null
        }
  ): Promise<string> {
    return this.keyBackupAdapter.setupKeyBackupWithOptions(input)
  }

  restoreKeys(backupKey: string): Promise<KeyBackupRestoreResult> {
    return this.keyBackupAdapter.restoreKeys(backupKey)
  }

  restoreFromBackup(recoveryKey: string): Promise<KeyBackupRestoreResult> {
    return this.keyBackupAdapter.restoreFromBackup(recoveryKey)
  }

  restoreFromBackupWithPassphrase(passphrase: string): Promise<KeyBackupRestoreResult> {
    return this.keyBackupAdapter.restoreFromBackupWithPassphrase(passphrase)
  }

  exportKeys(passphrase?: string): Promise<KeyExportResult> {
    return this.keyBackupAdapter.exportKeys(passphrase)
  }

  importKeys(data: string): Promise<KeyImportResult> {
    return this.keyBackupAdapter.importKeys(data)
  }

  createRecoveryKeyFromPassphrase(password?: string): Promise<GeneratedSecretStorageKey | null> {
    return this.keyBackupAdapter.createRecoveryKeyFromPassphrase(password)
  }

  // ==================== Room Encryption ====================

  async isRoomEncrypted(roomId: string): Promise<boolean> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) return false

    const crypto = this.getCrypto()
    if (crypto) {
      if ((room as unknown as { hasEncryptionStateEvent: () => boolean }).hasEncryptionStateEvent()) {
        return true
      }
    }

    try {
      const encryptionEvent = room.currentState.getStateEvents('m.room.encryption', '')
      if (encryptionEvent) {
        const content = encryptionEvent.getContent() as { algorithm?: string }
        if (content.algorithm) return true
      }
    } catch {
      // Ignore
    }

    return false
  }

  async enableEncryption(roomId: string, algorithm: string = 'm.megolm.v1.aes-sha2'): Promise<void> {
    const client = this.getClient()
    await client.sendStateEvent(roomId, 'm.room.encryption', { algorithm })
  }

  // ==================== Crypto Status ====================

  async getCryptoStatus(): Promise<{ crossSigningReady: boolean; keyBackupEnabled: boolean } | null> {
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
  }

  async isEncryptionAvailable(): Promise<boolean> {
    return !!this.getCrypto()
  }

  // ==================== SDK Manager Requirements ====================

  requireSDKDeviceKeysManager(): DeviceKeysManager {
    const manager = this.getSDKDeviceKeysManager()
    if (!manager) throw new Error('DeviceKeysManager not available')
    return manager
  }

  requireSDKKeyBackupManager(): SDKKeyBackupManager {
    const manager = this.getSDKKeyBackupManager()
    if (!manager) throw new Error('SDKKeyBackupManager not available')
    return manager
  }

  requireSDKKeyVerificationManager(): KeyVerificationManager {
    const manager = this.getSDKKeyVerificationManager()
    if (!manager) throw new Error('KeyVerificationManager not available')
    return manager
  }
}

export const cryptoSDKAdapter = new CryptoSDKAdapter()
