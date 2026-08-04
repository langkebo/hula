import { createLogger } from '@/utils/Logger'

const logger = createLogger('SessionCrypto')

const ENCRYPTION_KEY_MATERIAL = 'tjg-session-encryption-key-v1'
const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 12

async function deriveKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = encoder.encode(ENCRYPTION_KEY_MATERIAL)
  const hash = await crypto.subtle.digest('SHA-256', keyMaterial)
  return crypto.subtle.importKey('raw', hash, { name: ALGORITHM }, false, ['encrypt', 'decrypt'])
}

export async function encryptForSession(plaintext: string): Promise<string> {
  try {
    const key = await deriveKey()
    const encoder = new TextEncoder()
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoder.encode(plaintext))
    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(encrypted), iv.length)
    return btoa(String.fromCharCode(...combined))
  } catch (error) {
    logger.warn('加密失败，将使用明文存储', error)
    return plaintext
  }
}

export async function decryptFromSession(ciphertext: string): Promise<string> {
  try {
    const key = await deriveKey()
    const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))
    const iv = combined.slice(0, IV_LENGTH)
    const data = combined.slice(IV_LENGTH)
    const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, data)
    return new TextDecoder().decode(decrypted)
  } catch (error) {
    logger.warn('解密失败，尝试作为明文读取', error)
    return ciphertext
  }
}
