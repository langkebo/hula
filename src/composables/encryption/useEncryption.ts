import { type Ref, ref } from 'vue'
import { cryptoHealthMonitor } from '@/services/matrix/crypto/CryptoHealthMonitor'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { matrixEncryptionContextService } from '@/services/matrix/crypto/MatrixEncryptionContextService'
import { matrixEncryptionService } from '@/services/matrix/crypto/MatrixEncryptionService'
import { matrixKeyBackupService } from '@/services/matrix/crypto/MatrixKeyBackupService'
import { matrixVerificationService, type VerificationRequest } from '@/services/matrix/crypto/MatrixVerificationService'
import type {
  CrossSigningInfo,
  VerificationRequest as CryptoVerificationRequest,
  EncryptionSettings,
  KeyBackupInfo,
  KeyRotationRecord,
  KeyRotationStatus,
  SetupKeyBackupOptions
} from '@/services/matrix/crypto/types'

export type { CryptoHealthStatus, KeyRotationRecord } from '@/services/matrix/crypto/types'

interface UseEncryptionResult {
  isEncryptionEnabled: Ref<boolean>
  isCrossSigningReady: Ref<boolean>

  isEncryptionAvailable: () => Promise<boolean>
  isRoomEncrypted: (roomId: string) => Promise<boolean>
  enableRoomEncryption: (roomId: string, settings?: Partial<EncryptionSettings>) => Promise<void>
  getEncryptionSettings: (roomId: string) => Promise<EncryptionSettings | null>

  getCrossSigningInfo: () => Promise<CrossSigningInfo>
  setupCrossSigning: (authParams?: { password?: string; authData?: unknown }) => Promise<void>
  resetCrossSigning: () => Promise<void>
  checkCrossSigningReady: () => Promise<boolean>

  setupKeyBackup: (input?: string | SetupKeyBackupOptions) => Promise<string>
  getKeyBackupInfo: () => Promise<KeyBackupInfo | null>
  restoreFromBackup: (recoveryKey: string) => Promise<{ imported: number; total: number }>
  restoreFromBackupWithPassphrase: (passphrase: string) => Promise<{ imported: number; total: number }>
  deleteKeyBackup: () => Promise<void>
  prepareKeyBackupVersionAuthData: () => Promise<Record<string, unknown> | null>

  getKeyRotationStatus: () => Promise<KeyRotationStatus>
  rotateKeys: () => Promise<{ success: boolean; keyId: string; rotatedAt: number }>
  getCurrentDeviceId: () => string | null
  getRotationHistory: (deviceId: string) => Promise<KeyRotationRecord[]>
  configureKeyRotation: (enabled: boolean, intervalDays?: number) => Promise<void>
  checkNeedsRotation: () => Promise<boolean>
  revokeOldKeys: (deviceId: string, keyIds: string[]) => Promise<number>

  trustDevice: (userId: string, deviceId: string) => Promise<void>
  untrustDevice: (userId: string, deviceId: string) => Promise<void>
  blockDevice: (userId: string, deviceId: string) => Promise<void>
  unblockDevice: (userId: string, deviceId: string) => Promise<void>
  getDeviceTrustLevel: (
    userId: string,
    deviceId: string
  ) => Promise<{
    isVerified: boolean
    isCrossSigningVerified: boolean
    isTofu: boolean
  }>
  requestDeviceVerification: (
    userId: string,
    deviceId: string,
    methods?: string[]
  ) => Promise<CryptoVerificationRequest>
  requestUserVerification: (userId: string, methods?: string[]) => Promise<CryptoVerificationRequest>

  startSasVerification: (userId: string, deviceId: string) => Promise<string>
  acceptVerification: (transactionId: string) => Promise<void>
  confirmSas: (transactionId: string) => Promise<void>
  cancelVerification: (transactionId: string, reason: string) => Promise<void>
  getPendingVerifications: () => Promise<VerificationRequest[]>
  getQrCodeShow: () => Promise<{ qr_code: string; transaction_id: string } | null>
  scanQrCode: (qrCodeData: string) => Promise<boolean>

  exportRoomKeys: () => Promise<string>
  importRoomKeys: (keysJson: string) => Promise<{ imported: number; total: number }>
  getUnverifiedDevicesInRoom: (roomId: string) => Promise<string[]>

  getCurrentSessionContext: () => { userId: string | null; deviceId: string | null; isCryptoEnabled: boolean }
  getDeviceFingerprint: (userId?: string | null, deviceId?: string | null) => Promise<string | null>

  getHealthStatus: () => Promise<import('@/services/matrix/crypto/CryptoHealthMonitor').CryptoHealthStatus>
  registerHealthCallbacks: (
    callbacks: import('@/services/matrix/crypto/CryptoHealthMonitor').CryptoHealthCallbacks
  ) => void
  startHealthMonitor: () => void
  stopHealthMonitor: () => void
}

export function useEncryption(): UseEncryptionResult {
  const isEncryptionEnabled = ref(false)
  const isCrossSigningReady = ref(false)

  async function isEncryptionAvailable() {
    return cryptoSDKAdapter.isEncryptionAvailable()
  }

  async function isRoomEncrypted(roomId: string) {
    return cryptoSDKAdapter.isRoomEncrypted(roomId)
  }

  async function enableRoomEncryption(roomId: string, settings?: Partial<EncryptionSettings>) {
    await matrixCryptoService.enableEncryption(
      roomId,
      settings?.algorithm as import('@/services/matrix/crypto/MatrixCryptoService').EncryptionAlgorithm | undefined
    )
  }

  async function getEncryptionSettings(roomId: string) {
    return matrixEncryptionService.getEncryptionSettings(roomId)
  }

  async function getCrossSigningInfo() {
    const status = await cryptoSDKAdapter.getCrossSigningStatus()
    return {
      isSetup: status.isSetup,
      masterPublicKey: status.masterPublicKey,
      selfSigningPublicKey: status.selfSigningPublicKey,
      userSigningPublicKey: status.userSigningPublicKey
    } satisfies CrossSigningInfo
  }

  async function setupCrossSigning(authParams?: { password?: string; authData?: unknown }) {
    await cryptoSDKAdapter.setupCrossSigning(authParams)
  }

  async function resetCrossSigning() {}

  async function checkCrossSigningReady() {
    const ready = await cryptoSDKAdapter.isCrossSigningReady()
    isCrossSigningReady.value = ready
    return ready
  }

  async function setupKeyBackup(input?: string | SetupKeyBackupOptions) {
    return cryptoSDKAdapter.setupKeyBackupWithOptions(input)
  }

  async function getKeyBackupInfo() {
    const backup = await matrixKeyBackupService.checkKeyBackup()
    if (!backup) return null
    return {
      version: backup.version,
      algorithm: backup.algorithm,
      authData: backup.auth_data,
      count: backup.count ?? 0,
      etag: backup.etag ?? ''
    } satisfies KeyBackupInfo
  }

  async function restoreFromBackup(recoveryKey: string) {
    return cryptoSDKAdapter.restoreFromBackup(recoveryKey)
  }

  async function restoreFromBackupWithPassphrase(passphrase: string) {
    return cryptoSDKAdapter.restoreFromBackupWithPassphrase(passphrase)
  }

  async function deleteKeyBackup() {
    const backup = await matrixKeyBackupService.checkKeyBackup()
    if (backup) {
      await matrixKeyBackupService.deleteKeyBackupVersion(backup.version)
    }
  }

  async function prepareKeyBackupVersionAuthData() {
    const prepared = await matrixEncryptionContextService.prepareKeyBackupVersion()
    return prepared?.authData ?? null
  }

  async function getKeyRotationStatus() {
    return matrixEncryptionService.getKeyRotationStatus()
  }

  async function rotateKeys() {
    return matrixEncryptionService.rotateKeys()
  }

  function getCurrentDeviceId() {
    return matrixEncryptionService.getCurrentDeviceId()
  }

  async function getRotationHistory(deviceId: string) {
    return matrixEncryptionService.getRotationHistory(deviceId)
  }

  async function configureKeyRotation(enabled: boolean, intervalDays?: number) {
    await matrixEncryptionService.configureKeyRotation(enabled, intervalDays)
  }

  async function checkNeedsRotation() {
    return matrixEncryptionService.checkNeedsRotation()
  }

  async function revokeOldKeys(deviceId: string, keyIds: string[]) {
    return matrixEncryptionService.revokeOldKeys(deviceId, keyIds)
  }

  async function trustDevice(userId: string, deviceId: string) {
    await matrixCryptoService.verifyDevice(userId, deviceId)
  }

  async function untrustDevice(userId: string, deviceId: string) {
    await matrixCryptoService.unverifyDevice(userId, deviceId)
  }

  async function blockDevice(userId: string, deviceId: string) {
    await cryptoSDKAdapter.blockDevice(userId, deviceId)
  }

  async function unblockDevice(userId: string, deviceId: string) {
    await cryptoSDKAdapter.unblockDevice(userId, deviceId)
  }

  async function getDeviceTrustLevel(userId: string, deviceId: string) {
    const status = await matrixCryptoService.getDeviceVerificationStatus(userId, deviceId)
    return {
      isVerified: status.verified,
      isCrossSigningVerified: status.crossSigningVerified,
      isTofu: false
    }
  }

  async function requestDeviceVerification(userId: string, deviceId: string, _methods?: string[]) {
    return matrixCryptoService.requestDeviceVerification(userId, deviceId) as unknown as Promise<VerificationRequest>
  }

  async function requestUserVerification(userId: string, _methods?: string[]) {
    return matrixVerificationService.startSasVerification(userId, '') as unknown as Promise<VerificationRequest>
  }

  async function exportRoomKeys() {
    const result = await cryptoSDKAdapter.exportKeys()
    return result.data
  }

  async function importRoomKeys(keysJson: string) {
    return cryptoSDKAdapter.importKeys(keysJson)
  }

  async function getUnverifiedDevicesInRoom(_roomId: string) {
    return [] as string[]
  }

  function getCurrentSessionContext() {
    return matrixEncryptionContextService.getCurrentSessionContext()
  }

  async function getDeviceFingerprint(userId?: string | null, deviceId?: string | null) {
    return matrixEncryptionContextService.getDeviceFingerprint(userId, deviceId)
  }

  async function getHealthStatus() {
    return cryptoHealthMonitor.performCheck()
  }

  function registerHealthCallbacks(
    callbacks: import('@/services/matrix/crypto/CryptoHealthMonitor').CryptoHealthCallbacks
  ) {
    cryptoHealthMonitor.registerCallbacks(callbacks)
  }

  function startHealthMonitor() {
    cryptoHealthMonitor.start()
  }

  function stopHealthMonitor() {
    cryptoHealthMonitor.stop()
  }

  return {
    isEncryptionEnabled,
    isCrossSigningReady,
    isEncryptionAvailable,
    isRoomEncrypted,
    enableRoomEncryption,
    getEncryptionSettings,
    getCrossSigningInfo,
    setupCrossSigning,
    resetCrossSigning,
    checkCrossSigningReady,
    setupKeyBackup,
    getKeyBackupInfo,
    restoreFromBackup,
    restoreFromBackupWithPassphrase,
    deleteKeyBackup,
    prepareKeyBackupVersionAuthData,
    getKeyRotationStatus,
    rotateKeys,
    getCurrentDeviceId,
    getRotationHistory,
    configureKeyRotation,
    checkNeedsRotation,
    revokeOldKeys,
    trustDevice,
    untrustDevice,
    blockDevice,
    unblockDevice,
    getDeviceTrustLevel,
    requestDeviceVerification,
    requestUserVerification,
    startSasVerification: matrixVerificationService.startSasVerification,
    acceptVerification: matrixVerificationService.acceptVerification,
    confirmSas: matrixVerificationService.confirmSas,
    cancelVerification: matrixVerificationService.cancelVerification,
    getPendingVerifications: matrixVerificationService.getPendingVerifications,
    getQrCodeShow: matrixVerificationService.getQrCodeShow,
    scanQrCode: matrixVerificationService.scanQrCode,
    exportRoomKeys,
    importRoomKeys,
    getUnverifiedDevicesInRoom,
    getCurrentSessionContext,
    getDeviceFingerprint,
    getHealthStatus,
    registerHealthCallbacks,
    startHealthMonitor,
    stopHealthMonitor
  }
}
