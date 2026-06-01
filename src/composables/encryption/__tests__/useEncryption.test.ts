import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockPerformCheck,
  mockRegisterCallbacks,
  mockStart,
  mockStop,
  mockGetCurrentSessionContext,
  mockGetDeviceFingerprint,
  mockContextPrepareKeyBackupVersion,
  mockCryptoSDKIsEncryptionAvailable,
  mockCryptoSDKIsRoomEncrypted,
  mockCryptoSDKGetCrossSigningStatus,
  mockCryptoSDKSetupCrossSigning,
  mockCryptoSDKIsCrossSigningReady,
  mockCryptoSDKSetupKeyBackupWithOptions,
  mockCryptoSDKRestoreFromBackup,
  mockCryptoSDKExportKeys,
  mockCryptoSDKImportKeys,
  mockCryptoSDKBlockDevice,
  mockCryptoSDKUnblockDevice,
  mockKeyBackupCheckKeyBackup,
  mockKeyBackupDeleteKeyBackupVersion,
  mockMatrixCryptoEnableEncryption,
  mockMatrixCryptoVerifyDevice,
  mockMatrixCryptoUnverifyDevice,
  mockMatrixCryptoGetDeviceVerificationStatus,
  mockMatrixCryptoRequestDeviceVerification,
  mockVerificationStartSasVerification,
  mockGetEncryptionSettings,
  mockGetKeyRotationStatus,
  mockRotateKeys,
  mockGetCurrentDeviceId,
  mockGetRotationHistory,
  mockConfigureKeyRotation
} = vi.hoisted(() => ({
  mockPerformCheck: vi.fn(),
  mockRegisterCallbacks: vi.fn(),
  mockStart: vi.fn(),
  mockStop: vi.fn(),
  mockGetCurrentSessionContext: vi.fn(),
  mockGetDeviceFingerprint: vi.fn(),
  mockContextPrepareKeyBackupVersion: vi.fn(),
  mockCryptoSDKIsEncryptionAvailable: vi.fn(),
  mockCryptoSDKIsRoomEncrypted: vi.fn(),
  mockCryptoSDKGetCrossSigningStatus: vi.fn(),
  mockCryptoSDKSetupCrossSigning: vi.fn(),
  mockCryptoSDKIsCrossSigningReady: vi.fn(),
  mockCryptoSDKSetupKeyBackupWithOptions: vi.fn(),
  mockCryptoSDKRestoreFromBackup: vi.fn(),
  mockCryptoSDKExportKeys: vi.fn(),
  mockCryptoSDKImportKeys: vi.fn(),
  mockCryptoSDKBlockDevice: vi.fn(),
  mockCryptoSDKUnblockDevice: vi.fn(),
  mockKeyBackupCheckKeyBackup: vi.fn(),
  mockKeyBackupDeleteKeyBackupVersion: vi.fn(),
  mockMatrixCryptoEnableEncryption: vi.fn(),
  mockMatrixCryptoVerifyDevice: vi.fn(),
  mockMatrixCryptoUnverifyDevice: vi.fn(),
  mockMatrixCryptoGetDeviceVerificationStatus: vi.fn(),
  mockMatrixCryptoRequestDeviceVerification: vi.fn(),
  mockVerificationStartSasVerification: vi.fn(),
  mockGetEncryptionSettings: vi.fn(),
  mockGetKeyRotationStatus: vi.fn(),
  mockRotateKeys: vi.fn(),
  mockGetCurrentDeviceId: vi.fn(),
  mockGetRotationHistory: vi.fn(),
  mockConfigureKeyRotation: vi.fn()
}))

vi.mock('@/services/matrix/crypto/CryptoHealthMonitor', () => ({
  cryptoHealthMonitor: {
    performCheck: mockPerformCheck,
    registerCallbacks: mockRegisterCallbacks,
    start: mockStart,
    stop: mockStop
  }
}))

vi.mock('@/services/matrix/crypto/MatrixEncryptionContextService', () => ({
  matrixEncryptionContextService: {
    getCurrentSessionContext: mockGetCurrentSessionContext,
    getDeviceFingerprint: mockGetDeviceFingerprint,
    prepareKeyBackupVersion: mockContextPrepareKeyBackupVersion
  }
}))

vi.mock('@/services/matrix/crypto/CryptoSDKAdapter', () => ({
  cryptoSDKAdapter: {
    isEncryptionAvailable: mockCryptoSDKIsEncryptionAvailable,
    isRoomEncrypted: mockCryptoSDKIsRoomEncrypted,
    getCrossSigningStatus: mockCryptoSDKGetCrossSigningStatus,
    setupCrossSigning: mockCryptoSDKSetupCrossSigning,
    isCrossSigningReady: mockCryptoSDKIsCrossSigningReady,
    setupKeyBackupWithOptions: mockCryptoSDKSetupKeyBackupWithOptions,
    restoreFromBackup: mockCryptoSDKRestoreFromBackup,
    exportKeys: mockCryptoSDKExportKeys,
    importKeys: mockCryptoSDKImportKeys,
    blockDevice: mockCryptoSDKBlockDevice,
    unblockDevice: mockCryptoSDKUnblockDevice
  }
}))

vi.mock('@/services/matrix/crypto/MatrixKeyBackupService', () => ({
  matrixKeyBackupService: {
    checkKeyBackup: mockKeyBackupCheckKeyBackup,
    deleteKeyBackupVersion: mockKeyBackupDeleteKeyBackupVersion
  }
}))

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  matrixCryptoService: {
    enableEncryption: mockMatrixCryptoEnableEncryption,
    verifyDevice: mockMatrixCryptoVerifyDevice,
    unverifyDevice: mockMatrixCryptoUnverifyDevice,
    getDeviceVerificationStatus: mockMatrixCryptoGetDeviceVerificationStatus,
    requestDeviceVerification: mockMatrixCryptoRequestDeviceVerification
  }
}))

vi.mock('@/services/matrix/crypto/MatrixVerificationService', () => ({
  matrixVerificationService: {
    startSasVerification: mockVerificationStartSasVerification
  }
}))

vi.mock('@/services/matrix/crypto/MatrixEncryptionService', () => ({
  matrixEncryptionService: {
    getEncryptionSettings: mockGetEncryptionSettings,
    getKeyRotationStatus: mockGetKeyRotationStatus,
    rotateKeys: mockRotateKeys,
    getCurrentDeviceId: mockGetCurrentDeviceId,
    getRotationHistory: mockGetRotationHistory,
    configureKeyRotation: mockConfigureKeyRotation
  }
}))

import { useEncryption } from '../useEncryption'

describe('useEncryption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with isEncryptionEnabled=false and isCrossSigningReady=false', () => {
    const { isEncryptionEnabled, isCrossSigningReady } = useEncryption()
    expect(isEncryptionEnabled.value).toBe(false)
    expect(isCrossSigningReady.value).toBe(false)
  })

  describe('encryption availability & room encryption', () => {
    it('isEncryptionAvailable delegates to cryptoSDKAdapter', async () => {
      mockCryptoSDKIsEncryptionAvailable.mockResolvedValueOnce(true)
      const { isEncryptionAvailable } = useEncryption()
      const result = await isEncryptionAvailable()
      expect(result).toBe(true)
      expect(mockCryptoSDKIsEncryptionAvailable).toHaveBeenCalled()
    })

    it('isRoomEncrypted delegates to cryptoSDKAdapter', async () => {
      mockCryptoSDKIsRoomEncrypted.mockResolvedValueOnce(true)
      const { isRoomEncrypted } = useEncryption()
      const result = await isRoomEncrypted('!room1')
      expect(result).toBe(true)
      expect(mockCryptoSDKIsRoomEncrypted).toHaveBeenCalledWith('!room1')
    })

    it('enableRoomEncryption delegates to matrixCryptoService with settings', async () => {
      mockMatrixCryptoEnableEncryption.mockResolvedValueOnce(undefined)
      const { enableRoomEncryption } = useEncryption()
      await enableRoomEncryption('!room1', { algorithm: 'm.megolm.v1.aes-sha2' })
      expect(mockMatrixCryptoEnableEncryption).toHaveBeenCalledWith('!room1', 'm.megolm.v1.aes-sha2')
    })

    it('enableRoomEncryption works without settings', async () => {
      mockMatrixCryptoEnableEncryption.mockResolvedValueOnce(undefined)
      const { enableRoomEncryption } = useEncryption()
      await enableRoomEncryption('!room1')
      expect(mockMatrixCryptoEnableEncryption).toHaveBeenCalledWith('!room1', undefined)
    })

    it('getEncryptionSettings returns settings for a room', async () => {
      const settings = { algorithm: 'm.megolm.v1.aes-sha2', rotationPeriodMs: 604800000 }
      mockGetEncryptionSettings.mockResolvedValueOnce(settings)
      const { getEncryptionSettings } = useEncryption()
      const result = await getEncryptionSettings('!room1')
      expect(result).toEqual(settings)
      expect(mockGetEncryptionSettings).toHaveBeenCalledWith('!room1')
    })

    it('getEncryptionSettings returns null when no settings', async () => {
      mockGetEncryptionSettings.mockResolvedValueOnce(null)
      const { getEncryptionSettings } = useEncryption()
      const result = await getEncryptionSettings('!room1')
      expect(result).toBeNull()
    })
  })

  describe('cross-signing', () => {
    it('getCrossSigningInfo delegates to cryptoSDKAdapter.getCrossSigningStatus', async () => {
      const statusResult = {
        isSetup: true,
        masterPublicKey: 'master',
        selfSigningPublicKey: 'self',
        userSigningPublicKey: 'user',
        privateKeysCached: true,
        crossSigningVerified: true
      }
      mockCryptoSDKGetCrossSigningStatus.mockResolvedValueOnce(statusResult)
      const { getCrossSigningInfo } = useEncryption()
      const result = await getCrossSigningInfo()
      expect(result).toEqual({
        isSetup: true,
        masterPublicKey: 'master',
        selfSigningPublicKey: 'self',
        userSigningPublicKey: 'user'
      })
      expect(mockCryptoSDKGetCrossSigningStatus).toHaveBeenCalled()
    })

    it('setupCrossSigning delegates with authParams', async () => {
      mockCryptoSDKSetupCrossSigning.mockResolvedValueOnce(undefined)
      const { setupCrossSigning } = useEncryption()
      await setupCrossSigning({ password: 'pass123' })
      expect(mockCryptoSDKSetupCrossSigning).toHaveBeenCalledWith({ password: 'pass123' })
    })

    it('setupCrossSigning works without authParams', async () => {
      mockCryptoSDKSetupCrossSigning.mockResolvedValueOnce(undefined)
      const { setupCrossSigning } = useEncryption()
      await setupCrossSigning()
      expect(mockCryptoSDKSetupCrossSigning).toHaveBeenCalledWith(undefined)
    })

    it('resetCrossSigning completes without error', async () => {
      const { resetCrossSigning } = useEncryption()
      await expect(resetCrossSigning()).resolves.toBeUndefined()
    })

    it('checkCrossSigningReady updates ref and returns value', async () => {
      mockCryptoSDKIsCrossSigningReady.mockResolvedValueOnce(true)
      const { checkCrossSigningReady, isCrossSigningReady } = useEncryption()
      const result = await checkCrossSigningReady()
      expect(result).toBe(true)
      expect(isCrossSigningReady.value).toBe(true)
    })

    it('checkCrossSigningReady sets ref to false when not ready', async () => {
      mockCryptoSDKIsCrossSigningReady.mockResolvedValueOnce(false)
      const { checkCrossSigningReady, isCrossSigningReady } = useEncryption()
      const result = await checkCrossSigningReady()
      expect(result).toBe(false)
      expect(isCrossSigningReady.value).toBe(false)
    })
  })

  describe('key backup', () => {
    it('setupKeyBackup returns recovery key', async () => {
      mockCryptoSDKSetupKeyBackupWithOptions.mockResolvedValueOnce('recovery-key-123')
      const { setupKeyBackup } = useEncryption()
      const result = await setupKeyBackup()
      expect(result).toBe('recovery-key-123')
    })

    it('setupKeyBackup with custom recovery key', async () => {
      mockCryptoSDKSetupKeyBackupWithOptions.mockResolvedValueOnce('custom-key')
      const { setupKeyBackup } = useEncryption()
      await setupKeyBackup('my-key')
      expect(mockCryptoSDKSetupKeyBackupWithOptions).toHaveBeenCalledWith('my-key')
    })

    it('getKeyBackupInfo returns mapped info', async () => {
      const backupInfo = {
        version: '1',
        algorithm: 'm.megolm_backup.v1.aes-sha2',
        auth_data: { iv: 'abc' },
        count: 5,
        etag: 'etag1'
      }
      mockKeyBackupCheckKeyBackup.mockResolvedValueOnce(backupInfo)
      const { getKeyBackupInfo } = useEncryption()
      const result = await getKeyBackupInfo()
      expect(result).toEqual({
        version: '1',
        algorithm: 'm.megolm_backup.v1.aes-sha2',
        authData: { iv: 'abc' },
        count: 5,
        etag: 'etag1'
      })
      expect(mockKeyBackupCheckKeyBackup).toHaveBeenCalled()
    })

    it('getKeyBackupInfo returns null when no backup', async () => {
      mockKeyBackupCheckKeyBackup.mockResolvedValueOnce(null)
      const { getKeyBackupInfo } = useEncryption()
      const result = await getKeyBackupInfo()
      expect(result).toBeNull()
    })

    it('restoreFromBackup returns import stats', async () => {
      mockCryptoSDKRestoreFromBackup.mockResolvedValueOnce({ imported: 10, total: 12 })
      const { restoreFromBackup } = useEncryption()
      const result = await restoreFromBackup('recovery-key')
      expect(result).toEqual({ imported: 10, total: 12 })
      expect(mockCryptoSDKRestoreFromBackup).toHaveBeenCalledWith('recovery-key')
    })

    it('deleteKeyBackup delegates to matrixKeyBackupService', async () => {
      mockKeyBackupCheckKeyBackup.mockResolvedValueOnce({ version: '1', algorithm: 'alg', auth_data: {} })
      mockKeyBackupDeleteKeyBackupVersion.mockResolvedValueOnce(undefined)
      const { deleteKeyBackup } = useEncryption()
      await deleteKeyBackup()
      expect(mockKeyBackupCheckKeyBackup).toHaveBeenCalled()
      expect(mockKeyBackupDeleteKeyBackupVersion).toHaveBeenCalledWith('1')
    })

    it('deleteKeyBackup does nothing when no backup exists', async () => {
      mockKeyBackupCheckKeyBackup.mockResolvedValueOnce(null)
      const { deleteKeyBackup } = useEncryption()
      await deleteKeyBackup()
      expect(mockKeyBackupCheckKeyBackup).toHaveBeenCalled()
      expect(mockKeyBackupDeleteKeyBackupVersion).not.toHaveBeenCalled()
    })

    it('prepareKeyBackupVersionAuthData returns auth data', async () => {
      const authData = { iv: 'abc', mac: 'def' }
      mockContextPrepareKeyBackupVersion.mockResolvedValueOnce({
        algorithm: 'm.megolm_backup.v1.aes-sha2',
        authData,
        privateKey: new Uint8Array()
      })
      const { prepareKeyBackupVersionAuthData } = useEncryption()
      const result = await prepareKeyBackupVersionAuthData()
      expect(result).toEqual(authData)
      expect(mockContextPrepareKeyBackupVersion).toHaveBeenCalled()
    })
  })

  describe('key rotation', () => {
    it('getKeyRotationStatus delegates to matrixEncryptionService', async () => {
      const status = { rotationEnabled: true, lastRotatedAt: 1000, nextRotationAt: 2000 }
      mockGetKeyRotationStatus.mockResolvedValueOnce(status)
      const { getKeyRotationStatus } = useEncryption()
      const result = await getKeyRotationStatus()
      expect(result).toEqual(status)
    })

    it('rotateKeys returns rotation result', async () => {
      const rotationResult = { success: true, keyId: 'key-1', rotatedAt: Date.now() }
      mockRotateKeys.mockResolvedValueOnce(rotationResult)
      const { rotateKeys } = useEncryption()
      const result = await rotateKeys()
      expect(result).toEqual(rotationResult)
    })

    it('getCurrentDeviceId returns device id', () => {
      mockGetCurrentDeviceId.mockReturnValue('DEVICE_ABC')
      const { getCurrentDeviceId } = useEncryption()
      expect(getCurrentDeviceId()).toBe('DEVICE_ABC')
    })

    it('getCurrentDeviceId returns null when no device', () => {
      mockGetCurrentDeviceId.mockReturnValue(null)
      const { getCurrentDeviceId } = useEncryption()
      expect(getCurrentDeviceId()).toBeNull()
    })

    it('getRotationHistory delegates to matrixEncryptionService', async () => {
      const history = [{ keyId: 'k1', rotatedAt: 1000 }]
      mockGetRotationHistory.mockResolvedValueOnce(history)
      const { getRotationHistory } = useEncryption()
      const result = await getRotationHistory('DEVICE_ABC')
      expect(result).toEqual(history)
      expect(mockGetRotationHistory).toHaveBeenCalledWith('DEVICE_ABC')
    })

    it('configureKeyRotation delegates with intervalDays', async () => {
      mockConfigureKeyRotation.mockResolvedValueOnce(undefined)
      const { configureKeyRotation } = useEncryption()
      await configureKeyRotation(true, 7)
      expect(mockConfigureKeyRotation).toHaveBeenCalledWith(true, 7)
    })

    it('configureKeyRotation without intervalDays', async () => {
      mockConfigureKeyRotation.mockResolvedValueOnce(undefined)
      const { configureKeyRotation } = useEncryption()
      await configureKeyRotation(false)
      expect(mockConfigureKeyRotation).toHaveBeenCalledWith(false, undefined)
    })
  })

  describe('device trust', () => {
    it('trustDevice delegates to matrixCryptoService.verifyDevice', async () => {
      mockMatrixCryptoVerifyDevice.mockResolvedValueOnce(undefined)
      const { trustDevice } = useEncryption()
      await trustDevice('@user:server', 'DEVICE1')
      expect(mockMatrixCryptoVerifyDevice).toHaveBeenCalledWith('@user:server', 'DEVICE1')
    })

    it('untrustDevice delegates to matrixCryptoService.unverifyDevice', async () => {
      mockMatrixCryptoUnverifyDevice.mockResolvedValueOnce(undefined)
      const { untrustDevice } = useEncryption()
      await untrustDevice('@user:server', 'DEVICE1')
      expect(mockMatrixCryptoUnverifyDevice).toHaveBeenCalledWith('@user:server', 'DEVICE1')
    })

    it('blockDevice delegates to cryptoSDKAdapter.blockDevice', async () => {
      mockCryptoSDKBlockDevice.mockResolvedValueOnce(undefined)
      const { blockDevice } = useEncryption()
      await blockDevice('@user:server', 'DEVICE1')
      expect(mockCryptoSDKBlockDevice).toHaveBeenCalledWith('@user:server', 'DEVICE1')
    })

    it('unblockDevice delegates to cryptoSDKAdapter.unblockDevice', async () => {
      mockCryptoSDKUnblockDevice.mockResolvedValueOnce(undefined)
      const { unblockDevice } = useEncryption()
      await unblockDevice('@user:server', 'DEVICE1')
      expect(mockCryptoSDKUnblockDevice).toHaveBeenCalledWith('@user:server', 'DEVICE1')
    })

    it('getDeviceTrustLevel returns mapped trust info', async () => {
      mockMatrixCryptoGetDeviceVerificationStatus.mockResolvedValueOnce({
        verified: true,
        crossSigningVerified: true,
        devicesCrossSigningVerified: true
      })
      const { getDeviceTrustLevel } = useEncryption()
      const result = await getDeviceTrustLevel('@user:server', 'DEVICE1')
      expect(result).toEqual({ isVerified: true, isCrossSigningVerified: true, isTofu: false })
      expect(mockMatrixCryptoGetDeviceVerificationStatus).toHaveBeenCalledWith('@user:server', 'DEVICE1')
    })

    it('requestDeviceVerification delegates to matrixCryptoService', async () => {
      const req = { requestId: 'req1' }
      mockMatrixCryptoRequestDeviceVerification.mockResolvedValueOnce(req)
      const { requestDeviceVerification } = useEncryption()
      const result = await requestDeviceVerification('@user:server', 'DEVICE1', ['m.sas.v1'])
      expect(result).toEqual(req)
      expect(mockMatrixCryptoRequestDeviceVerification).toHaveBeenCalledWith('@user:server', 'DEVICE1')
    })

    it('requestUserVerification delegates to matrixVerificationService.startSasVerification', async () => {
      mockVerificationStartSasVerification.mockResolvedValueOnce('txn-123')
      const { requestUserVerification } = useEncryption()
      const result = await requestUserVerification('@user:server', ['m.sas.v1'])
      expect(result).toBe('txn-123')
      expect(mockVerificationStartSasVerification).toHaveBeenCalledWith('@user:server', '')
    })
  })

  describe('key import/export', () => {
    it('exportRoomKeys returns data from cryptoSDKAdapter.exportKeys', async () => {
      mockCryptoSDKExportKeys.mockResolvedValueOnce({ data: '{"keys":[]}', count: 0 })
      const { exportRoomKeys } = useEncryption()
      const result = await exportRoomKeys()
      expect(result).toBe('{"keys":[]}')
    })

    it('importRoomKeys returns import stats', async () => {
      mockCryptoSDKImportKeys.mockResolvedValueOnce({ imported: 5, total: 5 })
      const { importRoomKeys } = useEncryption()
      const result = await importRoomKeys('{"keys":[]}')
      expect(result).toEqual({ imported: 5, total: 5 })
      expect(mockCryptoSDKImportKeys).toHaveBeenCalledWith('{"keys":[]}')
    })

    it('getUnverifiedDevicesInRoom returns empty array', async () => {
      const { getUnverifiedDevicesInRoom } = useEncryption()
      const result = await getUnverifiedDevicesInRoom('!room1')
      expect(result).toEqual([])
    })
  })

  describe('session context & fingerprint', () => {
    it('getCurrentSessionContext delegates to contextService', () => {
      const ctx = { userId: '@alice:server', deviceId: 'DEV1', isCryptoEnabled: true }
      mockGetCurrentSessionContext.mockReturnValue(ctx)
      const { getCurrentSessionContext } = useEncryption()
      expect(getCurrentSessionContext()).toEqual(ctx)
    })

    it('getDeviceFingerprint delegates to contextService', async () => {
      mockGetDeviceFingerprint.mockResolvedValueOnce('AB:CD:EF')
      const { getDeviceFingerprint } = useEncryption()
      const result = await getDeviceFingerprint('@alice:server', 'DEV1')
      expect(result).toBe('AB:CD:EF')
      expect(mockGetDeviceFingerprint).toHaveBeenCalledWith('@alice:server', 'DEV1')
    })

    it('getDeviceFingerprint with null params', async () => {
      mockGetDeviceFingerprint.mockResolvedValueOnce(null)
      const { getDeviceFingerprint } = useEncryption()
      const result = await getDeviceFingerprint(null, null)
      expect(result).toBeNull()
    })
  })

  describe('health monitor', () => {
    it('getHealthStatus delegates to cryptoHealthMonitor', async () => {
      const status = { overall: 'healthy', checks: {} }
      mockPerformCheck.mockResolvedValueOnce(status)
      const { getHealthStatus } = useEncryption()
      const result = await getHealthStatus()
      expect(result).toEqual(status)
      expect(mockPerformCheck).toHaveBeenCalled()
    })

    it('registerHealthCallbacks delegates to cryptoHealthMonitor', () => {
      const callbacks = { onHealthStatusChange: vi.fn() }
      const { registerHealthCallbacks } = useEncryption()
      registerHealthCallbacks(callbacks)
      expect(mockRegisterCallbacks).toHaveBeenCalledWith(callbacks)
    })

    it('startHealthMonitor delegates to cryptoHealthMonitor', () => {
      const { startHealthMonitor } = useEncryption()
      startHealthMonitor()
      expect(mockStart).toHaveBeenCalled()
    })

    it('stopHealthMonitor delegates to cryptoHealthMonitor', () => {
      const { stopHealthMonitor } = useEncryption()
      stopHealthMonitor()
      expect(mockStop).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('isEncryptionAvailable propagates service error', async () => {
      mockCryptoSDKIsEncryptionAvailable.mockRejectedValueOnce(new Error('crypto not available'))
      const { isEncryptionAvailable } = useEncryption()
      await expect(isEncryptionAvailable()).rejects.toThrow('crypto not available')
    })

    it('enableRoomEncryption propagates service error', async () => {
      mockMatrixCryptoEnableEncryption.mockRejectedValueOnce(new Error('already encrypted'))
      const { enableRoomEncryption } = useEncryption()
      await expect(enableRoomEncryption('!room1')).rejects.toThrow('already encrypted')
    })

    it('restoreFromBackup propagates service error', async () => {
      mockCryptoSDKRestoreFromBackup.mockRejectedValueOnce(new Error('invalid key'))
      const { restoreFromBackup } = useEncryption()
      await expect(restoreFromBackup('bad-key')).rejects.toThrow('invalid key')
    })

    it('setupCrossSigning propagates service error', async () => {
      mockCryptoSDKSetupCrossSigning.mockRejectedValueOnce(new Error('auth failed'))
      const { setupCrossSigning } = useEncryption()
      await expect(setupCrossSigning({ password: 'wrong' })).rejects.toThrow('auth failed')
    })

    it('setupKeyBackup propagates service error', async () => {
      mockCryptoSDKSetupKeyBackupWithOptions.mockRejectedValueOnce(new Error('backup setup failed'))
      const { setupKeyBackup } = useEncryption()
      await expect(setupKeyBackup()).rejects.toThrow('backup setup failed')
    })

    it('deleteKeyBackup propagates service error', async () => {
      mockKeyBackupCheckKeyBackup.mockRejectedValueOnce(new Error('delete backup failed'))
      const { deleteKeyBackup } = useEncryption()
      await expect(deleteKeyBackup()).rejects.toThrow('delete backup failed')
    })

    it('rotateKeys propagates service error', async () => {
      mockRotateKeys.mockRejectedValueOnce(new Error('rotation failed'))
      const { rotateKeys } = useEncryption()
      await expect(rotateKeys()).rejects.toThrow('rotation failed')
    })

    it('trustDevice propagates service error', async () => {
      mockMatrixCryptoVerifyDevice.mockRejectedValueOnce(new Error('trust failed'))
      const { trustDevice } = useEncryption()
      await expect(trustDevice('@user:server', 'DEV1')).rejects.toThrow('trust failed')
    })

    it('exportRoomKeys propagates service error', async () => {
      mockCryptoSDKExportKeys.mockRejectedValueOnce(new Error('export failed'))
      const { exportRoomKeys } = useEncryption()
      await expect(exportRoomKeys()).rejects.toThrow('export failed')
    })

    it('importRoomKeys propagates service error', async () => {
      mockCryptoSDKImportKeys.mockRejectedValueOnce(new Error('import failed'))
      const { importRoomKeys } = useEncryption()
      await expect(importRoomKeys('bad-json')).rejects.toThrow('import failed')
    })

    it('getDeviceFingerprint propagates service error', async () => {
      mockGetDeviceFingerprint.mockRejectedValueOnce(new Error('fingerprint error'))
      const { getDeviceFingerprint } = useEncryption()
      await expect(getDeviceFingerprint('@user:server', 'DEV1')).rejects.toThrow('fingerprint error')
    })
  })

  describe('verification without methods', () => {
    it('requestDeviceVerification delegates without methods', async () => {
      const req = { requestId: 'req3' }
      mockMatrixCryptoRequestDeviceVerification.mockResolvedValueOnce(req)
      const { requestDeviceVerification } = useEncryption()
      const result = await requestDeviceVerification('@user:server', 'DEVICE1')
      expect(result).toEqual(req)
      expect(mockMatrixCryptoRequestDeviceVerification).toHaveBeenCalledWith('@user:server', 'DEVICE1')
    })

    it('requestUserVerification delegates without methods', async () => {
      mockVerificationStartSasVerification.mockResolvedValueOnce('txn-456')
      const { requestUserVerification } = useEncryption()
      const result = await requestUserVerification('@user:server')
      expect(result).toBe('txn-456')
      expect(mockVerificationStartSasVerification).toHaveBeenCalledWith('@user:server', '')
    })
  })

  describe('isEncryptionEnabled ref', () => {
    it('isEncryptionEnabled starts as false and can be mutated', () => {
      const { isEncryptionEnabled } = useEncryption()
      expect(isEncryptionEnabled.value).toBe(false)
      isEncryptionEnabled.value = true
      expect(isEncryptionEnabled.value).toBe(true)
    })
  })
})
