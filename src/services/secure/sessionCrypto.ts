import { createLogger } from '@/utils/Logger'
import { requireSubtleCrypto } from '@/utils/webCompat'

const logger = createLogger('SessionCrypto')

/**
 * 密文格式版本前缀。
 *
 * v1（无前缀，裸 base64）为历史格式，仅供**只读迁移**；
 * v2 起携带随机盐并用 PBKDF2 派生密钥，格式为 `<前缀><base64(salt|iv|ciphertext)>`。
 */
const CIPHERTEXT_VERSION_PREFIX = 'tjg:v2:'

/**
 * per-install 随机密钥的持久化位（localStorage）。
 *
 * 仅在平台安全存储（Tauri keychain）不可用、需要退回 sessionStorage 时使用；
 * 首次调用生成 32 随机字节并写入，后续复用同一密钥，保证跨刷新可解密。
 * 名称含 `STORAGE_KEY` 以被 `scripts/check-settings-wiring.mjs` 纳管为持久化 key。
 */
export const SESSION_CRYPTO_SECRET_STORAGE_KEY = 'tjg-session-crypto-secret-v2'

/** 随机 install 密钥长度（字节）。 */
const SECRET_BYTES = 32
/** PBKDF2 盐长度（字节）。 */
const SALT_BYTES = 16
/** AES-GCM 初始向量长度（字节）。 */
const IV_BYTES = 12
/** PBKDF2 迭代次数（对齐 OWASP 2023 对 SHA-256 的推荐下限）。 */
const PBKDF2_ITERATIONS = 210_000
/** AES 密钥长度（位）。 */
const AES_KEY_BITS = 256
/** 加密算法。 */
const ALGORITHM = 'AES-GCM'
/** 密钥派生算法。 */
const KDF_ALGORITHM = 'PBKDF2'
/** 密钥派生哈希。 */
const KDF_HASH = 'SHA-256'

/** v1 硬编码密钥材料，仅用于只读迁移旧密文，禁止用于新写入。 */
const LEGACY_KEY_MATERIAL_V1 = 'tjg-session-encryption-key-v1'
/** v1 密文初始向量长度（字节）。 */
const LEGACY_IV_LENGTH = 12

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(encoded: string): Uint8Array<ArrayBuffer> {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * 读取（或首次生成）per-install 随机密钥。
 *
 * @returns 恰好 {@link SECRET_BYTES} 字节的随机密钥
 * @throws localStorage 不可用时抛错（fail-closed，绝不退化为可预测的固定密钥）
 */
function getOrCreateInstallSecret(): Uint8Array<ArrayBuffer> {
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage 不可用，无法获取会话加密密钥')
  }

  const existing = localStorage.getItem(SESSION_CRYPTO_SECRET_STORAGE_KEY)
  if (existing) {
    try {
      const decoded = base64ToBytes(existing)
      if (decoded.length === SECRET_BYTES) {
        return decoded
      }
      logger.warn('已存储的会话加密密钥长度非法，将重新生成')
    } catch (error) {
      logger.warn('已存储的会话加密密钥无法解析，将重新生成', error)
    }
  }

  const secret = crypto.getRandomValues(new Uint8Array(SECRET_BYTES))
  localStorage.setItem(SESSION_CRYPTO_SECRET_STORAGE_KEY, bytesToBase64(secret))
  return secret
}

async function deriveKeyFromSecret(secret: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const subtle = requireSubtleCrypto()
  const baseKey = await subtle.importKey('raw', secret, { name: KDF_ALGORITHM }, false, ['deriveKey'])
  return subtle.deriveKey(
    { name: KDF_ALGORITHM, salt, iterations: PBKDF2_ITERATIONS, hash: KDF_HASH },
    baseKey,
    { name: ALGORITHM, length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * 解密 v1 历史密文（无前缀、裸 SHA-256 派生密钥）。
 *
 * 仅用于兼容迁移；解密失败即抛错，不返回原密文。
 */
async function decryptLegacyV1(ciphertext: string): Promise<string> {
  const subtle = requireSubtleCrypto()
  const legacyKey = await subtle.importKey(
    'raw',
    await subtle.digest('SHA-256', new TextEncoder().encode(LEGACY_KEY_MATERIAL_V1)),
    { name: ALGORITHM },
    false,
    ['decrypt']
  )
  const combined = base64ToBytes(ciphertext)
  const iv = combined.slice(0, LEGACY_IV_LENGTH)
  const data = combined.slice(LEGACY_IV_LENGTH)
  const decrypted = await subtle.decrypt({ name: ALGORITHM, iv }, legacyKey, data)
  return new TextDecoder().decode(decrypted)
}

/**
 * 加密会话级敏感值。
 *
 * 使用 per-install 随机密钥 + 随机盐经 PBKDF2 派生 AES-GCM 密钥，
 * 依次拼接 `salt | iv | ciphertext` 并以 base64 编码、加 v2 版本前缀。
 *
 * @param plaintext 待加密明文
 * @returns 带 `tjg:v2:` 前缀的密文
 * @throws 加密过程中任一步失败即抛错（fail-closed，绝不回退为明文写入）
 */
export async function encryptForSession(plaintext: string): Promise<string> {
  const secret = getOrCreateInstallSecret()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKeyFromSecret(secret, salt)
  const encrypted = await requireSubtleCrypto().encrypt(
    { name: ALGORITHM, iv },
    key,
    new TextEncoder().encode(plaintext)
  )

  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(encrypted), salt.length + iv.length)
  return CIPHERTEXT_VERSION_PREFIX + bytesToBase64(combined)
}

/**
 * 解密会话级敏感值。
 *
 * 以 {@link CIPHERTEXT_VERSION_PREFIX} 分流：v2 走带盐派生路径，
 * 无前缀的旧值走 {@link decryptLegacyV1} 只读迁移。
 *
 * @param ciphertext 待解密密文（v2 带前缀或 v1 裸 base64）
 * @returns 明文
 * @throws 密文被篡改、格式非法或密钥不匹配时抛错（fail-closed，绝不返回原密文）
 */
export async function decryptFromSession(ciphertext: string): Promise<string> {
  if (!ciphertext.startsWith(CIPHERTEXT_VERSION_PREFIX)) {
    return decryptLegacyV1(ciphertext)
  }

  const combined = base64ToBytes(ciphertext.slice(CIPHERTEXT_VERSION_PREFIX.length))
  if (combined.length <= SALT_BYTES + IV_BYTES) {
    throw new Error('会话密文长度非法，无法解密')
  }

  const salt = combined.slice(0, SALT_BYTES)
  const iv = combined.slice(SALT_BYTES, SALT_BYTES + IV_BYTES)
  const data = combined.slice(SALT_BYTES + IV_BYTES)
  const secret = getOrCreateInstallSecret()
  const key = await deriveKeyFromSecret(secret, salt)
  const decrypted = await requireSubtleCrypto().decrypt({ name: ALGORITHM, iv }, key, data)
  return new TextDecoder().decode(decrypted)
}
