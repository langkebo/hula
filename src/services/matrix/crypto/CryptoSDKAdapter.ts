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
  KeyImportResult,
  RoomEncryptionState
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

  /**
   * 查询房间加密状态（三态）。
   *
   * 为什么需要三态：上传路径形如 `if (isEncrypted) 加密上传 else 明文上传`。
   * 若"房间尚未加载/状态读取失败"与"房间确实未加密"共用 `false`，
   * 任何查询失败都会**静默降级为明文上传**，包括本应加密房间的附件。
   * 因此调用方必须显式处理 `unknown`（拒绝发送，而不是明文发送）。
   *
   * @param roomId 房间 ID
   * @returns `encrypted` 已加密；`plaintext` 确认未加密；`unknown` 无法判定
   */
  async getRoomEncryptionState(roomId: string): Promise<RoomEncryptionState> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) {
      // 房间不在本地 store：无法判定，绝不能当作"未加密"
      return 'unknown'
    }

    // SDK 的权威判据：房间状态里是否存在 m.room.encryption
    try {
      const hasEncryptionStateEvent = (room as unknown as { hasEncryptionStateEvent?: () => boolean })
        .hasEncryptionStateEvent
      if (typeof hasEncryptionStateEvent === 'function' && hasEncryptionStateEvent.call(room)) {
        return 'encrypted'
      }
    } catch {
      return 'unknown'
    }

    try {
      const encryptionEvent = room.currentState.getStateEvents('m.room.encryption', '')
      if (encryptionEvent) {
        const content = encryptionEvent.getContent() as { algorithm?: string }
        if (content?.algorithm) return 'encrypted'
      }
      return 'plaintext'
    } catch {
      return 'unknown'
    }
  }

  async isRoomEncrypted(roomId: string): Promise<boolean> {
    return (await this.getRoomEncryptionState(roomId)) === 'encrypted'
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

  /**
   * 要求必须能判定房间加密状态，供安全敏感路径（媒体上传）使用。
   *
   * 与 {@link getRoomEncryptionState} 的区别：状态为 `unknown` 时**抛错**，
   * 调用方不得继续走明文分支。历史缺陷是 `if (isEncrypted) 加密上传 else 明文上传`，
   * 任何查询失败都静默降级为明文上传。
   *
   * @param roomId 房间 ID
   * @returns `true` 已加密；`false` 确认未加密
   * @throws 无法判定房间加密状态
   */
  async requireRoomEncryptionState(roomId: string): Promise<boolean> {
    const state = await this.getRoomEncryptionState(roomId)
    if (state === 'unknown') {
      throw new Error('无法确定房间加密状态，已阻止上传以避免明文外发。请重试或重新进入该房间。')
    }
    return state === 'encrypted'
  }
}

export const cryptoSDKAdapter = new CryptoSDKAdapter()
