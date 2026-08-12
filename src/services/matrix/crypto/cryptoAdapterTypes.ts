/**
 * cryptoAdapterTypes — shared types and accessors interface for CryptoSDKAdapter sub-adapters.
 *
 * Sub-adapters (CryptoDeviceAdapter / CryptoKeyBackupAdapter / CryptoSecurityAdapter)
 * receive a CryptoAdapterAccessors instance to access the underlying SDK managers,
 * keeping CryptoSDKAdapter as the single owner of client/cache state.
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
  KeyBackupManager,
  MatrixClientExtended,
  SecureBackupManager
} from '@/types/matrix-extensions'

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

export interface CrossSigningStatusResult {
  privateKeysCached: boolean
  crossSigningVerified: boolean
  isSetup: boolean
  masterPublicKey?: string
  selfSigningPublicKey?: string
  userSigningPublicKey?: string
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
  getDeviceTrustManager(): DeviceTrustManager | null
  getSecureBackupManager(): SecureBackupManager | null
  getKeyBackupManager(): KeyBackupManager | null
  getSDKDeviceKeysManager(): DeviceKeysManager | null
  getSDKKeyBackupManager(): SDKKeyBackupManager | null
  getSDKKeyVerificationManager(): KeyVerificationManager | null
}
