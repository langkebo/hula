/**
 * Matrix SDK 扩展类型定义
 *
 * 为 matrix-js-sdk 提供额外的类型定义，避免使用 any 类型
 */

import type { IPusher, IPusherRequest, MatrixClient, PushRuleAction } from 'matrix-js-sdk'

// ============================================
// Crypto API 扩展
// ============================================

/**
 * SDK `CryptoApi.createRecoveryKeyFromPassphrase` 的返回类型。
 *
 * 必须与 vendored matrix-js-sdk 的 `GeneratedSecretStorageKey`
 * （`lib/crypto-api/index.d.ts`）逐字段一致：
 * `keyInfo` 是**可选**的，且**只含** `passphrase?` 与 `name?`。
 *
 * 历史缺陷：本地曾把 `algorithm`/`iv`/`mac` 声明为 `keyInfo` 的必填字段，
 * 调用方据此读取（`ssssKeyDescription` 的守卫），于是必然抛错且被 catch 吞掉，
 * 导致 SSSS 密钥从未上传到服务端。这三个值必须由本地按规范从私钥计算。
 */
export interface GeneratedSecretStorageKey {
  keyInfo?: {
    passphrase?: {
      algorithm: string
      iterations: number
      salt: string
      bits?: number
    }
    name?: string
  }
  encodedPrivateKey?: string
  privateKey: Uint8Array
}

export interface MatrixAuthData {
  type: string
  session?: string
  user?: string
  password?: string
  [key: string]: unknown
}

export interface VerificationRequest {
  transactionId: string
  userId: string
  deviceId: string
  methods: string[]
  accept(): Promise<void>
  cancel(reason: { reason: string }): Promise<void>
  verifier?: SasVerifier
}

export interface SasVerifier {
  verify(): Promise<void>
  cancel(): void
  getShowSasCallbacks(): {
    decimal?: number[]
    emoji?: Array<{ emoji: string; name: string }>
  }
}

export interface DeviceVerificationStatus {
  isVerified(): boolean
  readonly crossSigningVerified: boolean
  readonly localVerified: boolean
  readonly signedByOwner: boolean
  readonly tofu: boolean
}

export interface CryptoApi {
  requestDeviceVerification(userId: string, deviceId: string): Promise<VerificationRequest>
  getDeviceVerificationStatus(userId: string, deviceId: string): Promise<DeviceVerificationStatus | null>
  getOwnDeviceKeys(): Promise<{ ed25519: string; curve25519: string }>
  isSecretStorageReady(): Promise<boolean>
  bootstrapSecretStorage(opts?: {
    createSecretStorageKey?: () => Promise<GeneratedSecretStorageKey>
    setupNewSecretStorage?: boolean
    setupNewKeyBackup?: boolean
    setupNewKeyBackupAuth?: MatrixAuthData
  }): Promise<void>
  bootstrapCrossSigning(opts: {
    authUploadDeviceSigningKeys: (makeRequest: (authData: unknown) => Promise<unknown>) => Promise<unknown>
  }): Promise<void>
  getCrossSigningStatus(): Promise<{
    publicKeysOnDevice: boolean
    privateKeysInSecretStorage: boolean
    privateKeysCachedLocally: {
      masterKey: boolean
      selfSigningKey: boolean
      userSigningKey: boolean
    }
  }>
  isCrossSigningReady(): Promise<boolean>
  /** 读取交叉签名密钥 ID；null 表示该密钥尚未初始化（SDK 真身成员） */
  getCrossSigningKeyId(type?: 'master' | 'self_signing' | 'user_signing'): Promise<string | null>
  /**
   * SSSS 状态详情（SDK 真身成员：CryptoApi.getSecretStorageStatus）。
   *
   * 注意：本接口是**手写的 SDK 契约**，必须与 vendored matrix-js-sdk 保持一致；
   * 缺失成员会被 `as unknown as` 掩盖，导致运行时 `undefined is not a function`。
   */
  getSecretStorageStatus?(): Promise<{ ready: boolean; defaultKeyId: string | null }>
  /** 从 SSSS 取出备份解密密钥并存入 crypto store（SDK 真身成员） */
  loadSessionBackupPrivateKeyFromSecretStorage?(): Promise<void>
  restoreKeyBackup(opts?: KeyBackupRestoreOpts): Promise<KeyBackupRestoreResult>
  restoreKeyBackupWithPassphrase(passphrase: string, opts?: KeyBackupRestoreOpts): Promise<KeyBackupRestoreResult>
  resetKeyBackup(auth?: MatrixAuthData): Promise<void>
  getKeyBackupInfo(): Promise<KeyBackupInfo | null>
  deleteKeyBackupVersion(version: string): Promise<void>
  exportRoomKeys(opts?: Record<string, unknown>): Promise<Array<Record<string, unknown>>>
  importRoomKeys(keys: Array<Record<string, unknown>>, opts?: Record<string, unknown>): Promise<void>
  /** SDK 真身签名：接收 userId 数组，返回 DeviceMap（不是单个 userId + timeout） */
  getUserDeviceInfo(userIds: string[], downloadUncached?: boolean): Promise<Record<string, unknown>>
  setDeviceVerified(userId: string, deviceId: string, verified?: boolean): Promise<void>
  createRecoveryKeyFromPassphrase(password?: string): Promise<GeneratedSecretStorageKey>
}

export interface KeyBackupRestoreOpts {
  progressCallback?: (progress: { stage: string; successes?: number; failures?: number; total?: number }) => void
}

export interface KeyBackupRestoreResult {
  total: number
  imported: number
}

export interface KeyBackupInfo {
  algorithm: string
  auth_data: Record<string, unknown>
  count?: number
  etag?: string
  version?: string
}

// ============================================
// Device Manager 扩展
// ============================================

export interface Device {
  device_id: string
  display_name?: string
  last_seen_ts?: number
  last_seen_ip?: string
  verified?: boolean
}

export interface DeviceManager {
  getDevices(): Promise<Device[]>
  getDevice(deviceId: string): Promise<Device>
  updateDevice(deviceId: string, updates: IDeviceUpdateRequest): Promise<void> // SDK-9: IDeviceUpdateRequest 对象签名
  deleteDevice(deviceId: string, auth?: AuthDict): Promise<void>
  /**
   * 批量删除设备（SDK 真身签名）。
   *
   * 注意：SDK 只接受一个参数；只有对象形式 `{ devices, auth }` 才会读取 auth，
   * 传第二个位置参数会被静默丢弃，导致 UIA 重试永远失败。
   */
  deleteDevices(request: string[] | { devices: string[]; auth?: AuthDict }): Promise<void>
  getDeviceListUpdates(users: string[], since?: string): Promise<DeviceListUpdatesResponse>
}

// SDK-9: 设备更新请求类型
export interface IDeviceUpdateRequest {
  display_name?: string
}

// SDK-7: Push 管理器类型
export interface ICreatePushRuleRequest {
  actions: PushRuleAction[]
  conditions?: Record<string, unknown>[]
  pattern?: string
  before?: string
  after?: string
}

export interface PushManager {
  setPusher(pusher: IPusherRequest): Promise<void>
  removePusher(pushkey: string, appId: string, deviceId?: string): Promise<void>
  getPushers(forceRefresh?: boolean): Promise<IPusher[]>
  // FT-112: Push rule operations routed through SDK PushManager
  setPushRuleEnabled(scope: string, kind: string, ruleId: string, enabled: boolean): Promise<void>
  setPushRuleActions(scope: string, kind: string, ruleId: string, actions: PushRuleAction[]): Promise<void>
  createPushRule(scope: string, kind: string, ruleId: string, rule: ICreatePushRuleRequest): Promise<void>
  deletePushRule(scope: string, kind: string, ruleId: string): Promise<void>
  muteRoom(roomId: string): Promise<void>
  unmuteRoom(roomId: string): Promise<void>
}

export interface AuthDict {
  type: string
  session?: string
  password?: string
  user?: string
  identifier?: {
    type: string
    user: string
  }
}

// ============================================
// Key Backup 扩展
// ============================================

export interface BackupInfo {
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
  etag?: string
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

export interface KeyBackupManager {
  checkKeyBackup(): Promise<BackupInfo | null>
  /**
   * 确保存在可用的备份版本，返回版本号（SDK 真身成员：KeyBackupManager.ensureBackupVersion）。
   *
   * 注意：本接口为**手写的 SDK 契约**，必须与 vendored matrix-js-sdk 逐项对齐——
   * 既不能声明不存在的方法（幻影契约），也不能缺少真实存在的方法。
   */
  ensureBackupVersion(algorithm?: string): Promise<string>
  getLatestBackupVersion(forceRefresh?: boolean): Promise<BackupInfo>
  getBackupVersion(version: string, forceRefresh?: boolean): Promise<BackupInfo>
  /** SDK 真身签名：只有两个参数，auth_data 为 AuthData | Aes256AuthData 联合 */
  createBackupVersion(algorithm?: string, authData?: Record<string, unknown>): Promise<{ version: string }>
  updateBackupVersion(version: string, authData: Record<string, unknown>): Promise<{ version: string }>
  deleteBackupVersion(version: string): Promise<{ deleted: boolean; version: string }>
  getAllRoomKeys(version: string): Promise<RoomKeyBackup>
  putAllRoomKeys(version: string, body: Record<string, unknown>): Promise<{ count: number; etag: string }>
  getRoomKeys(version: string, roomId: string): Promise<Record<string, unknown>>
  putRoomKeys(version: string, roomId: string, body: Record<string, unknown>): Promise<{ count: number; etag: string }>
  deleteAllRoomKeys(version: string): Promise<{ count: number; etag: string }>
  deleteRoomKeys(version: string, roomId: string): Promise<{ count: number; etag: string }>
  getSessionKey(version: string, roomId: string, sessionId: string): Promise<Record<string, unknown>>
  putSessionKey(
    version: string,
    roomId: string,
    sessionId: string,
    sessionData: Record<string, unknown>
  ): Promise<{ count: number; etag: string }>
  deleteSessionKey(version: string, roomId: string, sessionId: string): Promise<{ count: number; etag: string }>
  recoverKeys(version: string, rooms?: string[]): Promise<Record<string, unknown>>
  getRecoveryProgress(version: string): Promise<RecoveryProgress>
  verifyBackup(version: string): Promise<VerifyResult>
  batchRecover(version: string, roomIds: string[], sessionLimit?: number): Promise<BatchRecoverResult>
  recoverRoomKeys(version: string, roomId: string): Promise<Record<string, unknown>>
  recoverSessionKey(version: string, roomId: string, sessionId: string): Promise<Record<string, unknown>>
  exportKeys(version?: string): Promise<ExportResult>
  importKeys(roomKeys: Array<Record<string, unknown>>, version?: string): Promise<ImportResult>
}

// ============================================
// Device Trust Manager 扩展 (SDK Manager Layer)
// ============================================

// 取值与后端 `synapse-e2ee/src/device_trust/models.rs::DeviceTrustLevel` 的 Display 一致：
// 只有 verified / unverified / blocked 三个值。旧声明的 'cross_signed' / 'blacklisted'
// 后端永远不会返回（'blacklisted' 拼写错误，真实值是 'blocked'）。
export type TrustLevel = 'verified' | 'unverified' | 'blocked'

// ============================================
// Secure Backup Manager 扩展 (SDK Manager Layer)
// ============================================

export interface SecureBackupKeysResponse {
  count: number
  message?: string
}

export interface SecureBackupRestoreResponse {
  recovered_keys: number
  total_keys: number
}

export interface SecureBackupVerifyResponse {
  valid: boolean
}

export interface SecureBackupManager {
  createSecureBackup(passphrase: string): Promise<SecureBackupInfo>
  getSecureBackup(backupId: string, forceRefresh?: boolean): Promise<SecureBackupInfo>
  deleteSecureBackup(backupId: string): Promise<void>
  addKeysToSecureBackup(
    backupId: string,
    passphrase: string,
    /** SDK 真身字段为 { room_id, session_id, session_key }（不是 session_data） */
    sessionKeys: Array<{ room_id: string; session_id: string; session_key: string }>
  ): Promise<SecureBackupKeysResponse>
  restoreFromSecureBackup(backupId: string, passphrase: string): Promise<SecureBackupRestoreResponse>
  verifySecureBackup(backupId: string, passphrase: string): Promise<SecureBackupVerifyResponse>
  clearCache(): void
}

// ============================================
// MatrixClient 扩展
// ============================================

export interface MatrixClientExtended extends MatrixClient {
  getDeviceManager?(): DeviceManager | null
  getPushManager?(): PushManager | null // SDK-7: Push 管理器扩展
  getCrypto(): CryptoApi | null
  getKeyBackupManager?(): KeyBackupManager | null
  getDeviceKeysManager?(): import('matrix-js-sdk/device-keys').DeviceKeysManager | null
  getCryptoKeysManager?(): import('matrix-js-sdk/crypto-keys').CryptoKeysManager | null
  getSDKKeyBackupManager?(): import('matrix-js-sdk/key-backup').KeyBackupManager | null
  getSecureBackupManager?(): SecureBackupManager | null
  // 以下为真实 SDK 成员（保留）：
  setDeviceVerified?(userId: string, deviceId: string, verified?: boolean): Promise<void>
  isCrossSigningReady?(): Promise<boolean>
}

// ============================================
// Event 扩展
// ============================================

// ============================================
// HTTP 扩展
// ============================================
