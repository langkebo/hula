import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'
import type { VerificationRequest } from '@/types/matrix-extensions'
import matrixClientService from '../../MatrixClientService'
import { CryptoHealthMonitor } from '../CryptoHealthMonitor'
import { cryptoSDKAdapter } from '../CryptoSDKAdapter'
import { matrixCryptoService } from '../MatrixCryptoService'
import { matrixE2EEBootstrapService } from '../MatrixE2EEBootstrapService'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@/common/matrixErrorTranslator', () => ({
  formatMatrixError: (err: unknown) => `formatted:${String(err)}`
}))

vi.mock('../../MatrixClientService', () => ({
  default: { getClient: vi.fn() }
}))

vi.mock('../CryptoHealthMonitor', () => ({
  CryptoHealthMonitor: vi.fn(function (this: {
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    getStatus: ReturnType<typeof vi.fn>
    registerCallbacks: ReturnType<typeof vi.fn>
  }) {
    this.start = vi.fn()
    this.stop = vi.fn()
    this.getStatus = vi.fn()
    this.registerCallbacks = vi.fn()
  })
}))

vi.mock('../MatrixCryptoService', () => ({
  matrixCryptoService: {
    initializeCrypto: vi.fn(),
    getCryptoStatus: vi.fn(),
    requestDeviceVerification: vi.fn(),
    enableEncryption: vi.fn()
  }
}))

vi.mock('../CryptoSDKAdapter', () => ({
  cryptoSDKAdapter: {
    isEncryptionAvailable: vi.fn(),
    getCryptoStatus: vi.fn(),
    getCrossSigningStatus: vi.fn(),
    getDevices: vi.fn(),
    getDevice: vi.fn(),
    verifyDevice: vi.fn(),
    unverifyDevice: vi.fn(),
    getDeviceVerificationStatus: vi.fn(),
    backupKeys: vi.fn(),
    setupKeyBackup: vi.fn(),
    restoreKeys: vi.fn(),
    exportKeys: vi.fn(),
    importKeys: vi.fn(),
    setupCrossSigning: vi.fn(),
    isRoomEncrypted: vi.fn(),
    invalidateCryptoCache: vi.fn()
  }
}))

const mockedClientService = vi.mocked(matrixClientService)
const mockedCryptoService = vi.mocked(matrixCryptoService)
const mockedSDKAdapter = vi.mocked(cryptoSDKAdapter)

// The singleton is constructed once at import time, so capture the single
// healthMonitor instance here to assert against it in tests.
const healthMonitorInstance = (
  CryptoHealthMonitor as unknown as {
    mock: { instances: Array<unknown> }
  }
).mock.instances[0] as {
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  getStatus: ReturnType<typeof vi.fn>
  registerCallbacks: ReturnType<typeof vi.fn>
}

function mockClient(client?: Record<string, unknown>): void {
  mockedClientService.getClient.mockReturnValue((client ?? {}) as unknown as MatrixClient)
}

beforeEach(() => {
  vi.clearAllMocks()
  matrixE2EEBootstrapService.reset()
})

describe('MatrixE2EEBootstrapService', () => {
  describe('bootstrapE2EE', () => {
    it('returns early when no client is available', async () => {
      mockedClientService.getClient.mockReturnValue(undefined as unknown as MatrixClient)
      await expect(matrixE2EEBootstrapService.bootstrapE2EE()).resolves.toBeUndefined()
      expect(mockedCryptoService.initializeCrypto).not.toHaveBeenCalled()
    })

    it('initializes crypto, validates, and marks E2EE as initialized', async () => {
      mockClient()
      mockedCryptoService.initializeCrypto.mockResolvedValue(undefined)
      mockedSDKAdapter.isEncryptionAvailable.mockResolvedValue(true)
      mockedCryptoService.getCryptoStatus.mockResolvedValue({
        crossSigningReady: true,
        keyBackupEnabled: true
      })

      await matrixE2EEBootstrapService.bootstrapE2EE()

      expect(mockedCryptoService.initializeCrypto).toHaveBeenCalled()
      expect(mockedSDKAdapter.isEncryptionAvailable).toHaveBeenCalled()
      const status = await matrixE2EEBootstrapService.getE2EESettingsStatus()
      expect(status.isInitialized).toBe(true)
    })

    it('rethrows the error when initialization fails', async () => {
      mockClient()
      mockedCryptoService.initializeCrypto.mockRejectedValue(new Error('init failed'))

      await expect(matrixE2EEBootstrapService.bootstrapE2EE()).rejects.toThrow('init failed')
      const status = await matrixE2EEBootstrapService.getE2EESettingsStatus()
      expect(status.isInitialized).toBe(false)
    })
  })

  describe('getE2EESettingsStatus', () => {
    it('returns all-false status when no client', async () => {
      mockedClientService.getClient.mockReturnValue(undefined as unknown as MatrixClient)
      await expect(matrixE2EEBootstrapService.getE2EESettingsStatus()).resolves.toEqual({
        isInitialized: false,
        isCryptoEnabled: false,
        isCrossSigningReady: false,
        isKeyBackupEnabled: false
      })
    })

    it('returns status reflecting crypto values', async () => {
      mockClient()
      mockedCryptoService.getCryptoStatus.mockResolvedValue({
        crossSigningReady: true,
        keyBackupEnabled: false
      })
      mockedSDKAdapter.isEncryptionAvailable.mockResolvedValue(true)

      await expect(matrixE2EEBootstrapService.getE2EESettingsStatus()).resolves.toEqual({
        isInitialized: false,
        isCryptoEnabled: true,
        isCrossSigningReady: true,
        isKeyBackupEnabled: false
      })
    })
  })

  describe('ensureE2EEReady', () => {
    it('bootstraps when not initialized', async () => {
      mockClient()
      mockedCryptoService.initializeCrypto.mockResolvedValue(undefined)
      mockedSDKAdapter.isEncryptionAvailable.mockResolvedValue(true)
      mockedCryptoService.getCryptoStatus.mockResolvedValue({
        crossSigningReady: true,
        keyBackupEnabled: true
      })

      await matrixE2EEBootstrapService.ensureE2EEReady()
      expect(mockedCryptoService.initializeCrypto).toHaveBeenCalledTimes(1)
    })

    it('does not re-bootstrap when already initialized', async () => {
      mockClient()
      mockedCryptoService.initializeCrypto.mockResolvedValue(undefined)
      mockedSDKAdapter.isEncryptionAvailable.mockResolvedValue(true)
      mockedCryptoService.getCryptoStatus.mockResolvedValue({
        crossSigningReady: true,
        keyBackupEnabled: true
      })

      await matrixE2EEBootstrapService.ensureE2EEReady()
      await matrixE2EEBootstrapService.ensureE2EEReady()
      expect(mockedCryptoService.initializeCrypto).toHaveBeenCalledTimes(1)
    })
  })

  describe('passthrough methods', () => {
    it('getCryptoStatus delegates to cryptoSDKAdapter', async () => {
      mockedSDKAdapter.getCryptoStatus.mockResolvedValue({
        crossSigningReady: true,
        keyBackupEnabled: true
      })
      await expect(matrixE2EEBootstrapService.getCryptoStatus()).resolves.toEqual({
        crossSigningReady: true,
        keyBackupEnabled: true
      })
      expect(mockedSDKAdapter.getCryptoStatus).toHaveBeenCalled()
    })

    it('getCrossSigningStatus delegates to cryptoSDKAdapter', async () => {
      const result = { privateKeysCached: true, crossSigningVerified: true, isSetup: true }
      mockedSDKAdapter.getCrossSigningStatus.mockResolvedValue(result)
      await expect(matrixE2EEBootstrapService.getCrossSigningStatus()).resolves.toEqual(result)
    })

    it('isEncryptionAvailable delegates to cryptoSDKAdapter', async () => {
      mockedSDKAdapter.isEncryptionAvailable.mockResolvedValue(true)
      await expect(matrixE2EEBootstrapService.isEncryptionAvailable()).resolves.toBe(true)
    })

    it('isRoomEncrypted delegates to cryptoSDKAdapter', async () => {
      mockedSDKAdapter.isRoomEncrypted.mockResolvedValue(true)
      await expect(matrixE2EEBootstrapService.isRoomEncrypted('!room:matrix.org')).resolves.toBe(true)
      expect(mockedSDKAdapter.isRoomEncrypted).toHaveBeenCalledWith('!room:matrix.org')
    })

    it('setupCrossSigning delegates to cryptoSDKAdapter', async () => {
      mockedSDKAdapter.setupCrossSigning.mockResolvedValue(undefined)
      await matrixE2EEBootstrapService.setupCrossSigning({ password: 'secret' })
      expect(mockedSDKAdapter.setupCrossSigning).toHaveBeenCalledWith({ password: 'secret' })
    })

    it('enableEncryption delegates to matrixCryptoService', async () => {
      mockedCryptoService.enableEncryption.mockResolvedValue(undefined)
      await matrixE2EEBootstrapService.enableEncryption('!room:matrix.org', 'm.megolm.v1.aes-sha2')
      expect(mockedCryptoService.enableEncryption).toHaveBeenCalledWith('!room:matrix.org', 'm.megolm.v1.aes-sha2')
    })

    it('requestDeviceVerification delegates to matrixCryptoService', async () => {
      const verificationRequest = { transactionId: 'tx-1' } as unknown as VerificationRequest
      mockedCryptoService.requestDeviceVerification.mockResolvedValue(verificationRequest)
      await expect(matrixE2EEBootstrapService.requestDeviceVerification('@alice:matrix.org', 'DEV1')).resolves.toBe(
        verificationRequest
      )
      expect(mockedCryptoService.requestDeviceVerification).toHaveBeenCalledWith('@alice:matrix.org', 'DEV1')
    })

    it('getDevices delegates to cryptoSDKAdapter', async () => {
      mockedSDKAdapter.getDevices.mockResolvedValue([])
      await matrixE2EEBootstrapService.getDevices('@alice:matrix.org')
      expect(mockedSDKAdapter.getDevices).toHaveBeenCalledWith('@alice:matrix.org')
    })

    it('backupKeys delegates to cryptoSDKAdapter', async () => {
      mockedSDKAdapter.backupKeys.mockResolvedValue(undefined)
      await matrixE2EEBootstrapService.backupKeys()
      expect(mockedSDKAdapter.backupKeys).toHaveBeenCalled()
    })
  })

  describe('health monitoring', () => {
    it('startHealthMonitoring calls healthMonitor.start', () => {
      matrixE2EEBootstrapService.startHealthMonitoring()
      expect(healthMonitorInstance.start).toHaveBeenCalled()
    })

    it('stopHealthMonitoring calls healthMonitor.stop', () => {
      matrixE2EEBootstrapService.stopHealthMonitoring()
      expect(healthMonitorInstance.stop).toHaveBeenCalled()
    })

    it('getHealthStatus returns status from healthMonitor', () => {
      const status = { healthy: true }
      healthMonitorInstance.getStatus.mockReturnValue(status)
      expect(matrixE2EEBootstrapService.getHealthStatus()).toEqual(status)
    })

    it('registerHealthCallbacks forwards to healthMonitor', () => {
      const callbacks = { onHealthy: vi.fn() }
      matrixE2EEBootstrapService.registerHealthCallbacks(callbacks as never)
      expect(healthMonitorInstance.registerCallbacks).toHaveBeenCalledWith(callbacks)
    })
  })

  describe('reset', () => {
    it('stops monitoring, invalidates cache and resets initialized flag', async () => {
      mockClient()
      mockedSDKAdapter.isEncryptionAvailable.mockResolvedValue(true)
      mockedCryptoService.getCryptoStatus.mockResolvedValue({
        crossSigningReady: true,
        keyBackupEnabled: true
      })
      mockedCryptoService.initializeCrypto.mockResolvedValue(undefined)
      await matrixE2EEBootstrapService.bootstrapE2EE()

      matrixE2EEBootstrapService.reset()

      expect(mockedSDKAdapter.invalidateCryptoCache).toHaveBeenCalled()
      expect(healthMonitorInstance.stop).toHaveBeenCalled()
      const status = await matrixE2EEBootstrapService.getE2EESettingsStatus()
      expect(status.isInitialized).toBe(false)
    })
  })
})
