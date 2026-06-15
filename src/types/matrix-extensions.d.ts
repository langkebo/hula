/**
 * Matrix SDK 扩展类型定义
 *
 * 为 matrix-js-sdk 提供额外的类型定义，避免使用 any 类型
 */

import type { IPusher, IPusherRequest, MatrixClient } from 'matrix-js-sdk'

// ============================================
// Crypto API 扩展
// ============================================

export interface GeneratedSecretStorageKey {
  keyInfo: {
    passphrase?: {
      algorithm: string
      iterations: number
      salt: string
      bits?: number
    }
    algorithm: string
    iv: string
    mac: string
  }
  encodedPrivateKey: string
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

export interface LegacyStoredDevice {
  deviceId: string
  userId: string
  displayName?: string
  isVerified(): boolean
  isUnverified(): boolean
}

export interface LegacyDeviceTrustInfo {
  isVerified(): boolean
  readonly crossSigningVerified: boolean
  readonly tofu: boolean
}

export interface LegacyUserTrustInfo extends LegacyDeviceTrustInfo {
  wasCrossSigningVerified(): boolean
}

export interface LegacyVerificationRequest {
  transactionId?: string
  userId?: string
  deviceId?: string
  methods?: string[]
  phase?: string
}

export interface CryptoApi {
  requestDeviceVerification(userId: string, deviceId: string): Promise<VerificationRequest>
  getDeviceVerificationStatus(userId: string, deviceId: string): Promise<DeviceVerificationStatus | null>
  verificationRequests?: Map<string, VerificationRequest>
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
  restoreKeyBackup(opts?: KeyBackupRestoreOpts): Promise<KeyBackupRestoreResult>
  restoreKeyBackupWithPassphrase(passphrase: string, opts?: KeyBackupRestoreOpts): Promise<KeyBackupRestoreResult>
  resetKeyBackup(auth?: MatrixAuthData): Promise<void>
  prepareKeyBackupVersion(
    key?: string,
    opts?: Record<string, unknown>
  ): Promise<{ version: string; algorithm: string; auth_data: Record<string, unknown> }>
  getKeyBackupInfo(): Promise<KeyBackupInfo | null>
  deleteKeyBackupVersion(version: string): Promise<void>
  exportRoomKeys(opts?: Record<string, unknown>): Promise<Array<Record<string, unknown>>>
  importRoomKeys(keys: Array<Record<string, unknown>>, opts?: Record<string, unknown>): Promise<void>
  resetCrossSigningKeys(opts?: Record<string, unknown>): Promise<void>
  getUserDeviceInfo(userId: string, timeoutMs?: number): Promise<unknown>
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
  deleteDevices(deviceIds: string[], auth?: AuthDict): Promise<void>
  getDeviceListUpdates(users: string[], since?: string): Promise<DeviceListUpdatesResponse>
}

// SDK-9: 设备更新请求类型
export interface IDeviceUpdateRequest {
  display_name?: string
}

// SDK-7: Push 管理器类型
export interface PushManager {
  setPusher(pusher: IPusherRequest): Promise<void>
  removePusher(pushkey: string, appId: string, deviceId?: string): Promise<void>
  getPushers(forceRefresh?: boolean): Promise<IPusher[]>
}

export interface DeviceListUpdatesResponse {
  changed: string[]
  left: string[]
  deleted?: string[]
  stream_id?: number
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
  prepareKeyBackupVersion(key?: Uint8Array): Promise<{
    algorithm: string
    auth_data: Record<string, unknown>
    privateKey: Uint8Array
  }>
  createKeyBackupVersion(info: { algorithm: string; auth_data: Record<string, unknown> }): Promise<{ version: string }>
  deleteKeyBackupVersion(version: string): Promise<void>
  restoreKeyBackupWithRecoveryKey(
    recoveryKey: string,
    roomId?: string,
    sessionId?: string,
    backupInfo?: BackupInfo
  ): Promise<{ total: number; imported: number }>
  scheduleKeyBackupSend(): void
  getLatestBackupVersion(forceRefresh?: boolean): Promise<BackupInfo>
  getBackupVersion(version: string, forceRefresh?: boolean): Promise<BackupInfo>
  createBackupVersion(
    algorithm?: string,
    authData?: Record<string, unknown>,
    auth?: Record<string, unknown>
  ): Promise<{ version: string }>
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

export type TrustLevel = 'verified' | 'cross_signed' | 'unverified' | 'blacklisted'

export interface IDeviceTrustInfo {
  device_id: string
  user_id?: string
  display_name?: string
  trust_level: TrustLevel
  last_seen_ts?: number
  last_seen_ip?: string
  verified_at?: number
  verified_by?: string
}

export interface IDeviceVerificationRequest {
  new_device_id?: string
  device_id?: string
  method?: 'sas' | 'qr' | 'emoji'
}

export interface IDeviceVerificationResponse {
  request_token: string
  token: string
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'not_found'
  expires_at: number
  methods_available: ('sas' | 'qr' | 'emoji')[]
}

export interface IVerificationRespondResult {
  success: boolean
  trust_level: TrustLevel
}

export interface ISecuritySummary {
  verified_devices: number
  unverified_devices: number
  blocked_devices: number
  has_cross_signing_master: boolean
  security_score: number
  recommendations: string[]
}

export interface DeviceTrustManager {
  requestVerification(request: IDeviceVerificationRequest): Promise<IDeviceVerificationResponse>
  respondToVerification(token: string, approved: boolean): Promise<IVerificationRespondResult>
  getVerificationStatus(token: string): Promise<IDeviceVerificationResponse>
  getDeviceTrustList(forceRefresh?: boolean): Promise<IDeviceTrustInfo[]>
  getDeviceTrust(deviceId: string, forceRefresh?: boolean): Promise<IDeviceTrustInfo | null>
  getSecuritySummary(forceRefresh?: boolean): Promise<ISecuritySummary>
}

// ============================================
// Secure Backup Manager 扩展 (SDK Manager Layer)
// ============================================

export interface SecureBackupInfo {
  backup_id: string
  algorithm: string
  auth_data: Record<string, unknown>
  created_ts: number
  key_count?: number
  version?: string
}

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
    sessionKeys: Array<{ session_id: string; session_data: Record<string, unknown> }>
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
  getKeyVerificationManager?(): import('matrix-js-sdk/key-verification').KeyVerificationManager | null
  getSDKKeyBackupManager?(): import('matrix-js-sdk/key-backup').KeyBackupManager | null
  getDeviceTrustManager?(): DeviceTrustManager | null
  getSecureBackupManager?(): SecureBackupManager | null
  checkUserTrust?(userId: string): Promise<LegacyUserTrustInfo>
  checkDeviceTrust?(userId: string, deviceId: string): Promise<LegacyDeviceTrustInfo>
  getStoredDevicesForUser?(userId: string): Promise<LegacyStoredDevice[]>
  getStoredDevice?(userId: string, deviceId: string): LegacyStoredDevice | null
  getVerificationRequestsToDevice?(userId: string): LegacyVerificationRequest[]
  setDeviceVerified?(userId: string, deviceId: string, verified?: boolean): Promise<void>
  setDeviceBlocked?(userId: string, deviceId: string, blocked: boolean): Promise<void>
  isCrossSigningReady?(): Promise<boolean>
}

// ============================================
// Event 扩展
// ============================================

// ============================================
// HTTP 扩展
// ============================================

export interface MatrixHttpApi {
  authedRequest<T = unknown>(
    method: string,
    path: string,
    queryParams?: Record<string, unknown>,
    data?: unknown,
    opts?: {
      prefix?: string
      headers?: Record<string, string>
    }
  ): Promise<T>

  request<T = unknown>(
    method: string,
    path: string,
    queryParams?: Record<string, unknown>,
    data?: unknown,
    opts?: {
      prefix?: string
      headers?: Record<string, string>
    }
  ): Promise<T>
}
