import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeRecoveryKey } from '@/services/matrix/sdk'
import type { CryptoApi, KeyBackupManager, MatrixClientExtended } from '@/types/matrix-extensions'
import { clearSecretStorageKeys } from '../../secretStorageKeyVault'
import { CryptoKeyBackupAdapter } from '../CryptoKeyBackupAdapter'
import type { CryptoAdapterAccessors } from '../cryptoAdapterTypes'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() })
}))

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: { getClient: vi.fn().mockReturnValue({ getSyncState: vi.fn(), startClient: vi.fn() }) }
}))

/**
 * 幻影契约回归：不得调用 vendored matrix-js-sdk 中不存在的 KeyBackupManager 方法。
 *
 * 历史缺陷（F-13/F-14）：
 * - `backupKeys` 无守卫调用 `backupManager.scheduleKeyBackupSend()`；
 * - `restoreKeys` 无守卫调用 `backupManager.restoreKeyBackupWithRecoveryKey(key)`。
 * 二者在真实 KeyBackupManager 上都不存在（只有本仓自造类型声称有），
 * 运行时会 `TypeError: ... is not a function`。
 */

function makeAccessors(opts: {
  keyBackupManager?: Partial<KeyBackupManager> | null
  crypto?: Partial<CryptoApi> | null
}): CryptoAdapterAccessors {
  return {
    getCrypto: () => (opts.crypto ?? null) as CryptoApi | null,
    getExtendedClient: () => ({}) as MatrixClientExtended,
    getClient: () => ({}) as never,
    getDeviceTrustManager: () => null,
    getSecureBackupManager: () => null,
    getKeyBackupManager: () => (opts.keyBackupManager ?? null) as KeyBackupManager | null,
    getSDKDeviceKeysManager: () => null,
    getSDKKeyBackupManager: () => null,
    getSDKKeyVerificationManager: () => null
  } as CryptoAdapterAccessors
}

/** 真实的 KeyBackupManager 没有这两个方法——不要把它们放进 mock 表面 */
const REAL_MANAGER_SURFACE = {
  checkKeyBackup: vi.fn(),
  getLatestBackupVersion: vi.fn(),
  ensureBackupVersion: vi.fn(),
  importKeys: vi.fn()
}

describe('CryptoKeyBackupAdapter 幻影方法防护', () => {
  beforeEach(() => {
    clearSecretStorageKeys()
    vi.clearAllMocks()
    REAL_MANAGER_SURFACE.checkKeyBackup.mockResolvedValue({ version: '1' })
  })

  it('backupKeys 在 manager 无 scheduleKeyBackupSend 时不得抛错', async () => {
    const adapter = new CryptoKeyBackupAdapter(makeAccessors({ keyBackupManager: { ...REAL_MANAGER_SURFACE } }))

    await expect(adapter.backupKeys()).resolves.toBeUndefined()
  })

  it('backupKeys 不得调用不存在的 scheduleKeyBackupSend', async () => {
    const manager = { ...REAL_MANAGER_SURFACE, scheduleKeyBackupSend: vi.fn() }
    const adapter = new CryptoKeyBackupAdapter(makeAccessors({ keyBackupManager: manager }))

    await adapter.backupKeys()

    expect(manager.scheduleKeyBackupSend).not.toHaveBeenCalled()
  })

  it('restoreKeys 不得调用不存在的 restoreKeyBackupWithRecoveryKey', async () => {
    const manager = {
      ...REAL_MANAGER_SURFACE,
      restoreKeyBackupWithRecoveryKey: vi.fn()
    }
    const loadFromSecretStorage = vi.fn().mockResolvedValue(undefined)
    const adapter = new CryptoKeyBackupAdapter(
      makeAccessors({
        keyBackupManager: manager,
        crypto: {
          getSecretStorageStatus: vi.fn().mockResolvedValue({ ready: true, defaultKeyId: 'key-1' }),
          loadSessionBackupPrivateKeyFromSecretStorage: loadFromSecretStorage,
          getKeyBackupInfo: vi.fn().mockResolvedValue({ version: '1' }),
          restoreKeyBackup: vi.fn().mockResolvedValue({ imported: 3, total: 4 })
        }
      })
    )

    const result = await adapter.restoreKeys(validRecoveryKey())

    expect(manager.restoreKeyBackupWithRecoveryKey).not.toHaveBeenCalled()
    // 应走与 restoreFromBackup 相同的正确机制
    expect(loadFromSecretStorage).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ imported: 3, total: 4 })
  })

  it('restoreKeys 对非法恢复密钥抛错，且不调用任何恢复接口', async () => {
    const manager = { ...REAL_MANAGER_SURFACE }
    const restoreKeyBackup = vi.fn()
    const adapter = new CryptoKeyBackupAdapter(
      makeAccessors({
        keyBackupManager: manager,
        crypto: {
          getSecretStorageStatus: vi.fn().mockResolvedValue({ ready: true, defaultKeyId: 'key-1' }),
          loadSessionBackupPrivateKeyFromSecretStorage: vi.fn(),
          getKeyBackupInfo: vi.fn().mockResolvedValue({ version: '1' }),
          restoreKeyBackup
        }
      })
    )

    await expect(adapter.restoreKeys('not-a-valid-recovery-key')).rejects.toThrow()
    expect(restoreKeyBackup).not.toHaveBeenCalled()
  })
})

function validRecoveryKey(): string {
  // 用真实编码器生成合法恢复密钥（非法密钥会被 decodeRecoveryKey 拒绝）
  return encodeRecoveryKey(crypto.getRandomValues(new Uint8Array(32))) as string
}
