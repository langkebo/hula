import { requireSubtleCrypto } from '@/utils/webCompat'

/**
 * 搜索索引的加密密钥与字段加解密（F-4 / D3）。
 *
 * ## 为什么要单独派生，而不是直接用 crypto storageKey
 *
 * storageKey 是打开 crypto store 的主密钥。把它复用成「搜索索引的 AES key」
 * 属于跨用途密钥重用 —— 一旦某处把搜索结果或日志泄露，被泄露的就直接是主密钥。
 * 这里用 HKDF-SHA256 派生子密钥（`info` 区分用途），主密钥永不出现在密文上下文里。
 *
 * ## 存储布局
 *
 * `eventId` / `roomId` 保持明文：它们是 IndexedDB 的 keyPath 与索引键，
 * 必须能被查询和按房间删除；敏感内容（正文、发送者、时间戳）整包加密。
 */

/** HKDF 的用途分隔串（改动它等于换密钥，旧索引全部作废） */
export const SEARCH_INDEX_KEY_INFO = 'tjg-search-index-v1'

const AES_KEY_BITS = 256
const IV_BYTES = 12

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(encoded: string): Uint8Array<ArrayBuffer> {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * 由 crypto storageKey 派生搜索索引专用密钥（32 字节）。
 *
 * @param storageKey 32 字节主密钥（crypto store 用的那把）
 */
export async function deriveSearchIndexKey(storageKey: Uint8Array): Promise<Uint8Array> {
  const subtle = requireSubtleCrypto()
  const material = await subtle.importKey('raw', storageKey as unknown as BufferSource, 'HKDF', false, ['deriveBits'])
  const bits = await subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(SEARCH_INDEX_KEY_INFO)
    },
    material,
    AES_KEY_BITS
  )
  return new Uint8Array(bits)
}

async function importAesKey(key: Uint8Array): Promise<CryptoKey> {
  const subtle = requireSubtleCrypto()
  return subtle.importKey('raw', key as unknown as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

/**
 * 加密一段明文，返回 `v1:<base64(iv|ciphertext)>`。
 *
 * 前缀用于将来换算法时区分；没有前缀的旧记录一律视为明文遗留。
 */
export async function encryptIndexField(plain: string, key: Uint8Array): Promise<string> {
  const subtle = requireSubtleCrypto()
  const iv = new Uint8Array(IV_BYTES)
  globalThis.crypto.getRandomValues(iv)
  const cipher = await subtle.encrypt({ name: 'AES-GCM', iv }, await importAesKey(key), new TextEncoder().encode(plain))

  const cipherBytes = new Uint8Array(cipher)
  const merged = new Uint8Array(iv.length + cipherBytes.length)
  merged.set(iv, 0)
  merged.set(cipherBytes, iv.length)
  return `v1:${toBase64(merged)}`
}

/**
 * 解密 `v1:` 记录。
 *
 * 解密失败返回 `null`（不抛）：索引是派生数据，单条坏记录不应该让整个搜索挂掉。
 * 调用方负责丢弃该条并在下次重建时补回。
 */
export async function decryptIndexField(payload: string, key: Uint8Array): Promise<string | null> {
  if (!payload.startsWith('v1:')) return null
  try {
    const subtle = requireSubtleCrypto()
    const merged = fromBase64(payload.slice(3))
    const iv = merged.slice(0, IV_BYTES)
    const cipher = merged.slice(IV_BYTES)
    const plain = await subtle.decrypt({ name: 'AES-GCM', iv }, await importAesKey(key), cipher)
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}
