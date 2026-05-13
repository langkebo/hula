/**
 * Matrix SDK 扩展类型定义
 *
 * 为 matrix-js-sdk 提供额外的类型定义，避免使用 any 类型
 */

import type { MatrixClient } from 'matrix-js-sdk'

// ============================================
// Crypto API 扩展
// ============================================

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
  isCrossSigningVerified(): boolean
  isTofu(): boolean
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
  isCrossSigningVerified(): boolean
  isTofu(): boolean
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
  getDeviceVerificationStatus(userId: string, deviceId: string): Promise<DeviceVerificationStatus>
  verificationRequests?: Map<string, VerificationRequest>
  getOwnDeviceKeys(): Promise<{ ed25519: string; curve25519: string }>
  isSecretStorageReady(): Promise<boolean>
  bootstrapSecretStorage(opts?: { setupNewSecretStorage?: boolean; setupNewKeyBackup?: boolean }): Promise<void>
  bootstrapCrossSigning(opts: {
    authUploadDeviceSigningKeys: (makeRequest: (authData: unknown) => Promise<unknown>) => Promise<unknown>
  }): Promise<void>
  getCrossSigningStatus(): Promise<{
    crossSigningVerifiedOnDevice: boolean
    crossSigningPrivateKeysInStorage: boolean
    masterPublicKeyInStorage: boolean
  }>
  isCrossSigningReady(): Promise<boolean>
  restoreKeyBackup(
    key: string | Uint8Array,
    targetRoomId?: string,
    targetSessionId?: string
  ): Promise<{ imported: number; total: number }>
  resetKeyBackup(): Promise<{ version: string }>
  prepareKeyBackupVersion(
    key?: string,
    opts?: Record<string, unknown>
  ): Promise<{ version: string; algorithm: string; auth_data: Record<string, unknown> }>
  getKeyBackupVersion(
    version?: string
  ): Promise<{ version: string; algorithm: string; auth_data: Record<string, unknown>; count: number; etag: string }>
  deleteKeyBackupVersion(version: string): Promise<void>
  exportRoomKeys(opts?: Record<string, unknown>): Promise<Array<Record<string, unknown>>>
  importRoomKeys(
    keys: Array<Record<string, unknown>>,
    opts?: Record<string, unknown>
  ): Promise<{ imported: number; total: number; errors: Array<Record<string, unknown>> }>
  resetCrossSigningKeys(opts?: Record<string, unknown>): Promise<void>
  getUserDeviceInfo(userId: string, timeoutMs?: number): Promise<unknown>
  setDeviceVerified(userId: string, deviceId: string): Promise<void>
  setDeviceBlocked(userId: string, deviceId: string): Promise<void>
  setDeviceKnown(userId: string, deviceId: string): Promise<void>
  verifyDevice(userId: string, deviceId: string): Promise<void>
  requestVerification(userId: string, devices?: string[]): Promise<unknown>
  startVerification(request: unknown): Promise<unknown>
  acceptVerification(request: unknown): Promise<unknown>
  cancelVerification(request: unknown): Promise<void>
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
  updateDevice(deviceId: string, displayName: string): Promise<void>
  deleteDevice(deviceId: string, auth?: AuthDict): Promise<void>
  deleteDevices(deviceIds: string[], auth?: AuthDict): Promise<void>
  getDeviceListUpdates(users: string[], since?: string): Promise<DeviceListUpdatesResponse>
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
}

// ============================================
// Device Trust Manager 扩展 (SDK Manager Layer)
// ============================================

export type TrustLevel = 'verified' | 'cross_signed' | 'unverified' | 'unknown' | 'blacklisted'

export interface IDeviceTrustInfo {
  device_id: string
  user_id: string
  display_name?: string
  trust_level: TrustLevel
  last_seen_ts?: number
  last_seen_ip?: string
  is_verified: boolean
  is_cross_signed: boolean
  is_blacklisted: boolean
}

export interface IDeviceVerificationRequest {
  new_device_id: string
  device_id: string
  method?: 'sas' | 'qr_code'
}

export interface IDeviceVerificationResponse {
  token: string
  expires_at: number
  device_id: string
  new_device_id: string
  method: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
}

export interface IVerificationRespondResult {
  success: boolean
  message?: string
}

export interface ISecuritySummary {
  total_devices: number
  verified_devices: number
  unverified_devices: number
  blacklisted_devices: number
  cross_signed_devices: number
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
  success: boolean
  key_count: number
  message?: string
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
  getCrypto(): CryptoApi | null
  getKeyBackupManager?(): KeyBackupManager | null
  getDeviceTrustManager?(): DeviceTrustManager | null
  getSecureBackupManager?(): SecureBackupManager | null
  checkUserTrust?(userId: string): Promise<LegacyUserTrustInfo>
  checkDeviceTrust?(userId: string, deviceId: string): Promise<LegacyDeviceTrustInfo>
  getStoredDevicesForUser?(userId: string): Promise<LegacyStoredDevice[]>
  getStoredDevice?(userId: string, deviceId: string): LegacyStoredDevice | null
  getVerificationRequestsToDevice?(userId: string): LegacyVerificationRequest[]
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
