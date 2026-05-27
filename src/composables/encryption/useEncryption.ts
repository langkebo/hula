import { type Ref, ref } from 'vue'
import { cryptoHealthMonitor } from '@/services/matrix/crypto/CryptoHealthMonitor'
import { matrixEncryptionContextService } from '@/services/matrix/crypto/MatrixEncryptionContextService'
import {
  type CrossSigningInfo,
  type VerificationRequest as CryptoVerificationRequest,
  type EncryptionSettings,
  type KeyBackupInfo,
  type KeyRotationRecord,
  type KeyRotationStatus,
  matrixEncryptionService,
  type SetupKeyBackupOptions
} from '@/services/matrix/crypto/MatrixEncryptionService'
import { matrixVerificationService, type VerificationRequest } from '@/services/matrix/crypto/MatrixVerificationService'

export type { CryptoHealthStatus } from '@/services/matrix/crypto/CryptoHealthMonitor'
export type {
  MatrixEncryptionSessionContext,
  PreparedKeyBackupVersion
} from '@/services/matrix/crypto/MatrixEncryptionContextService'
export type {
  CrossSigningInfo,
  EncryptionSettings,
  KeyBackupInfo,
  KeyRotationRecord,
  KeyRotationStatus,
  SetupKeyBackupOptions
} from '@/services/matrix/crypto/MatrixEncryptionService'
export type { VerificationRequest } from '@/services/matrix/crypto/MatrixVerificationService'

export interface UseEncryptionResult {
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
    return matrixEncryptionService.isEncryptionAvailable()
  }

  async function isRoomEncrypted(roomId: string) {
    return matrixEncryptionService.isRoomEncrypted(roomId)
  }

  async function enableRoomEncryption(roomId: string, settings?: Partial<EncryptionSettings>) {
    await matrixEncryptionService.enableRoomEncryption(roomId, settings)
  }

  async function getEncryptionSettings(roomId: string) {
    return matrixEncryptionService.getEncryptionSettings(roomId)
  }

  async function getCrossSigningInfo() {
    return matrixEncryptionService.getCrossSigningInfo()
  }

  async function setupCrossSigning(authParams?: { password?: string; authData?: unknown }) {
    await matrixEncryptionService.setupCrossSigning(authParams)
  }

  async function resetCrossSigning() {
    await matrixEncryptionService.resetCrossSigning()
  }

  async function checkCrossSigningReady() {
    const ready = await matrixEncryptionService.isCrossSigningReady()
    isCrossSigningReady.value = ready
    return ready
  }

  async function setupKeyBackup(input?: string | SetupKeyBackupOptions) {
    return matrixEncryptionService.setupKeyBackup(input)
  }

  async function getKeyBackupInfo() {
    return matrixEncryptionService.getKeyBackupInfo()
  }

  async function restoreFromBackup(recoveryKey: string) {
    return matrixEncryptionService.restoreFromBackup(recoveryKey)
  }

  async function restoreFromBackupWithPassphrase(passphrase: string) {
    return matrixEncryptionService.restoreFromBackupWithPassphrase(passphrase)
  }

  async function deleteKeyBackup() {
    await matrixEncryptionService.deleteKeyBackup()
  }

  async function prepareKeyBackupVersionAuthData() {
    return matrixEncryptionService.prepareKeyBackupVersionAuthData()
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
    await matrixEncryptionService.trustDevice(userId, deviceId)
  }

  async function untrustDevice(userId: string, deviceId: string) {
    await matrixEncryptionService.untrustDevice(userId, deviceId)
  }

  async function blockDevice(userId: string, deviceId: string) {
    await matrixEncryptionService.blockDevice(userId, deviceId)
  }

  async function unblockDevice(userId: string, deviceId: string) {
    await matrixEncryptionService.unblockDevice(userId, deviceId)
  }

  async function getDeviceTrustLevel(userId: string, deviceId: string) {
    return matrixEncryptionService.getDeviceTrustLevel(userId, deviceId)
  }

  async function requestDeviceVerification(userId: string, deviceId: string, methods?: string[]) {
    return matrixEncryptionService.requestDeviceVerification(userId, deviceId, methods)
  }

  async function requestUserVerification(userId: string, methods?: string[]) {
    return matrixEncryptionService.requestUserVerification(userId, methods)
  }

  async function exportRoomKeys() {
    return matrixEncryptionService.exportRoomKeys()
  }

  async function importRoomKeys(keysJson: string) {
    return matrixEncryptionService.importRoomKeys(keysJson)
  }

  async function getUnverifiedDevicesInRoom(roomId: string) {
    return matrixEncryptionService.getUnverifiedDevicesInRoom(roomId)
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
