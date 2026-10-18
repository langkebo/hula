import { createLogger } from '@/utils/Logger'
import { requireSubtleCrypto } from '@/utils/webCompat'

const logger = createLogger('LocalUnlockKey')

/**
 * 本地解锁密码（F-4 / B2）—— 安全存储不可用时的**唯一**加密来源。
 *
 * ## 为什么需要它
 *
 * `getOrCreateCryptoStorageKey()` 拿不到安全存储时只能返回 `null`，而 SDK 对
 * 「未加密的 IndexedDB store」是**静默允许**的 —— 结果是设备私钥与房间密钥明文落盘。
 * B2 的做法：让用户设一个本地解锁密码，PBKDF2 派生 **32 字节** storageKey，
 * store 因此仍然加密。
 *
 * ## 为什么不复用 `secretChatCrypto`
 *
 * 直觉上应该复用（同一套 PBKDF2 范式），但它的派生产物是 **32 字节切成
 * verifier(16) + dbKey(16)** —— `initRustCrypto({ storageKey })` 要求 **32 字节**，
 * 直接借用会拿到一把 16 字节的密钥，直到运行时才在 SDK 里报错。
 *
 * 因此这里独立派生 **64 字节**：前 32B 作 verifier（落盘），后 32B 作 storageKey（仅内存）。
 * 两者来自同一次 PBKDF2 的不同区段，知道 verifier **不能**推出 storageKey。
 *
 * ## 与私密聊天密码刻意隔离
 *
 * 盐不同、存储键不同、编码前缀不同。否则「改私密聊天密码」会连带换掉 crypto store
 * 的密钥，旧库再也打不开。
 */

/**
 * verifier 的持久化位（localStorage）。
 *
 * 这里**只**放 verifier，绝不放 storageKey —— 后者一旦落盘，加密就失去意义。
 * 名称含 `STORAGE_KEY` 以被 `scripts/check-settings-wiring.mjs` 纳管为持久化 key。
 */
export const LOCAL_UNLOCK_VERIFIER_STORAGE_KEY = 'tjg-local-unlock-verifier-v1'

/** PBKDF2 迭代次数（与私密聊天同量级：OWASP 2023 对 SHA-256 的推荐） */
export const LOCAL_UNLOCK_PBKDF2_ITERATIONS = 600_000
/** 派生产物总长：32B verifier + 32B storageKey */
const DERIVED_BYTES = 64
/** verifier 长度（落盘部分） */
const VERIFIER_BYTES = 32
/** storageKey 长度（必须 32B —— initRustCrypto 的硬约束） */
const STORAGE_KEY_BYTES = 32
/** 盐长度 */
const SALT_BYTES = 16
/** 编码前缀：与私密聊天的 `pbkdf2-sha256` 明确区分，避免互相误解析 */
const ENCODING_PREFIX = 'pbkdf2-sha256-64'

/** 内存中的 storageKey（解锁后存在，锁定即清除） */
let localUnlockStorageKey: Uint8Array | null = null

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

/** 定长比较：避免按字节短路泄漏信息 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const subtle = requireSubtleCrypto()
  const material = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: LOCAL_UNLOCK_PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    material,
    DERIVED_BYTES * 8
  )
  return new Uint8Array(bits)
}

function generateSalt(): Uint8Array<ArrayBuffer> {
  const salt = new Uint8Array(SALT_BYTES)
  globalThis.crypto.getRandomValues(salt)
  return salt
}

function encodeVerifier(salt: Uint8Array, verifier: Uint8Array): string {
  return `${ENCODING_PREFIX}$${LOCAL_UNLOCK_PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(verifier)}`
}

function decodeVerifier(encoded: string): { salt: Uint8Array<ArrayBuffer>; verifier: Uint8Array } | null {
  const parts = encoded.split('$')
  if (parts.length !== 4 || parts[0] !== ENCODING_PREFIX) return null
  const salt = fromBase64(parts[2])
  const verifier = fromBase64(parts[3])
  if (salt.length !== SALT_BYTES || verifier.length !== VERIFIER_BYTES) return null
  return { salt, verifier }
}

function readVerifier(): string | null {
  try {
    const raw = globalThis.localStorage?.getItem(LOCAL_UNLOCK_VERIFIER_STORAGE_KEY)
    return raw && raw.length > 0 ? raw : null
  } catch {
    return null
  }
}

function writeVerifier(value: string | null): void {
  try {
    if (value === null) {
      globalThis.localStorage?.removeItem(LOCAL_UNLOCK_VERIFIER_STORAGE_KEY)
    } else {
      globalThis.localStorage?.setItem(LOCAL_UNLOCK_VERIFIER_STORAGE_KEY, value)
    }
  } catch (err) {
    logger.warn('写入本地解锁 verifier 失败', err)
  }
}

function zeroize(bytes: Uint8Array | null): void {
  bytes?.fill(0)
}

function setStorageKey(key: Uint8Array): void {
  zeroize(localUnlockStorageKey)
  localUnlockStorageKey = new Uint8Array(key.slice(0, STORAGE_KEY_BYTES))
}

/** 是否已设置本地解锁密码 */
export function isLocalUnlockConfigured(): boolean {
  return readVerifier() !== null
}

/**
 * 取当前会话已解锁的 storageKey。
 *
 * 返回**副本**：调用方持引用后即使我们锁定时清零，它也不会误以为密钥仍有效。
 */
export function getLocalUnlockStorageKey(): Uint8Array | null {
  return localUnlockStorageKey ? new Uint8Array(localUnlockStorageKey) : null
}

/** 是否已解锁（仅内存态，冷启动必为 false） */
export function isLocalUnlockUnlocked(): boolean {
  return localUnlockStorageKey !== null
}

/**
 * 设置（或重置）本地解锁密码，成功后**当场解锁**（用户刚输过，再要一次没有意义）。
 *
 * ⚠️ 重置密码会让旧的 crypto store 再也打不开（storageKey 变了）。
 * 调用方必须先处理旧 store，否则用户会看到一堆解不开的历史消息。
 * 本函数只负责密码，不负责 store 清理。
 */
export async function configureLocalUnlock(password: string): Promise<void> {
  const salt = generateSalt()
  const derived = await derive(password, salt)
  const verifier = derived.slice(0, VERIFIER_BYTES)
  const storageKey = derived.slice(VERIFIER_BYTES, VERIFIER_BYTES + STORAGE_KEY_BYTES)

  writeVerifier(encodeVerifier(salt, verifier))
  setStorageKey(storageKey)
  zeroize(derived)
  logger.info('本地解锁密码已设置，crypto storageKey 已就绪（仅内存）')
}

/**
 * 用密码解锁，成功后把 storageKey 放进内存。
 *
 * @returns 密码是否正确
 */
export async function unlockLocalUnlock(password: string): Promise<boolean> {
  const encoded = readVerifier()
  if (!encoded) return false

  const parsed = decodeVerifier(encoded)
  if (!parsed) {
    logger.error('本地解锁 verifier 损坏，无法解锁（需要重新设置密码）')
    return false
  }

  const derived = await derive(password, parsed.salt)
  const valid = timingSafeEqual(derived.slice(0, VERIFIER_BYTES), parsed.verifier)

  if (!valid) {
    zeroize(derived)
    logger.warn('本地解锁密码校验失败')
    return false
  }

  setStorageKey(derived.slice(VERIFIER_BYTES, VERIFIER_BYTES + STORAGE_KEY_BYTES))
  zeroize(derived)
  return true
}

/** 锁定：清除内存中的 storageKey（verifier 保留，下次仍可解锁） */
export function lockLocalUnlock(): void {
  zeroize(localUnlockStorageKey)
  localUnlockStorageKey = null
}

/**
 * 彻底清除本地解锁配置（用户主动「忘记密码」/ 注销）。
 *
 * ⚠️ 清除后旧 store 将永久打不开 —— 调用方应同时清理 crypto store，
 * 否则下次初始化会一直失败。
 */
export function clearLocalUnlock(): void {
  lockLocalUnlock()
  writeVerifier(null)
  logger.info('本地解锁配置已清除')
}
