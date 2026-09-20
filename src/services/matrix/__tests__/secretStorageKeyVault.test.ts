import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeRecoveryKey, encodeRecoveryKey } from '@/services/matrix/sdk'

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

import {
  clearSecretStorageKeys,
  getSecretStorageKey,
  hasSecretStorageKey,
  setSecretStorageKeyFromRecoveryKey
} from '../secretStorageKeyVault'

/**
 * 安全回归：SSSS 私钥必须只驻留内存。
 *
 * 历史缺陷：MatrixConnectionManager 的 cacheSecretStorageKey 把原始私钥 base64 后写入
 * sessionStorage（`ssss_<keyId>`），登出不清除，同源脚本/XSS 可读，且跨刷新存活。
 * sessionStorage 是持久化存储，不是"会话内内存"。
 */

function makeRecoveryKey(): string {
  return encodeRecoveryKey(crypto.getRandomValues(new Uint8Array(32))) as string
}

describe('secretStorageKeyVault', () => {
  beforeEach(() => {
    clearSecretStorageKeys()
    sessionStorage.clear()
    logSpy.warn.mockClear()
  })

  it('存入后可按 keyId 取回密钥', () => {
    const recoveryKey = makeRecoveryKey()
    const keys = { 'key-id-1': { algorithm: 'm.secret_storage.v1.aes-hmac-sha2' } }

    const stored = setSecretStorageKeyFromRecoveryKey(recoveryKey, keys)

    expect(stored).toBe('key-id-1')
    expect(getSecretStorageKey(keys)).toEqual(['key-id-1', decodeRecoveryKey(recoveryKey)])
  })

  it('绝不写 sessionStorage/localStorage', () => {
    const recoveryKey = makeRecoveryKey()
    setSecretStorageKeyFromRecoveryKey(recoveryKey, { 'key-id-1': {} })

    expect(sessionStorage.length).toBe(0)
    expect(localStorage.getItem('ssss_key-id-1')).toBeNull()
    // 序列化整个 storage 也不应含恢复密钥
    expect(JSON.stringify(sessionStorage)).not.toContain(recoveryKey)
  })

  it('非法恢复密钥不写入任何内容并抛错', () => {
    expect(() => setSecretStorageKeyFromRecoveryKey('not-a-valid-recovery-key', { 'key-id-1': {} })).toThrow()
    expect(hasSecretStorageKey({ 'key-id-1': {} })).toBe(false)
  })

  it('无匹配 keyId 时不返回密钥', () => {
    setSecretStorageKeyFromRecoveryKey(makeRecoveryKey(), { 'key-id-1': {} })

    expect(getSecretStorageKey({ 'other-id': {} })).toBeNull()
  })

  it('clear 后密钥不再可用', () => {
    const keys = { 'key-id-1': {} }
    setSecretStorageKeyFromRecoveryKey(makeRecoveryKey(), keys)
    clearSecretStorageKeys()

    expect(hasSecretStorageKey(keys)).toBe(false)
    expect(getSecretStorageKey(keys)).toBeNull()
  })

  it('多个 keyId 时优先 defaultKeyId', () => {
    const recoveryKey = makeRecoveryKey()
    const stored = setSecretStorageKeyFromRecoveryKey(recoveryKey, {
      'key-a': {},
      'key-b': {}
    })

    expect(stored).toBe('key-a')
    expect(getSecretStorageKey({ 'key-b': {}, 'key-a': {} })?.[0]).toBe('key-a')
  })
})
