/**
 * Crypto Service Types
 *
 * Centralized type definitions for matrix crypto services.
 * All types previously defined inline in individual services are consolidated here.
 */

import type { RoomSessions, BackupVersionInfo as SDKBackupVersionInfo, SessionData } from 'matrix-js-sdk/key-backup'
import type {
  GeneratedSecretStorageKey,
  SecureBackupInfo,
  SecureBackupRestoreResponse
} from '@/types/matrix-extensions'

// ============================================
// Device Types
// ============================================

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
}

export interface VerificationStatus {
  verified: boolean
  crossSigningVerified: boolean
  devicesCrossSigningVerified: boolean
}

// ============================================
// Cross Signing Types
// ============================================

export interface CrossSigningStatus {
  privateKeysCached: boolean
  crossSigningVerified: boolean
}

export interface CrossSigningStatusResult {
  privateKeysCached: boolean
  crossSigningVerified: boolean
  isSetup: boolean
  masterPublicKey?: string
  selfSigningPublicKey?: string
  userSigningPublicKey?: string
}

// ============================================
// Key Backup Types
// ============================================

/** SDK KeyBackupVersionInfo (alias for matrix-js-sdk type) */
export type KeyBackupVersionInfo = SDKBackupVersionInfo

export interface BackupVersionInfo extends SDKBackupVersionInfo {}

export interface BackupVersion {
  version: string
  algorithm: string
  auth_data: Record<string, unknown> | AuthData | Aes256AuthData
  count?: number
  etag?: string
}

export interface KeyBackupWriteResult {
  etag: string
  count: number
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

export type RoomKeysResponse = RoomKeyBackup
export type RoomKeySessionsResponse = RoomSessions
export type SessionKeyData = SessionData

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

export interface RestoreBackupResult {
  total: number
  imported: number
}

export interface CreateKeyBackupVersionRequest {
  algorithm: string
  auth_data: Record<string, unknown>
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

// ============================================
// SAS / QR Verification Types
// ============================================

export type EncryptionAlgorithm = 'm.megolm.v1.aes-sha2' | 'm.olm.v1.curve25519-aes-sha2'

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

// ============================================
// Verification Service Types
// ============================================

export type VerificationMethod = 'm.sas.v1' | 'm.qr_code.show.v1' | 'm.reciprocate.v1'

export interface VerificationRequest {
  transactionId: string
  userId: string
  deviceId: string
  methods: VerificationMethod[]
  timestamp: number
}

// ============================================
// Encryption Service Types
// ============================================

export interface EncryptionSettings {
  algorithm: string
  rotationPeriodMs: number
  rotationPeriodMsgs: number
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

// ============================================
// Dehydrated Device Types
// ============================================

export interface DehydratedDevice {
  deviceId: string
  userId: string
  initialDeviceDisplayName?: string
  deviceData?: Record<string, unknown>
  createdAt: number
  expiresAt?: number
}

export interface CreateDehydratedDeviceParams {
  initialDeviceDisplayName?: string
  deviceData?: Record<string, unknown>
}

// ============================================
// Encryption Context Types
// ============================================

export interface MatrixEncryptionSessionContext {
  userId: string | null
  deviceId: string | null
  isCryptoEnabled: boolean
}

export interface PreparedKeyBackupVersion {
  algorithm: string
  authData: Record<string, unknown>
  privateKey: Uint8Array
}

export interface CryptoKeyBackupPreparer {
  prepareKeyBackupVersion?(key?: Uint8Array): Promise<{
    algorithm: string
    auth_data: Record<string, unknown>
    privateKey: Uint8Array
  }>
}

export interface StoredDeviceLike {
  getFingerprint?(): string | undefined
}

// ============================================
// Crypto Health Monitor Types
// ============================================

export interface CryptoHealthStatus {
  hasUnverifiedDevices: boolean
  isKeyBackupSynced: boolean
  undecryptableMessageCount: number
  crossSigningReady: boolean
  lastCheckTime: number
}

export interface CryptoHealthCallbacks {
  onHealthStatusChange?: (status: CryptoHealthStatus) => void
  onKeyRequestTriggered?: (roomId: string, sessionId: string) => void
  onBackupNeeded?: () => void
}

// ============================================
// E2EE Bootstrap Types
// ============================================

export interface E2EEStatus {
  isInitialized: boolean
  isCryptoEnabled: boolean
  isCrossSigningReady: boolean
  isKeyBackupEnabled: boolean
}

// ============================================
// Re-export from matrix-extensions for convenience
// ============================================

export type { GeneratedSecretStorageKey, SecureBackupInfo, SecureBackupRestoreResponse }

// ============================================
// Legacy/Deprecated Types (for backward compatibility)
// ============================================

/**
 * @deprecated Use CrossSigningStatusResult instead
 */
export interface CrossSigningInfo {
  publicKey: string
  signatures: Record<string, Record<string, string>>
}

/**
 * @deprecated Use BackupVersionInfo instead
 */
export interface KeyBackupInfo {
  version: string
  algorithm: string
  authData: Record<string, unknown>
}

/**
 * @deprecated Use KeyBackupSetupResult instead
 */
export interface SetupKeyBackupOptions {
  createNewBackup?: boolean
  recoveryKey?: string
}
