import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeRecoveryKey } from '@/services/matrix/sdk'
import type { CryptoApi, KeyBackupManager, MatrixClientExtended } from '@/types/matrix-extensions'
import { clearSecretStorageKeys, hasSecretStorageKey } from '../../secretStorageKeyVault'
import { CryptoKeyBackupAdapter } from '../CryptoKeyBackupAdapter'
import type { CryptoAdapterAccessors } from '../cryptoAdapterTypes'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() })
}))

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: { getClient: vi.fn().mockReturnValue({ getSyncState: vi.fn(), startClient: vi.fn() }) }
}))

/**
 * 安全回归：恢复备份时恢复密钥必须**本地使用**，绝不上送服务端。
 *
 * 历史缺陷（F-01/F-02/F-03/F-05）：
 * - 恢复密钥被包装成 `{ recoveryKey }` 传给 `KeyBackupManager.importKeys`，
 *   最终进入 `POST /room_keys/import` 的请求体——恢复密钥以明文离开设备。
 * - `restoreFromBackup(_recoveryKey)` 直接丢弃入参，只用 crypto store 里已缓存的密钥，
 *   新设备（无缓存）永远恢复失败，而任意错误输入却能"成功"。
 *
 * 正确机制：把恢复密钥写入内存保险箱 → `loadSessionBackupPrivateKeyFromSecretStorage()`
 * 从 SSSS 取出备份解密密钥并存入 crypto store → `restoreKeyBackup()`。
 */

function makeRecoveryKey(): string {
  return encodeRecoveryKey(crypto.getRandomValues(new Uint8Array(32))) as string
}

function makeAccessors(crypto: Partial<CryptoApi>, client: Partial<MatrixClientExtended> = {}) {
  return {
    getCrypto: () => crypto as CryptoApi,
    getExtendedClient: () => client as MatrixClientExtended,
    getClient: () => ({}) as never,
    getDeviceTrustManager: () => null,
    getSecureBackupManager: () => null,
    getKeyBackupManager: () => null,
    getSDKDeviceKeysManager: () => null,
    getSDKKeyBackupManager: () => null,
    getSDKKeyVerificationManager: () => null
  } as CryptoAdapterAccessors
}

describe('CryptoKeyBackupAdapter.restoreFromBackup 安全性', () => {
  beforeEach(() => {
    clearSecretStorageKeys()
    vi.restoreAllMocks()
  })

  it('恢复密钥被写入内存保险箱，且不调用 importKeys 上送服务端', async () => {
    const importKeys = vi.fn()
    const loadSessionBackupPrivateKeyFromSecretStorage = vi.fn(async () => undefined)
    const restoreKeyBackup = vi.fn(async () => ({ imported: 5, total: 5 }))
    const getSecretStorageStatus = vi.fn(async () => ({ defaultKeyId: 'key-1' }))

    const keyBackupManager = { importKeys, getVersions: vi.fn() } as unknown as KeyBackupManager

    const adapter = new CryptoKeyBackupAdapter(
      makeAccessors({
        getSecretStorageStatus,
        loadSessionBackupPrivateKeyFromSecretStorage,
        restoreKeyBackup,
        getKeyBackupInfo: vi.fn(async () => ({ version: '1' }))
      } as unknown as Partial<CryptoApi>)
    )

    const recoveryKey = makeRecoveryKey()
    await adapter.restoreFromBackup(recoveryKey)

    // 恢复密钥只进内存保险箱
    expect(hasSecretStorageKey({ 'key-1': {} })).toBe(true)
    // 必须走 SSSS 取密钥 → 再恢复
    expect(loadSessionBackupPrivateKeyFromSecretStorage).toHaveBeenCalledTimes(1)
    expect(restoreKeyBackup).toHaveBeenCalledTimes(1)
    // 绝不允许把恢复密钥当 room key 导入
    expect(importKeys).not.toHaveBeenCalled()
    expect(keyBackupManager.importKeys).not.toHaveBeenCalled()
  })

  it('非法恢复密钥抛错，且不调用任何恢复接口', async () => {
    const loadSessionBackupPrivateKeyFromSecretStorage = vi.fn(async () => undefined)
    const restoreKeyBackup = vi.fn(async () => ({ imported: 0, total: 0 }))

    const adapter = new CryptoKeyBackupAdapter(
      makeAccessors({
        getSecretStorageStatus: vi.fn(async () => ({ defaultKeyId: 'key-1' })),
        loadSessionBackupPrivateKeyFromSecretStorage,
        restoreKeyBackup,
        getKeyBackupInfo: vi.fn(async () => ({ version: '1' }))
      } as unknown as Partial<CryptoApi>)
    )

    await expect(adapter.restoreFromBackup('definitely-not-a-valid-key')).rejects.toThrow()

    expect(loadSessionBackupPrivateKeyFromSecretStorage).not.toHaveBeenCalled()
    expect(restoreKeyBackup).not.toHaveBeenCalled()
  })
})
