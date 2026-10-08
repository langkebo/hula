import { describe, expect, it, vi } from 'vitest'
import type { DeviceKeysManager, MatrixClient, SDKKeyBackupManager } from '@/services/matrix/sdk'
import { encodeRecoveryKey as encodeRecoveryKeyReal } from '@/services/matrix/sdk'
import type {
  CryptoApi,
  GeneratedSecretStorageKey,
  KeyBackupManager,
  MatrixClientExtended,
  SecureBackupManager
} from '@/types/matrix-extensions'
import { CryptoKeyBackupAdapter } from '../CryptoKeyBackupAdapter'
import type { CryptoAdapterAccessors } from '../cryptoAdapterTypes'

// Mock: 测试辅助函数 - 生成 base58 编码的恢复密钥
function _encodeRecoveryKey(bytes: Uint8Array): string {
  // 简化实现：直接将字节转为 hex 字符串作为模拟密钥
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

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
    getSDKKeyBackupManager: () => opts.sdkKeyBackupManager ?? null
  } as CryptoAdapterAccessors
}

const fakeGeneratedKey: GeneratedSecretStorageKey = {
  // SDK 的 keyInfo 只有 passphrase/name（algorithm/iv/mac 由本地按规范计算）
  keyInfo: { name: 'TJG Security Key' },
  encodedPrivateKey: 'EsTj LW6N 9WqD ...',
  privateKey: new Uint8Array([1, 2, 3])
}

/** 生成一个格式合法的恢复密钥（base58 + 校验字节），用于 restoreFromBackup 用例 */
function validRecoveryKey(): string {
  return encodeRecoveryKeyReal(crypto.getRandomValues(new Uint8Array(32))) as string
}

describe('CryptoKeyBackupAdapter', () => {
  // 参考：真实的 KeyBackupManager 没有 scheduleKeyBackupSend；
  // 备份调度由 SDK backup engine 自动完成，本适配层只需确保版本存在。
  describe('backupKeys', () => {
    it('通过 ensureBackupVersion 确保版本存在（不调用任何幻影方法）', async () => {
      const keyBackupManager = {
        ensureBackupVersion: vi.fn().mockResolvedValue('1')
      } as unknown as KeyBackupManager
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ keyBackupManager }))

      await adapter.backupKeys()

      expect(keyBackupManager.ensureBackupVersion).toHaveBeenCalled()
    })

    it('manager 缺少 ensureBackupVersion 时显式失败，而不是静默无事发生', async () => {
      const keyBackupManager = { checkKeyBackup: vi.fn() } as unknown as KeyBackupManager
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ keyBackupManager }))

      await expect(adapter.backupKeys()).rejects.toThrow(/ensureBackupVersion/)
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
    it('委派给 restoreFromBackup：经 SSSS 取密钥，不走幻影的 recoveryKey 直导', async () => {
      const loadFromSecretStorage = vi.fn().mockResolvedValue(undefined)
      const crypto = {
        getSecretStorageStatus: vi.fn().mockResolvedValue({ ready: true, defaultKeyId: 'key-1' }),
        loadSessionBackupPrivateKeyFromSecretStorage: loadFromSecretStorage,
        getKeyBackupInfo: vi.fn().mockResolvedValue({ version: '1' }),
        restoreKeyBackup: vi.fn().mockResolvedValue({ imported: 3, total: 5 })
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.restoreKeys(validRecoveryKey())

      expect(loadFromSecretStorage).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ imported: 3, total: 5 })
    })

    it('非法恢复密钥抛错（不再静默返回 0）', async () => {
      const crypto = {
        getSecretStorageStatus: vi.fn().mockResolvedValue({ ready: true, defaultKeyId: 'key-1' }),
        loadSessionBackupPrivateKeyFromSecretStorage: vi.fn(),
        getKeyBackupInfo: vi.fn().mockResolvedValue({ version: '1' }),
        restoreKeyBackup: vi.fn()
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      await expect(adapter.restoreKeys('not-a-valid-key')).rejects.toThrow()
    })

    it('无备份时抛错（不再静默返回 0/0）', async () => {
      const crypto = {
        getSecretStorageStatus: vi.fn().mockResolvedValue({ ready: true, defaultKeyId: 'key-1' }),
        loadSessionBackupPrivateKeyFromSecretStorage: vi.fn(),
        getKeyBackupInfo: vi.fn().mockResolvedValue(null),
        restoreKeyBackup: vi.fn()
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      await expect(adapter.restoreKeys(validRecoveryKey())).rejects.toThrow(/无可用密钥备份/)
    })
  })

  describe('restoreFromBackup', () => {
    it('throws when CryptoApi unavailable', async () => {
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto: null }))
      await expect(adapter.restoreFromBackup('key')).rejects.toThrow('CryptoApi 不可用')
    })

    it('throws when no backup exists', async () => {
      const crypto = {
        loadSessionBackupPrivateKeyFromSecretStorage: vi.fn(),
        getSecretStorageStatus: vi.fn().mockResolvedValue({ ready: true, defaultKeyId: 'key-1' }),
        getKeyBackupInfo: vi.fn().mockResolvedValue(null)
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))
      await expect(adapter.restoreFromBackup(validRecoveryKey())).rejects.toThrow('无可用密钥备份')
    })

    it('restores via CryptoApi.restoreKeyBackup（恢复密钥经内存保险箱，不经 importKeys）', async () => {
      const loadFromSecretStorage = vi.fn().mockResolvedValue(undefined)
      const crypto = {
        loadSessionBackupPrivateKeyFromSecretStorage: loadFromSecretStorage,
        getSecretStorageStatus: vi.fn().mockResolvedValue({ ready: true, defaultKeyId: 'key-1' }),
        getKeyBackupInfo: vi.fn().mockResolvedValue({ version: '1' }),
        restoreKeyBackup: vi.fn().mockResolvedValue({ imported: 4, total: 6 })
      } as unknown as CryptoApi
      const adapter = new CryptoKeyBackupAdapter(createMockAccessors({ crypto }))

      const result = await adapter.restoreFromBackup(validRecoveryKey())

      expect(loadFromSecretStorage).toHaveBeenCalledTimes(1)
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
