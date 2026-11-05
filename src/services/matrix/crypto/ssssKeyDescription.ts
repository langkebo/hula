import { createLogger } from '@/utils/Logger'
import { requireSubtleCrypto } from '@/utils/webCompat'

const logger = createLogger('SsssKeyDescription')

/** 规范算法名（Matrix Client-Server API, m.secret_storage.v1.aes-hmac-sha2） */
export const SSSS_ALGORITHM = 'm.secret_storage.v1.aes-hmac-sha2'

/** 默认密钥名，作为 HKDF 的 info 参与派生，必须与解密方一致 */
export const DEFAULT_SSSS_KEY_NAME = 'TJG Security Key'

/** 可写入 `m.secret_storage.key.<keyId>` 的密钥描述 */
export interface SsssKeyDescription {
  algorithm: string
  name: string
  iv: string
  mac: string
  passphrase?: {
    algorithm: string
    iterations: number
    salt: string
    bits?: number
  }
}

export interface BuildSsssKeyDescriptionOptions {
  /** 人类可读名称；同时作为 HKDF info（规范要求解密方使用同一值） */
  name?: string
  /** 口令派生信息（若密钥来自口令） */
  passphrase?: SsssKeyDescription['passphrase']
}

/**
 * 按规范从原始私钥计算 SSSS 密钥描述。
 *
 * 规范步骤（client-server API #msecret_storagev1aes-hmac-sha2 步骤 1-4）：
 *  1. HKDF-SHA256(key, salt = 8 字节 0, info = name) → 64 字节；
 *     前 32 字节为 AES-CTR key，后 32 字节为 HMAC key。
 *  2. 生成 16 字节随机 IV，并把 bit 63 清零（避免 64 位计数器边界，兼容 Android）。
 *  3. `mac = HMAC-SHA256(AES-CTR-encrypt(32 个 0 字节, iv))`。
 *
 * 重要：**不要**从 `GeneratedSecretStorageKey.keyInfo` 读取 algorithm/iv/mac——
 * vendored SDK 的该字段只有 `{ passphrase?, name? }`（见 crypto-api/index.d.ts
 * 的 GeneratedSecretStorageKey）。历史上正因为读了这三个不存在的字段，
 * 本函数必然抛错，导致 SSSS 密钥从未真正上传到服务端。
 *
 * @param privateKey 32 字节 SSSS 私钥
 * @param options 名称与口令信息
 * @returns 可直接写入 account data 的密钥描述
 */
export async function buildSsssKeyDescription(
  privateKey: Uint8Array<ArrayBuffer>,
  options: BuildSsssKeyDescriptionOptions = {}
): Promise<SsssKeyDescription> {
  const name = options.name ?? DEFAULT_SSSS_KEY_NAME

  if (!privateKey || privateKey.length === 0) {
    throw new Error('无法构造 SSSS 密钥描述：私钥为空')
  }

  // 1. HKDF 派生 AES / HMAC key
  const subtle = requireSubtleCrypto()
  const hkdfKey = await subtle.importKey('raw', privateKey, { name: 'HKDF' }, false, ['deriveBits'])
  const bits = await subtle.deriveBits(
    { name: 'HKDF', salt: new Uint8Array(8), info: new TextEncoder().encode(name), hash: 'SHA-256' },
    hkdfKey,
    512
  )
  const aesKey = await subtle.importKey('raw', bits.slice(0, 32), { name: 'AES-CTR' }, false, ['encrypt'])
  const hmacKey = await subtle.importKey('raw', bits.slice(32), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])

  // 2. 16 字节 IV，bit 63 清零
  const iv = crypto.getRandomValues(new Uint8Array(16))
  iv[8] &= 0x7f

  // 3. mac = HMAC(AES-CTR(32 个 0 字节, iv))
  const ciphertext = await subtle.encrypt({ name: 'AES-CTR', counter: iv, length: 64 }, aesKey, new Uint8Array(32))
  const mac = await subtle.sign({ name: 'HMAC' }, hmacKey, ciphertext)

  logger.info(`已按规范计算 SSSS 密钥描述: name=${name}`)

  const description: SsssKeyDescription = {
    algorithm: SSSS_ALGORITHM,
    name,
    iv: btoa(String.fromCharCode(...iv)),
    mac: btoa(String.fromCharCode(...new Uint8Array(mac)))
  }
  if (options.passphrase) {
    description.passphrase = options.passphrase
  }
  return description
}

/* ── 密钥备份导入校验（同属密钥备份域工具，与 SSSS 描述共用此文件以免服务层文件数增长） ── */

/** 从备份对象中取出 room keys 数组。
 *
 * @param keys 备份对象（数组或含 room_keys 的对象）
 * @returns room keys 数组
 * @throws 当 room_keys 不是数组时抛出可读错误
 */
export function extractRoomKeys(keys: unknown): Array<Record<string, unknown>> {
  const roomKeys =
    typeof keys === 'object' && keys !== null && 'room_keys' in keys ? (keys as { room_keys: unknown }).room_keys : keys
  if (!Array.isArray(roomKeys)) {
    throw new Error('[KeyBackup] 导入数据格式无效：room_keys 必须为数组')
  }
  return roomKeys as Array<Record<string, unknown>>
}

/** 解析 JSON 备份文件并取出 room keys 数组。
 *
 * @param data 备份文件原始文本
 * @returns room keys 数组
 * @throws 当文本不是合法 JSON 或 room_keys 不是数组时抛出可读错误
 */
export function parseRoomKeysExport(data: string): Array<Record<string, unknown>> {
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`[KeyBackup] 备份文件不是合法 JSON: ${reason}`)
  }
  return extractRoomKeys(parsed)
}
