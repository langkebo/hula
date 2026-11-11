import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLastCryptoUser,
  readLastCryptoEncrypted,
  readLastCryptoUser,
  writeLastCryptoEncrypted,
  writeLastCryptoUser
} from '../cryptoLocalState'

/**
 * 这组 key 是跨会话契约：启动时据此判断是否需要清理上一账号/上一原语的 crypto store。
 * key 名漂移会让「换账号清钥」静默失效，因此测试按 localStorage 原始 key 断言。
 */
const LAST_CRYPTO_USER_KEY = 'tjg.lastCryptoUserId'
const LAST_CRYPTO_ENCRYPTED_KEY = 'tjg.lastCryptoEncrypted'

describe('cryptoLocalState', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
  })

  it('returns null before anything is written', () => {
    expect(readLastCryptoUser()).toBeNull()
    expect(readLastCryptoEncrypted()).toBeNull()
  })

  it('round-trips the last crypto user under the stable localStorage key', () => {
    writeLastCryptoUser('@alice:tjg.local')
    expect(readLastCryptoUser()).toBe('@alice:tjg.local')
    expect(globalThis.localStorage.getItem(LAST_CRYPTO_USER_KEY)).toBe('@alice:tjg.local')
  })

  it('round-trips every documented encryption marker', () => {
    for (const marker of ['k1', 'p1', '1', '0']) {
      writeLastCryptoEncrypted(marker)
      expect(readLastCryptoEncrypted()).toBe(marker)
      expect(globalThis.localStorage.getItem(LAST_CRYPTO_ENCRYPTED_KEY)).toBe(marker)
    }
  })

  it('clears both records together', () => {
    writeLastCryptoUser('@alice:tjg.local')
    writeLastCryptoEncrypted('k1')

    clearLastCryptoUser()

    expect(readLastCryptoUser()).toBeNull()
    expect(readLastCryptoEncrypted()).toBeNull()
    expect(globalThis.localStorage.length).toBe(0)
  })

  it('degrades to no-op / null when localStorage is unavailable', () => {
    const original = globalThis.localStorage
    vi.stubGlobal('localStorage', undefined)
    try {
      expect(readLastCryptoUser()).toBeNull()
      expect(readLastCryptoEncrypted()).toBeNull()
      expect(() => writeLastCryptoUser('@alice:tjg.local')).not.toThrow()
      expect(() => writeLastCryptoEncrypted('k1')).not.toThrow()
      expect(() => clearLastCryptoUser()).not.toThrow()
    } finally {
      vi.stubGlobal('localStorage', original)
    }
  })
})
