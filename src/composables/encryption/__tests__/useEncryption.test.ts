import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockPerformCheck,
  mockRegisterCallbacks,
  mockStart,
  mockStop,
  mockGetCurrentSessionContext,
  mockGetDeviceFingerprint,
  mockIsEncryptionAvailable,
  mockIsRoomEncrypted,
  mockEnableRoomEncryption,
  mockGetEncryptionSettings,
  mockGetCrossSigningInfo,
  mockSetupCrossSigning,
  mockResetCrossSigning,
  mockIsCrossSigningReady,
  mockSetupKeyBackup,
  mockGetKeyBackupInfo,
  mockRestoreFromBackup,
  mockDeleteKeyBackup,
  mockPrepareKeyBackupVersionAuthData,
  mockGetKeyRotationStatus,
  mockRotateKeys,
  mockGetCurrentDeviceId,
  mockGetRotationHistory,
  mockConfigureKeyRotation,
  mockTrustDevice,
  mockUntrustDevice,
  mockBlockDevice,
  mockUnblockDevice,
  mockGetDeviceTrustLevel,
  mockRequestDeviceVerification,
  mockRequestUserVerification,
  mockExportRoomKeys,
  mockImportRoomKeys,
  mockGetUnverifiedDevicesInRoom
} = vi.hoisted(() => ({
  mockPerformCheck: vi.fn(),
  mockRegisterCallbacks: vi.fn(),
  mockStart: vi.fn(),
  mockStop: vi.fn(),
  mockGetCurrentSessionContext: vi.fn(),
  mockGetDeviceFingerprint: vi.fn(),
  mockIsEncryptionAvailable: vi.fn(),
  mockIsRoomEncrypted: vi.fn(),
  mockEnableRoomEncryption: vi.fn(),
  mockGetEncryptionSettings: vi.fn(),
  mockGetCrossSigningInfo: vi.fn(),
  mockSetupCrossSigning: vi.fn(),
  mockResetCrossSigning: vi.fn(),
  mockIsCrossSigningReady: vi.fn(),
  mockSetupKeyBackup: vi.fn(),
  mockGetKeyBackupInfo: vi.fn(),
  mockRestoreFromBackup: vi.fn(),
  mockDeleteKeyBackup: vi.fn(),
  mockPrepareKeyBackupVersionAuthData: vi.fn(),
  mockGetKeyRotationStatus: vi.fn(),
  mockRotateKeys: vi.fn(),
  mockGetCurrentDeviceId: vi.fn(),
  mockGetRotationHistory: vi.fn(),
  mockConfigureKeyRotation: vi.fn(),
  mockTrustDevice: vi.fn(),
  mockUntrustDevice: vi.fn(),
  mockBlockDevice: vi.fn(),
  mockUnblockDevice: vi.fn(),
  mockGetDeviceTrustLevel: vi.fn(),
  mockRequestDeviceVerification: vi.fn(),
  mockRequestUserVerification: vi.fn(),
  mockExportRoomKeys: vi.fn(),
  mockImportRoomKeys: vi.fn(),
  mockGetUnverifiedDevicesInRoom: vi.fn()
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
    getDeviceFingerprint: mockGetDeviceFingerprint
  }
}))

vi.mock('@/services/matrix/crypto/MatrixEncryptionService', () => ({
  matrixEncryptionService: {
    isEncryptionAvailable: mockIsEncryptionAvailable,
    isRoomEncrypted: mockIsRoomEncrypted,
    enableRoomEncryption: mockEnableRoomEncryption,
    getEncryptionSettings: mockGetEncryptionSettings,
    getCrossSigningInfo: mockGetCrossSigningInfo,
    setupCrossSigning: mockSetupCrossSigning,
    resetCrossSigning: mockResetCrossSigning,
    isCrossSigningReady: mockIsCrossSigningReady,
    setupKeyBackup: mockSetupKeyBackup,
    getKeyBackupInfo: mockGetKeyBackupInfo,
    restoreFromBackup: mockRestoreFromBackup,
    deleteKeyBackup: mockDeleteKeyBackup,
    prepareKeyBackupVersionAuthData: mockPrepareKeyBackupVersionAuthData,
    getKeyRotationStatus: mockGetKeyRotationStatus,
    rotateKeys: mockRotateKeys,
    getCurrentDeviceId: mockGetCurrentDeviceId,
    getRotationHistory: mockGetRotationHistory,
    configureKeyRotation: mockConfigureKeyRotation,
    trustDevice: mockTrustDevice,
    untrustDevice: mockUntrustDevice,
    blockDevice: mockBlockDevice,
    unblockDevice: mockUnblockDevice,
    getDeviceTrustLevel: mockGetDeviceTrustLevel,
    requestDeviceVerification: mockRequestDeviceVerification,
    requestUserVerification: mockRequestUserVerification,
    exportRoomKeys: mockExportRoomKeys,
    importRoomKeys: mockImportRoomKeys,
    getUnverifiedDevicesInRoom: mockGetUnverifiedDevicesInRoom
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
    it('isEncryptionAvailable delegates to service', async () => {
      mockIsEncryptionAvailable.mockResolvedValueOnce(true)
      const { isEncryptionAvailable } = useEncryption()
      const result = await isEncryptionAvailable()
      expect(result).toBe(true)
      expect(mockIsEncryptionAvailable).toHaveBeenCalled()
    })

    it('isRoomEncrypted delegates to service', async () => {
      mockIsRoomEncrypted.mockResolvedValueOnce(true)
      const { isRoomEncrypted } = useEncryption()
      const result = await isRoomEncrypted('!room1')
      expect(result).toBe(true)
      expect(mockIsRoomEncrypted).toHaveBeenCalledWith('!room1')
    })

    it('enableRoomEncryption delegates to service with settings', async () => {
      mockEnableRoomEncryption.mockResolvedValueOnce(undefined)
      const { enableRoomEncryption } = useEncryption()
      await enableRoomEncryption('!room1', { algorithm: 'm.megolm.v1.aes-sha2' })
      expect(mockEnableRoomEncryption).toHaveBeenCalledWith('!room1', { algorithm: 'm.megolm.v1.aes-sha2' })
    })

    it('enableRoomEncryption works without settings', async () => {
      mockEnableRoomEncryption.mockResolvedValueOnce(undefined)
      const { enableRoomEncryption } = useEncryption()
      await enableRoomEncryption('!room1')
      expect(mockEnableRoomEncryption).toHaveBeenCalledWith('!room1', undefined)
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
    it('getCrossSigningInfo delegates to service', async () => {
      const info = { isSetup: true, hasMasterKey: true, hasSelfSigningKey: true, hasUserSigningKey: true }
      mockGetCrossSigningInfo.mockResolvedValueOnce(info)
      const { getCrossSigningInfo } = useEncryption()
      const result = await getCrossSigningInfo()
      expect(result).toEqual(info)
    })

    it('setupCrossSigning delegates with authParams', async () => {
      mockSetupCrossSigning.mockResolvedValueOnce(undefined)
      const { setupCrossSigning } = useEncryption()
      await setupCrossSigning({ password: 'pass123' })
      expect(mockSetupCrossSigning).toHaveBeenCalledWith({ password: 'pass123' })
    })

    it('setupCrossSigning works without authParams', async () => {
      mockSetupCrossSigning.mockResolvedValueOnce(undefined)
      const { setupCrossSigning } = useEncryption()
      await setupCrossSigning()
      expect(mockSetupCrossSigning).toHaveBeenCalledWith(undefined)
    })

    it('resetCrossSigning delegates to service', async () => {
      mockResetCrossSigning.mockResolvedValueOnce(undefined)
      const { resetCrossSigning } = useEncryption()
      await resetCrossSigning()
      expect(mockResetCrossSigning).toHaveBeenCalled()
    })

    it('checkCrossSigningReady updates ref and returns value', async () => {
      mockIsCrossSigningReady.mockResolvedValueOnce(true)
      const { checkCrossSigningReady, isCrossSigningReady } = useEncryption()
      const result = await checkCrossSigningReady()
      expect(result).toBe(true)
      expect(isCrossSigningReady.value).toBe(true)
    })

    it('checkCrossSigningReady sets ref to false when not ready', async () => {
      mockIsCrossSigningReady.mockResolvedValueOnce(false)
      const { checkCrossSigningReady, isCrossSigningReady } = useEncryption()
      const result = await checkCrossSigningReady()
      expect(result).toBe(false)
      expect(isCrossSigningReady.value).toBe(false)
    })
  })

  describe('key backup', () => {
    it('setupKeyBackup returns recovery key', async () => {
      mockSetupKeyBackup.mockResolvedValueOnce('recovery-key-123')
      const { setupKeyBackup } = useEncryption()
      const result = await setupKeyBackup()
      expect(result).toBe('recovery-key-123')
    })

    it('setupKeyBackup with custom recovery key', async () => {
      mockSetupKeyBackup.mockResolvedValueOnce('custom-key')
      const { setupKeyBackup } = useEncryption()
      await setupKeyBackup('my-key')
      expect(mockSetupKeyBackup).toHaveBeenCalledWith('my-key')
    })

    it('getKeyBackupInfo returns info', async () => {
      const info = { version: '1', algorithm: 'm.megolm_backup.v1.aes-sha2' }
      mockGetKeyBackupInfo.mockResolvedValueOnce(info)
      const { getKeyBackupInfo } = useEncryption()
      const result = await getKeyBackupInfo()
      expect(result).toEqual(info)
    })

    it('getKeyBackupInfo returns null when no backup', async () => {
      mockGetKeyBackupInfo.mockResolvedValueOnce(null)
      const { getKeyBackupInfo } = useEncryption()
      const result = await getKeyBackupInfo()
      expect(result).toBeNull()
    })

    it('restoreFromBackup returns import stats', async () => {
      mockRestoreFromBackup.mockResolvedValueOnce({ imported: 10, total: 12 })
      const { restoreFromBackup } = useEncryption()
      const result = await restoreFromBackup('recovery-key')
      expect(result).toEqual({ imported: 10, total: 12 })
      expect(mockRestoreFromBackup).toHaveBeenCalledWith('recovery-key')
    })

    it('deleteKeyBackup delegates to service', async () => {
      mockDeleteKeyBackup.mockResolvedValueOnce(undefined)
      const { deleteKeyBackup } = useEncryption()
      await deleteKeyBackup()
      expect(mockDeleteKeyBackup).toHaveBeenCalled()
    })

    it('prepareKeyBackupVersionAuthData returns auth data', async () => {
      const authData = { iv: 'abc', mac: 'def' }
      mockPrepareKeyBackupVersionAuthData.mockResolvedValueOnce(authData)
      const { prepareKeyBackupVersionAuthData } = useEncryption()
      const result = await prepareKeyBackupVersionAuthData()
      expect(result).toEqual(authData)
    })
  })

  describe('key rotation', () => {
    it('getKeyRotationStatus delegates to service', async () => {
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

    it('getRotationHistory delegates to service', async () => {
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
    it('trustDevice delegates to service', async () => {
      mockTrustDevice.mockResolvedValueOnce(undefined)
      const { trustDevice } = useEncryption()
      await trustDevice('@user:server', 'DEVICE1')
      expect(mockTrustDevice).toHaveBeenCalledWith('@user:server', 'DEVICE1')
    })

    it('untrustDevice delegates to service', async () => {
      mockUntrustDevice.mockResolvedValueOnce(undefined)
      const { untrustDevice } = useEncryption()
      await untrustDevice('@user:server', 'DEVICE1')
      expect(mockUntrustDevice).toHaveBeenCalledWith('@user:server', 'DEVICE1')
    })

    it('blockDevice delegates to service', async () => {
      mockBlockDevice.mockResolvedValueOnce(undefined)
      const { blockDevice } = useEncryption()
      await blockDevice('@user:server', 'DEVICE1')
      expect(mockBlockDevice).toHaveBeenCalledWith('@user:server', 'DEVICE1')
    })

    it('unblockDevice delegates to service', async () => {
      mockUnblockDevice.mockResolvedValueOnce(undefined)
      const { unblockDevice } = useEncryption()
      await unblockDevice('@user:server', 'DEVICE1')
      expect(mockUnblockDevice).toHaveBeenCalledWith('@user:server', 'DEVICE1')
    })

    it('getDeviceTrustLevel returns trust info', async () => {
      const trustLevel = { isVerified: true, isCrossSigningVerified: true, isTofu: false }
      mockGetDeviceTrustLevel.mockResolvedValueOnce(trustLevel)
      const { getDeviceTrustLevel } = useEncryption()
      const result = await getDeviceTrustLevel('@user:server', 'DEVICE1')
      expect(result).toEqual(trustLevel)
      expect(mockGetDeviceTrustLevel).toHaveBeenCalledWith('@user:server', 'DEVICE1')
    })

    it('requestDeviceVerification delegates with methods', async () => {
      const req = { requestId: 'req1' }
      mockRequestDeviceVerification.mockResolvedValueOnce(req)
      const { requestDeviceVerification } = useEncryption()
      const result = await requestDeviceVerification('@user:server', 'DEVICE1', ['m.sas.v1'])
      expect(result).toEqual(req)
      expect(mockRequestDeviceVerification).toHaveBeenCalledWith('@user:server', 'DEVICE1', ['m.sas.v1'])
    })

    it('requestUserVerification delegates with methods', async () => {
      const req = { requestId: 'req2' }
      mockRequestUserVerification.mockResolvedValueOnce(req)
      const { requestUserVerification } = useEncryption()
      const result = await requestUserVerification('@user:server', ['m.sas.v1'])
      expect(result).toEqual(req)
      expect(mockRequestUserVerification).toHaveBeenCalledWith('@user:server', ['m.sas.v1'])
    })
  })

  describe('key import/export', () => {
    it('exportRoomKeys returns JSON string', async () => {
      mockExportRoomKeys.mockResolvedValueOnce('{"keys":[]}')
      const { exportRoomKeys } = useEncryption()
      const result = await exportRoomKeys()
      expect(result).toBe('{"keys":[]}')
    })

    it('importRoomKeys returns import stats', async () => {
      mockImportRoomKeys.mockResolvedValueOnce({ imported: 5, total: 5 })
      const { importRoomKeys } = useEncryption()
      const result = await importRoomKeys('{"keys":[]}')
      expect(result).toEqual({ imported: 5, total: 5 })
      expect(mockImportRoomKeys).toHaveBeenCalledWith('{"keys":[]}')
    })

    it('getUnverifiedDevicesInRoom returns device ids', async () => {
      mockGetUnverifiedDevicesInRoom.mockResolvedValueOnce(['DEV1', 'DEV2'])
      const { getUnverifiedDevicesInRoom } = useEncryption()
      const result = await getUnverifiedDevicesInRoom('!room1')
      expect(result).toEqual(['DEV1', 'DEV2'])
      expect(mockGetUnverifiedDevicesInRoom).toHaveBeenCalledWith('!room1')
    })

    it('getUnverifiedDevicesInRoom returns empty array', async () => {
      mockGetUnverifiedDevicesInRoom.mockResolvedValueOnce([])
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
      mockIsEncryptionAvailable.mockRejectedValueOnce(new Error('crypto not available'))
      const { isEncryptionAvailable } = useEncryption()
      await expect(isEncryptionAvailable()).rejects.toThrow('crypto not available')
    })

    it('enableRoomEncryption propagates service error', async () => {
      mockEnableRoomEncryption.mockRejectedValueOnce(new Error('already encrypted'))
      const { enableRoomEncryption } = useEncryption()
      await expect(enableRoomEncryption('!room1')).rejects.toThrow('already encrypted')
    })

    it('restoreFromBackup propagates service error', async () => {
      mockRestoreFromBackup.mockRejectedValueOnce(new Error('invalid key'))
      const { restoreFromBackup } = useEncryption()
      await expect(restoreFromBackup('bad-key')).rejects.toThrow('invalid key')
    })

    it('setupCrossSigning propagates service error', async () => {
      mockSetupCrossSigning.mockRejectedValueOnce(new Error('auth failed'))
      const { setupCrossSigning } = useEncryption()
      await expect(setupCrossSigning({ password: 'wrong' })).rejects.toThrow('auth failed')
    })

    it('resetCrossSigning propagates service error', async () => {
      mockResetCrossSigning.mockRejectedValueOnce(new Error('reset failed'))
      const { resetCrossSigning } = useEncryption()
      await expect(resetCrossSigning()).rejects.toThrow('reset failed')
    })

    it('setupKeyBackup propagates service error', async () => {
      mockSetupKeyBackup.mockRejectedValueOnce(new Error('backup setup failed'))
      const { setupKeyBackup } = useEncryption()
      await expect(setupKeyBackup()).rejects.toThrow('backup setup failed')
    })

    it('deleteKeyBackup propagates service error', async () => {
      mockDeleteKeyBackup.mockRejectedValueOnce(new Error('delete backup failed'))
      const { deleteKeyBackup } = useEncryption()
      await expect(deleteKeyBackup()).rejects.toThrow('delete backup failed')
    })

    it('rotateKeys propagates service error', async () => {
      mockRotateKeys.mockRejectedValueOnce(new Error('rotation failed'))
      const { rotateKeys } = useEncryption()
      await expect(rotateKeys()).rejects.toThrow('rotation failed')
    })

    it('trustDevice propagates service error', async () => {
      mockTrustDevice.mockRejectedValueOnce(new Error('trust failed'))
      const { trustDevice } = useEncryption()
      await expect(trustDevice('@user:server', 'DEV1')).rejects.toThrow('trust failed')
    })

    it('exportRoomKeys propagates service error', async () => {
      mockExportRoomKeys.mockRejectedValueOnce(new Error('export failed'))
      const { exportRoomKeys } = useEncryption()
      await expect(exportRoomKeys()).rejects.toThrow('export failed')
    })

    it('importRoomKeys propagates service error', async () => {
      mockImportRoomKeys.mockRejectedValueOnce(new Error('import failed'))
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
      mockRequestDeviceVerification.mockResolvedValueOnce(req)
      const { requestDeviceVerification } = useEncryption()
      const result = await requestDeviceVerification('@user:server', 'DEVICE1')
      expect(result).toEqual(req)
      expect(mockRequestDeviceVerification).toHaveBeenCalledWith('@user:server', 'DEVICE1', undefined)
    })

    it('requestUserVerification delegates without methods', async () => {
      const req = { requestId: 'req4' }
      mockRequestUserVerification.mockResolvedValueOnce(req)
      const { requestUserVerification } = useEncryption()
      const result = await requestUserVerification('@user:server')
      expect(result).toEqual(req)
      expect(mockRequestUserVerification).toHaveBeenCalledWith('@user:server', undefined)
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
