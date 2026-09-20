import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CryptoCallbacks } from '@/services/matrix/sdk'
import { encodeRecoveryKey } from '@/services/matrix/sdk'

const logSpy = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }))
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => logSpy
}))

import { createSecretStorageCryptoCallbacks } from '../secretStorageCallbacks'
import {
  clearSecretStorageKeys,
  getSecretStorageKey as getVaultKey,
  setSecretStorageKeyFromRecoveryKey
} from '../secretStorageKeyVault'

/**
 * 安全回归：SSSS 私钥回调不得落盘。
 *
 * 历史缺陷：cacheSecretStorageKey 把原始私钥 base64 写入 sessionStorage，
 * getSecretStorageKey 只从 sessionStorage 读取。两者都必须改为内存保险箱。
 */

describe('createSecretStorageCryptoCallbacks', () => {
  let callbacks: CryptoCallbacks

  beforeEach(() => {
    clearSecretStorageKeys()
    sessionStorage.clear()
    localStorage.clear()
    callbacks = createSecretStorageCryptoCallbacks()
  })

  it('未载入密钥时 getSecretStorageKey 返回 null', async () => {
    const result = await callbacks.getSecretStorageKey?.({ keys: { 'key-1': {} } } as never, '')
    expect(result).toBeNull()
  })

  it('从用户恢复密钥载入后可按 keyId 取回', async () => {
    const recoveryKey = encodeRecoveryKey(crypto.getRandomValues(new Uint8Array(32))) as string
    setSecretStorageKeyFromRecoveryKey(recoveryKey, { 'key-1': {} })

    const result = await callbacks.getSecretStorageKey?.({ keys: { 'key-1': {} } } as never, '')
    expect(result?.[0]).toBe('key-1')
    expect(result?.[1]).toBeInstanceOf(Uint8Array)
  })

  it('cacheSecretStorageKey 不得写 sessionStorage（私钥只驻内存）', () => {
    const key = crypto.getRandomValues(new Uint8Array(32))

    callbacks.cacheSecretStorageKey?.(
      'key-1',
      { name: 'k', algorithm: 'm.secret_storage.v1.aes-hmac-sha2' } as never,
      key
    )

    expect(sessionStorage.length).toBe(0)
    expect(localStorage.length).toBe(0)
    // 缓存后应能从内存保险箱取回
    expect(getVaultKey({ 'key-1': {} })?.[1]).toEqual(key)
  })
})
