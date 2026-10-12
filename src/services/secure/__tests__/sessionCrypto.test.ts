import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decryptFromSession, encryptForSession, SESSION_CRYPTO_SECRET_STORAGE_KEY } from '../sessionCrypto'

const CIPHERTEXT_VERSION_PREFIX = 'tjg:v2:'

/** 复刻 v1（历史）加密实现，用于生成可供只读迁移的旧密文。 */
async function makeLegacyV1Ciphertext(plaintext: string): Promise<string> {
  const keyMaterial = new TextEncoder().encode('tjg-session-encryption-key-v1')
  const hash = await crypto.subtle.digest('SHA-256', keyMaterial)
  const key = await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)
  let binary = ''
  for (const byte of combined) binary += String.fromCharCode(byte)
  return btoa(binary)
}

describe('sessionCrypto', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('roundtrips plaintext through encrypt/decrypt with a v2 prefix', async () => {
    const plaintext = 'trendradar-secret-key'
    const ciphertext = await encryptForSession(plaintext)

    expect(ciphertext.startsWith(CIPHERTEXT_VERSION_PREFIX)).toBe(true)
    expect(ciphertext).not.toContain(plaintext)
    await expect(decryptFromSession(ciphertext)).resolves.toBe(plaintext)
  })

  it('produces different ciphertext for the same plaintext (random salt/iv)', async () => {
    const first = await encryptForSession('same-value')
    const second = await encryptForSession('same-value')

    expect(first).not.toBe(second)
  })

  it('reuses a stable per-install secret across calls', async () => {
    await encryptForSession('a')
    const secretAfterFirst = window.localStorage.getItem(SESSION_CRYPTO_SECRET_STORAGE_KEY)
    await encryptForSession('b')
    const secretAfterSecond = window.localStorage.getItem(SESSION_CRYPTO_SECRET_STORAGE_KEY)

    expect(secretAfterFirst).toBeTruthy()
    expect(secretAfterSecond).toBe(secretAfterFirst)
  })

  it('cross-session roundtrip: ciphertext written earlier still decrypts after secret reload', async () => {
    const ciphertext = await encryptForSession('persisted-value')
    const persistedSecret = window.localStorage.getItem(SESSION_CRYPTO_SECRET_STORAGE_KEY)

    // 模拟刷新后再解密：仅保留 per-install 密钥，密文来自“上一次会话”
    window.localStorage.setItem(SESSION_CRYPTO_SECRET_STORAGE_KEY, persistedSecret as string)
    await expect(decryptFromSession(ciphertext)).resolves.toBe('persisted-value')
  })

  it('throws when the ciphertext is tampered with', async () => {
    const ciphertext = await encryptForSession('tamper-me')
    const body = ciphertext.slice(CIPHERTEXT_VERSION_PREFIX.length)
    const tampered = `${CIPHERTEXT_VERSION_PREFIX}${body.slice(0, -4)}AAAA`

    await expect(decryptFromSession(tampered)).rejects.toThrow()
  })

  it('throws when decryption key material is unavailable (localStorage disabled)', async () => {
    const ciphertext = await encryptForSession('needs-storage')
    window.localStorage.clear()
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', { configurable: true, value: undefined })
    try {
      await expect(decryptFromSession(ciphertext)).rejects.toThrow()
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original)
    }
  })

  it('throws instead of falling back to plaintext when encryption fails', async () => {
    const encryptSpy = vi.spyOn(crypto.subtle, 'encrypt').mockRejectedValue(new Error('boom'))

    await expect(encryptForSession('secret')).rejects.toThrow('boom')
    encryptSpy.mockRestore()
  })

  it('decrypts legacy v1 ciphertext for read-only migration', async () => {
    const legacy = await makeLegacyV1Ciphertext('legacy-value')

    expect(legacy.startsWith(CIPHERTEXT_VERSION_PREFIX)).toBe(false)
    await expect(decryptFromSession(legacy)).resolves.toBe('legacy-value')
  })

  it('throws on malformed legacy ciphertext instead of returning it verbatim', async () => {
    await expect(decryptFromSession('not-a-valid-ciphertext')).rejects.toThrow()
  })
})
