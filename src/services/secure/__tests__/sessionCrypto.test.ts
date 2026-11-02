import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invokeMock, hasTauriRuntimeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  hasTauriRuntimeMock: vi.fn(() => false)
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@/utils/AppHarness', () => ({ hasTauriRuntime: hasTauriRuntimeMock }))

import { decryptFromSession, encryptForSession } from '../sessionCrypto'

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
    vi.clearAllMocks()
    hasTauriRuntimeMock.mockReturnValue(false)
    window.localStorage.clear()
    window.sessionStorage.clear()
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

  it('never persists key material to localStorage', async () => {
    const ciphertext = await encryptForSession('no-disk-key')
    await decryptFromSession(ciphertext)

    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('throws when the ciphertext is tampered with', async () => {
    const ciphertext = await encryptForSession('tamper-me')
    const body = ciphertext.slice(CIPHERTEXT_VERSION_PREFIX.length)
    const tampered = `${CIPHERTEXT_VERSION_PREFIX}${body.slice(0, -4)}AAAA`

    await expect(decryptFromSession(tampered)).rejects.toThrow()
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

  describe('Tauri runtime', () => {
    beforeEach(() => {
      hasTauriRuntimeMock.mockReturnValue(true)
    })

    it('delegates encryption to the Rust keychain-backed command', async () => {
      invokeMock.mockResolvedValue(`${CIPHERTEXT_VERSION_PREFIX}ciphertext`)

      await expect(encryptForSession('delegated')).resolves.toBe(`${CIPHERTEXT_VERSION_PREFIX}ciphertext`)
      expect(invokeMock).toHaveBeenCalledWith('session_secret_encrypt', { plaintext: 'delegated' })
      expect(window.localStorage.length).toBe(0)
    })

    it('delegates decryption to the Rust keychain-backed command', async () => {
      invokeMock.mockResolvedValue('decrypted-value')

      await expect(decryptFromSession(`${CIPHERTEXT_VERSION_PREFIX}ciphertext`)).resolves.toBe('decrypted-value')
      expect(invokeMock).toHaveBeenCalledWith('session_secret_decrypt', {
        ciphertext: `${CIPHERTEXT_VERSION_PREFIX}ciphertext`
      })
    })

    it('does not use WebCrypto for v2 ciphertext', async () => {
      invokeMock.mockResolvedValue('plain')
      const encryptSpy = vi.spyOn(crypto.subtle, 'encrypt')
      const decryptSpy = vi.spyOn(crypto.subtle, 'decrypt')

      await encryptForSession('plain')
      await decryptFromSession(`${CIPHERTEXT_VERSION_PREFIX}ciphertext`)

      expect(encryptSpy).not.toHaveBeenCalled()
      expect(decryptSpy).not.toHaveBeenCalled()
      encryptSpy.mockRestore()
      decryptSpy.mockRestore()
    })
  })
})
