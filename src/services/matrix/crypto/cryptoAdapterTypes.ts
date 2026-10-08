/**
 * cryptoAdapterTypes — shared types and accessors interface for CryptoSDKAdapter sub-adapters.
 *
 * Sub-adapters (CryptoDeviceAdapter / CryptoKeyBackupAdapter / CryptoSecurityAdapter)
 * receive a CryptoAdapterAccessors instance to access the underlying SDK managers,
 * keeping CryptoSDKAdapter as the single owner of client/cache state.
 */

import type { DeviceKeysManager, MatrixClient, SDKKeyBackupManager } from '@/services/matrix/sdk'
import type { CryptoApi, KeyBackupManager, MatrixClientExtended, SecureBackupManager } from '@/types/matrix-extensions'

export interface DeviceInfo {
  deviceId: string
  userId: string
  displayName?: string
  lastSeenTs?: number
  lastSeenIp?: string
  isVerified?: boolean
}

export interface DeviceVerificationResult {
  verified: boolean
  crossSigningVerified: boolean
  devicesCrossSigningVerified: boolean
  /** Trust On First Use：设备已被客户端见过（已知）但尚未显式验证 */
  tofu: boolean
}

export interface CrossSigningStatusResult {
  privateKeysCached: boolean
  crossSigningVerified: boolean
  isSetup: boolean
  /** 交叉签名密钥 ID；null 表示尚未初始化 */
  masterPublicKey?: string | null
  selfSigningPublicKey?: string | null
  userSigningPublicKey?: string | null
}

export interface KeyBackupSetupResult {
  success: boolean
  recoveryKey?: string
}

export interface KeyBackupRestoreResult {
  imported: number
  total: number
}

export interface KeyExportResult {
  data: string
  count: number
}

export interface KeyImportResult {
  imported: number
  total: number
}

/** Accessor interface that sub-adapters depend on. */
export interface CryptoAdapterAccessors {
  getCrypto(): CryptoApi | null
  getExtendedClient(): MatrixClientExtended
  getClient(): MatrixClient
  getSecureBackupManager(): SecureBackupManager | null
  getKeyBackupManager(): KeyBackupManager | null
  getSDKDeviceKeysManager(): DeviceKeysManager | null
  getSDKKeyBackupManager(): SDKKeyBackupManager | null
}

/**
 * 房间加密状态三态。
 *
 * `unknown` 必须与 `plaintext` 区分：前者表示"无法判定"（房间未加载/状态读取失败），
 * 上传等安全敏感路径必须拒绝发送而不是降级为明文。
 */
export type RoomEncryptionState = 'encrypted' | 'plaintext' | 'unknown'
