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
  /**
   * ⚠️ 名字有误导：它承载的是 SDK 的 `privateKeysInSecretStorage`（**私钥已入 4S**），
   * 不是「私钥在本机缓存」。保留该字段只为兼容既有消费方；新代码请用下面显式命名的字段。
   */
  privateKeysCached: boolean
  crossSigningVerified: boolean
  isSetup: boolean
  /**
   * 公开交叉签名密钥在本机可用（SDK `CrossSigningStatus.publicKeysOnDevice`）。
   * 这才是「交叉签名**已建立**」的判据——它与「私钥已入 4S」是**两件独立的事**：
   * 先做交叉签名、后配密钥存储的中断流程会让前者为真、后者为假。
   */
  publicKeysOnDevice: boolean
  /** 交叉签名**私钥**已存入服务端密钥存储（4S/SSSS） */
  privateKeysInSecretStorage: boolean
  /**
   * 交叉签名**私钥**在本机 crypto store 可用。
   *
   * SDK 逐密钥返回布尔（`{ masterKey, selfSigningKey, userSigningKey }`），此处按
   * 「**任一**为真」聚合：只要有一把私钥在本机可用，就说明交叉签名在本设备上已建立过，
   * 此时「未入 4S」是一个真实的可恢复性缺口，而不是「从未设置」。
   */
  privateKeysCachedLocally: boolean
  /** 交叉签名密钥 ID；null 表示尚未初始化 */
  masterPublicKey?: string | null
  selfSigningPublicKey?: string | null
  userSigningPublicKey?: string | null
}

/**
 * 「把交叉签名私钥补存进 4S」的可判定结果。
 *
 * `needs-setup` 必须与 `failed` 分开：前者表示 4S 本身还不存在（此时**不能**调用
 * `bootstrapSecretStorage`，否则 SDK 会顺手新建一个 4S 密钥而用户从未见过它），
 * 应引导用户走应用内的密钥存储设置流程；后者是真实错误。
 */
export type StoreCrossSigningKeysResult = 'stored' | 'already-stored' | 'needs-setup' | 'failed'

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
