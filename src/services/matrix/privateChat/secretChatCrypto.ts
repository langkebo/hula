/**
 * 私密聊天的密钥派生与校验。
 *
 * 设计要点（对应方案 P0-0-b）：
 * - **密码即密钥**：PBKDF2-SHA256 拉伸后输出 32 字节，切两半——
 *   前 16 字节作 `verifier`（落盘，仅用于校验），后 16 字节作 `dbKey`（**绝不落盘**，
 *   用于加密本地私密消息索引）。
 * - **不使用单次 SHA-256**：原 `hashPasswordWithSHA256` 无盐、无拉伸，只能校验、
 *   无法派生密钥，且易被彩虹表命中。此模块是新格式的唯一实现。
 * - 旧格式（`sha256:` 与 DJB2）仍可校验，由调用方（setting store）在验证通过后升级。
 *
 * 编码格式：`pbkdf2-sha256$<iterations>$<saltBase64>$<verifierBase64>`
 */

/** 迭代次数：OWASP 2023 对 PBKDF2-SHA256 的建议下限为 600000。 */
const PBKDF2_ITERATIONS = 600_000
/** 盐长度（字节）。 */
const SALT_BYTES = 16
/** 派生总长度：verifier 16B + dbKey 16B。 */
const DERIVED_BYTES = 32
/** verifier 长度（字节）。 */
const VERIFIER_BYTES = 16
/** 编码前缀。 */
export const SECRET_CHAT_KDF_PREFIX = 'pbkdf2-sha256'

/** 派生结果：编码后的 verifier（可落盘）与 dbKey（仅内存）。 */
interface SecretChatKeyMaterial {
  /** 可直接持久化的校验串。 */
  encodedVerifier: string
  /** 本地加密密钥，**不得落盘**；用后须 `zeroize`。 */
  dbKey: Uint8Array
}

/** 校验结果。 */
interface SecretChatVerifyResult {
  /** 密码是否正确。 */
  valid: boolean
  /** 正确时返回派生出的 dbKey（仅新格式可派生）。 */
  dbKey: Uint8Array | null
}

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('WebCrypto 不可用，无法派生私密聊天密钥')
  }
  return subtle
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

/** 常量时间比较，避免以响应时间泄漏前缀匹配长度。 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

/** 生成 16 字节随机盐。 */
export function generateSecretChatSalt(): Uint8Array<ArrayBuffer> {
  const salt = new Uint8Array(SALT_BYTES)
  globalThis.crypto?.getRandomValues(salt)
  return salt
}

async function deriveRaw(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const subtle = getSubtle()
  const baseKey = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    DERIVED_BYTES * 8
  )
  return new Uint8Array(bits)
}

/** 判断给定的校验串是否为本模块产出的 PBKDF2 格式。 */
export function isSecretChatKdfVerifier(encoded: string): boolean {
  return encoded.startsWith(`${SECRET_CHAT_KDF_PREFIX}$`)
}

/**
 * 由密码派生 verifier 与 dbKey。
 *
 * 用于「设置密码」：只需保留 `encodedVerifier`，`dbKey` 当场 `zeroize`。
 */
export async function createSecretChatVerifier(
  password: string,
  salt: Uint8Array<ArrayBuffer> = generateSecretChatSalt()
): Promise<SecretChatKeyMaterial> {
  const derived = await deriveRaw(password, salt, PBKDF2_ITERATIONS)
  const verifier = derived.slice(0, VERIFIER_BYTES)
  const dbKey = derived.slice(VERIFIER_BYTES)
  const encodedVerifier = `${SECRET_CHAT_KDF_PREFIX}$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(verifier)}`
  return { encodedVerifier, dbKey }
}

/**
 * 校验密码并派生 dbKey（新格式）。
 *
 * 非本格式（旧 `sha256:` / DJB2）返回 `{ valid: false, dbKey: null }`，
 * 由调用方走旧校验路径并在成功后升级。
 */
export async function verifySecretChatVerifier(
  password: string,
  encodedVerifier: string
): Promise<SecretChatVerifyResult> {
  if (!isSecretChatKdfVerifier(encodedVerifier)) {
    return { valid: false, dbKey: null }
  }
  const parts = encodedVerifier.split('$')
  if (parts.length !== 4) {
    return { valid: false, dbKey: null }
  }
  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return { valid: false, dbKey: null }
  }
  const salt = fromBase64(parts[2])
  const expected = fromBase64(parts[3])
  const derived = await deriveRaw(password, salt, iterations)
  const verifier = derived.slice(0, expected.length)
  const valid = timingSafeEqual(verifier, expected)
  if (!valid) {
    zeroize(derived)
    return { valid: false, dbKey: null }
  }
  const dbKey = derived.slice(VERIFIER_BYTES)
  zeroize(verifier)
  return { valid: true, dbKey }
}

/** 就地清零敏感字节；对 `null`/`undefined` 安全。 */
export function zeroize(bytes: Uint8Array | null | undefined): void {
  bytes?.fill(0)
}
