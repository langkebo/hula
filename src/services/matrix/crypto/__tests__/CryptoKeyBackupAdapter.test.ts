import { describe, expect, it, vi } from 'vitest'
import type {
  DeviceKeysManager,
  KeyVerificationManager,
  MatrixClient,
  SDKKeyBackupManager
} from '@/services/matrix/sdk'
import type {
  CryptoApi,
  GeneratedSecretStorageKey,
  KeyBackupManager,
  MatrixClientExtended,
  SecureBackupManager
} from '@/types/matrix-extensions'
import { CryptoKeyBackupAdapter } from '../CryptoKeyBackupAdapter'
import type { CryptoAdapterAccessors } from '../cryptoAdapterTypes'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn().mockReturnValue({
      getSyncState: vi.fn().mockReturnValue('SYNCING'),
      startClient: vi.fn()
    })
  }
}))

function createMockAccessors(opts: {
  crypto?: CryptoApi | null
  keyBackupManager?: KeyBackupManager | null
  secureBackupManager?: SecureBackupManager | null
  sdkKeyBackupManager?: SDKKeyBackupManager | null
}): CryptoAdapterAccessors {
  return {
    getCrypto: () => opts.crypto ?? null,
    getExtendedClient: () => ({}) as MatrixClientExtended,
    getClient: () => ({}) as MatrixClient,
    getDeviceTrustManager: () => null,
    getSecureBackupManager: () => opts.secureBackupManager ?? null,
    getKeyBackupManager: () => opts.keyBackupManager ?? null,
    getSDKDeviceKeysManager: () => null as unknown as DeviceKeysManager | null,
    getSDKKeyBackupManager: () => opts.sdkKeyBackupManager ?? null,
    getSDKKeyVerificationManager: () => null as unknown as KeyVerificationManager | null
  } as CryptoAdapterAccessors
}

const fakeGeneratedKey: GeneratedSecretStorageKey = {
  keyInfo: { algorithm: 'm.secret_storage.v1.aes-hmac-sha2', iv: 'iv', mac: 'mac' },
  encodedPrivateKey: 'EsTj LW6N 9WqD ...',
  privateKey: new Uint8Array([1, 2, 3])
}

describe('CryptoKeyBackupAdapter', () => {
  describe('backupKeys', () => {
    it('creates new backup when none exists via KeyBackupManager, then schedules send', async () => {
      const keyBackupManager = {
        checkKeyBackup: vi.fn().mockResolvedValue(null),
        scheduleKeyBackupSend: vi.fn().mockResolvedValue(undefined)
      } as unknown as KeyBackupManager
      const crypto = { resetKeyBackup: vi.fn().mockResolvedValue(undefined) } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ keyBackupManager, crypto }))

      await adapter.backupKeys()

      expect(keyBackupManager.checkKeyBackup).toHaveBeenCalled()
      expect(crypto.resetKeyBackup).toHaveBeenCalled()
      expect(keyBackupManager.scheduleKeyBackupSend).toHaveBeenCalled()
    })

    it('skips reset when backup already exists, but still schedules send', async () => {
      const keyBackupManager = {
        checkKeyBackup: vi.fn().mockResolvedValue({ version: '1', algorithm: 'm.megolm_backup.v1' }),
        scheduleKeyBackupSend: vi.fn().mockResolvedValue(undefined)
      } as unknown as KeyBackupManager
      const crypto = { resetKeyBackup: vi.fn() } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ keyBackupManager, crypto }))

      await adapter.backupKeys()

      expect(crypto.resetKeyBackup).not.toHaveBeenCalled()
      expect(keyBackupManager.scheduleKeyBackupSend).toHaveBeenCalled()
    })

    it('falls back to CryptoApi when no KeyBackupManager', async () => {
      const crypto = {
        getKeyBackupInfo: vi.fn().mockResolvedValue(null),
        resetKeyBackup: vi.fn().mockResolvedValue(undefined)
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      await adapter.backupKeys()

      expect(crypto.getKeyBackupInfo).toHaveBeenCalled()
      expect(crypto.resetKeyBackup).toHaveBeenCalled()
    })

    it('does nothing when CryptoApi has existing backup and no KeyBackupManager', async () => {
      const crypto = {
        getKeyBackupInfo: vi.fn().mockResolvedValue({ version: '1' }),
        resetKeyBackup: vi.fn()
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      await adapter.backupKeys()

      expect(crypto.resetKeyBackup).not.toHaveBeenCalled()
    })
  })

  describe('setupKeyBackup', () => {
    it('derives client-side via setupKeyBackupWithOptions and returns success', async () => {
      const crypto = {
        createRecoveryKeyFromPassphrase: vi.fn().mockResolvedValue(fakeGeneratedKey),
        resetKeyBackup: vi.fn().mockResolvedValue(undefined)
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.setupKeyBackup('my-passphrase')

      expect(crypto.createRecoveryKeyFromPassphrase).toHaveBeenCalledWith('my-passphrase')
      expect(crypto.resetKeyBackup).toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })

    it('returns failure when CryptoApi is unavailable', async () => {
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto: null }))
      const result = await adapter.setupKeyBackup('pass')
      expect(result).toEqual({ success: false })
    })
  })

  describe('setupKeyBackupWithOptions', () => {
    it('throws when CryptoApi is unavailable', async () => {
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto: null }))
      await expect(adapter.setupKeyBackupWithOptions()).rejects.toThrow('CryptoApi 不可用')
    })

    it('branch 1: restores from existing recoveryKey when provided as string', async () => {
      const crypto = { restoreKeyBackup: vi.fn().mockResolvedValue({ imported: 5, total: 5 }) } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.setupKeyBackupWithOptions('existing-recovery-key')

      expect(crypto.restoreKeyBackup).toHaveBeenCalled()
      expect(result).toBe('existing-recovery-key')
    })

    it('branch 1: restores from existing recoveryKey when provided in object', async () => {
      const crypto = { restoreKeyBackup: vi.fn().mockResolvedValue({ imported: 0, total: 0 }) } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.setupKeyBackupWithOptions({ recoveryKey: 'my-key' })

      expect(crypto.restoreKeyBackup).toHaveBeenCalled()
      expect(result).toBe('my-key')
    })

    it('branch 2: generates new key from passphrase via createRecoveryKeyFromPassphrase', async () => {
      const crypto = {
        createRecoveryKeyFromPassphrase: vi.fn().mockResolvedValue(fakeGeneratedKey),
        resetKeyBackup: vi.fn().mockResolvedValue(undefined)
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.setupKeyBackupWithOptions({ password: 'my-pass' })

      expect(crypto.createRecoveryKeyFromPassphrase).toHaveBeenCalledWith('my-pass')
      expect(crypto.resetKeyBackup).toHaveBeenCalled()
      expect(result).toBe(fakeGeneratedKey.encodedPrivateKey)
    })

    it('branch 2: generates key with random passphrase when password not provided', async () => {
      const crypto = {
        createRecoveryKeyFromPassphrase: vi.fn().mockResolvedValue(fakeGeneratedKey),
        resetKeyBackup: vi.fn().mockResolvedValue(undefined)
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      await adapter.setupKeyBackupWithOptions({})

      expect(crypto.createRecoveryKeyFromPassphrase).toHaveBeenCalledWith(undefined)
    })

    it('branch 3: uses provided generatedKey with SSSS background upload', async () => {
      const crypto = {
        bootstrapSecretStorage: vi.fn().mockResolvedValue(undefined),
        resetKeyBackup: vi.fn().mockResolvedValue(undefined)
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.setupKeyBackupWithOptions({ generatedKey: fakeGeneratedKey })

      // Branch 3 returns immediately with the encoded key (SSSS runs in background)
      expect(result).toBe(fakeGeneratedKey.encodedPrivateKey)
      // Give background task time to execute
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(crypto.bootstrapSecretStorage).toHaveBeenCalled()
      expect(crypto.resetKeyBackup).toHaveBeenCalled()
    })

    it('branch 4: falls back to resetKeyBackup when bootstrapSecretStorage not available', async () => {
      const crypto = {
        resetKeyBackup: vi.fn().mockResolvedValue(undefined)
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.setupKeyBackupWithOptions({ generatedKey: fakeGeneratedKey })

      expect(crypto.resetKeyBackup).toHaveBeenCalled()
      expect(result).toBe(fakeGeneratedKey.encodedPrivateKey)
    })

    it('branch 4: returns empty string when generatedKey has no encodedPrivateKey', async () => {
      const crypto = { resetKeyBackup: vi.fn().mockResolvedValue(undefined) } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.setupKeyBackupWithOptions({
        generatedKey: { keyInfo: {} } as GeneratedSecretStorageKey
      })

      expect(crypto.resetKeyBackup).toHaveBeenCalled()
      expect(result).toBe('')
    })
  })

  describe('restoreKeys', () => {
    it('uses KeyBackupManager when SecureBackupManager not available', async () => {
      const keyBackupManager = {
        checkKeyBackup: vi.fn().mockResolvedValue({ version: '1' }),
        restoreKeyBackupWithRecoveryKey: vi.fn().mockResolvedValue({ imported: 3, total: 5 })
      } as unknown as KeyBackupManager
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ keyBackupManager }))

      const result = await adapter.restoreKeys('recovery-key')

      expect(keyBackupManager.restoreKeyBackupWithRecoveryKey).toHaveBeenCalledWith('recovery-key')
      expect(result).toEqual({ imported: 3, total: 5 })
    })

    it('returns zeros when KeyBackupManager has no backup', async () => {
      const keyBackupManager = {
        checkKeyBackup: vi.fn().mockResolvedValue(null)
      } as unknown as KeyBackupManager
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ keyBackupManager }))

      const result = await adapter.restoreKeys('key')

      expect(result).toEqual({ imported: 0, total: 0 })
    })

    it('falls back to CryptoApi when no managers', async () => {
      const crypto = {
        getKeyBackupInfo: vi.fn().mockResolvedValue({ version: '1' }),
        restoreKeyBackup: vi.fn().mockResolvedValue({ imported: 7, total: 8 })
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.restoreKeys('ignored')

      expect(crypto.restoreKeyBackup).toHaveBeenCalled()
      expect(result).toEqual({ imported: 7, total: 8 })
    })

    it('returns zeros when no managers or crypto available', async () => {
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({}))
      const result = await adapter.restoreKeys('key')
      expect(result).toEqual({ imported: 0, total: 0 })
    })
  })

  describe('restoreFromBackup', () => {
    it('throws when CryptoApi unavailable', async () => {
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto: null }))
      await expect(adapter.restoreFromBackup('key')).rejects.toThrow('CryptoApi 不可用')
    })

    it('throws when no backup exists', async () => {
      const crypto = { getKeyBackupInfo: vi.fn().mockResolvedValue(null) } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))
      await expect(adapter.restoreFromBackup('key')).rejects.toThrow('无可用密钥备份')
    })

    it('restores via CryptoApi.restoreKeyBackup', async () => {
      const crypto = {
        getKeyBackupInfo: vi.fn().mockResolvedValue({ version: '1' }),
        restoreKeyBackup: vi.fn().mockResolvedValue({ imported: 4, total: 6 })
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.restoreFromBackup('key')

      expect(crypto.restoreKeyBackup).toHaveBeenCalled()
      expect(result).toEqual({ imported: 4, total: 6 })
    })
  })

  describe('restoreFromBackupWithPassphrase', () => {
    it('throws when CryptoApi unavailable', async () => {
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto: null }))
      await expect(adapter.restoreFromBackupWithPassphrase('pass')).rejects.toThrow('CryptoApi 不可用')
    })

    it('throws when no backup exists', async () => {
      const crypto = { getKeyBackupInfo: vi.fn().mockResolvedValue(null) } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))
      await expect(adapter.restoreFromBackupWithPassphrase('pass')).rejects.toThrow('无可用密钥备份')
    })

    it('throws when restoreKeyBackupWithPassphrase not available', async () => {
      const crypto = {
        getKeyBackupInfo: vi.fn().mockResolvedValue({ version: '1' })
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))
      await expect(adapter.restoreFromBackupWithPassphrase('pass')).rejects.toThrow(
        '当前客户端不支持通过安全短语恢复密钥备份'
      )
    })

    it('restores via CryptoApi.restoreKeyBackupWithPassphrase', async () => {
      const crypto = {
        getKeyBackupInfo: vi.fn().mockResolvedValue({ version: '1' }),
        restoreKeyBackupWithPassphrase: vi.fn().mockResolvedValue({ imported: 2, total: 3 })
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.restoreFromBackupWithPassphrase('my-pass')

      expect(crypto.restoreKeyBackupWithPassphrase).toHaveBeenCalledWith('my-pass')
      expect(result).toEqual({ imported: 2, total: 3 })
    })
  })

  describe('exportKeys', () => {
    it('exports room keys locally without server-side passphrase verification', async () => {
      const crypto = {
        exportRoomKeys: vi.fn().mockResolvedValue([{ id: 1 }])
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.exportKeys()

      expect(crypto.exportRoomKeys).toHaveBeenCalled()
      expect(result.count).toBe(1)
    })

    it('returns empty data when CryptoApi has no exportRoomKeys', async () => {
      const crypto = {} as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.exportKeys()

      expect(result).toEqual({ data: '', count: 0 })
    })

    it('returns empty data when no CryptoApi available', async () => {
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({}))
      const result = await adapter.exportKeys()
      expect(result).toEqual({ data: '', count: 0 })
    })
  })

  describe('importKeys', () => {
    it('imports keys via CryptoApi.importRoomKeys', async () => {
      const keys = [{ session_id: 's1' }, { session_id: 's2' }]
      const crypto = { importRoomKeys: vi.fn().mockResolvedValue(undefined) } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.importKeys(JSON.stringify(keys))

      expect(crypto.importRoomKeys).toHaveBeenCalledWith(keys)
      expect(result).toEqual({ imported: 2, total: 2 })
    })

    it('returns zeros when no CryptoApi available', async () => {
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({}))
      const result = await adapter.importKeys(JSON.stringify([]))
      expect(result).toEqual({ imported: 0, total: 0 })
    })

    it('handles non-array JSON', async () => {
      const crypto = { importRoomKeys: vi.fn().mockResolvedValue(undefined) } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.importKeys(JSON.stringify({ not: 'array' }))

      expect(result).toEqual({ imported: 0, total: 0 })
    })
  })

  describe('createRecoveryKeyFromPassphrase', () => {
    it('returns null when CryptoApi unavailable', async () => {
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto: null }))
      const result = await adapter.createRecoveryKeyFromPassphrase('pass')
      expect(result).toBeNull()
    })

    it('returns null when CryptoApi has no createRecoveryKeyFromPassphrase method', async () => {
      const crypto = {} as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))
      const result = await adapter.createRecoveryKeyFromPassphrase('pass')
      expect(result).toBeNull()
    })

    it('delegates to CryptoApi.createRecoveryKeyFromPassphrase', async () => {
      const crypto = {
        createRecoveryKeyFromPassphrase: vi.fn().mockResolvedValue(fakeGeneratedKey)
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.createRecoveryKeyFromPassphrase('my-pass')

      expect(crypto.createRecoveryKeyFromPassphrase).toHaveBeenCalledWith('my-pass')
      expect(result).toBe(fakeGeneratedKey)
    })

    it('passes undefined when no password provided', async () => {
      const crypto = {
        createRecoveryKeyFromPassphrase: vi.fn().mockResolvedValue(fakeGeneratedKey)
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      await adapter.createRecoveryKeyFromPassphrase()

      expect(crypto.createRecoveryKeyFromPassphrase).toHaveBeenCalledWith(undefined)
    })
  })
})
