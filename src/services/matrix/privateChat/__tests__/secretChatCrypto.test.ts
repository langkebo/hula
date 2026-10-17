import { webcrypto } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  createSecretChatVerifier,
  generateSecretChatSalt,
  isSecretChatKdfVerifier,
  SECRET_CHAT_KDF_PREFIX,
  verifySecretChatVerifier,
  zeroize
} from '../secretChatCrypto'

// happy-dom 的 crypto 可能不含 subtle；缺失时补上 Node 的 webcrypto 实现
if (globalThis.crypto && !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis.crypto, 'subtle', { value: webcrypto.subtle, configurable: true })
}

describe('secretChatCrypto', () => {
  it('派生出的 verifier 是四段式 PBKDF2 编码，且 dbKey 为 16 字节', async () => {
    const { encodedVerifier, dbKey } = await createSecretChatVerifier('correct horse battery staple')

    expect(isSecretChatKdfVerifier(encodedVerifier)).toBe(true)
    const parts = encodedVerifier.split('$')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe(SECRET_CHAT_KDF_PREFIX)
    expect(Number(parts[1])).toBeGreaterThanOrEqual(600_000)
    expect(dbKey).toHaveLength(16)
    // verifier 与 dbKey 必须不同：前者可落盘，后者绝不可落盘
    expect(Buffer.from(dbKey).toString('base64')).not.toBe(parts[3])
  })

  it('相同密码 + 相同盐可复现同一 verifier，但不同盐产出不同 verifier', async () => {
    const salt = generateSecretChatSalt()
    const a = await createSecretChatVerifier('same-password', salt)
    const b = await createSecretChatVerifier('same-password', salt)
    expect(a.encodedVerifier).toBe(b.encodedVerifier)

    const c = await createSecretChatVerifier('same-password', generateSecretChatSalt())
    expect(c.encodedVerifier).not.toBe(a.encodedVerifier)
  })

  it('正确密码校验通过并派生出 dbKey', async () => {
    const { encodedVerifier } = await createSecretChatVerifier('s3cret-pass')
    const result = await verifySecretChatVerifier('s3cret-pass', encodedVerifier)

    expect(result.valid).toBe(true)
    expect(result.dbKey).toHaveLength(16)
  })

  it('错误密码校验失败且不返回 dbKey', async () => {
    const { encodedVerifier } = await createSecretChatVerifier('s3cret-pass')
    const result = await verifySecretChatVerifier('wrong-pass', encodedVerifier)

    expect(result.valid).toBe(false)
    expect(result.dbKey).toBeNull()
  })

  it('非 PBKDF2 格式（旧 sha256 / DJB2）不在此模块校验', async () => {
    expect(await verifySecretChatVerifier('x', 'sha256:abc')).toEqual({ valid: false, dbKey: null })
    expect(await verifySecretChatVerifier('x', 'deadbeef')).toEqual({ valid: false, dbKey: null })
    expect(await verifySecretChatVerifier('x', `${SECRET_CHAT_KDF_PREFIX}$600000$onlythree`)).toEqual({
      valid: false,
      dbKey: null
    })
  })

  it('zeroize 就地清零且对 null 安全', () => {
    const bytes = new Uint8Array([1, 2, 3])
    zeroize(bytes)
    expect(Array.from(bytes)).toEqual([0, 0, 0])
    expect(() => zeroize(null)).not.toThrow()
    expect(() => zeroize(undefined)).not.toThrow()
  })
})
