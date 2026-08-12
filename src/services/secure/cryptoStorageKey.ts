import { deleteSecureSecret, getSecureSecret, setSecureSecret } from '@/services/secure/secureStorage'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('CryptoStorageKey')

const STORAGE_PASSWORD_KEY_PREFIX = 'tjg-crypto-storage-password'

/**
 * 会话内内存缓存：userId:deviceId → password
 *
 * 背景：macOS dev 模式下 keychain 可能不稳定（entry 存后立即读不到），
 * 而 MatrixClient 在启动时会被重建（配置变更），导致 ensureCrypto 被调用多次。
 * 若每次都从 keychain 读取失败后生成新密码，crypto store 会被不同密码加密，
 * 下次启动时解密失败（"An object failed to be decrypted while unpickling"）。
 *
 * 内存缓存保证：同一会话内同一 userId:deviceId 始终返回同一密码，
 * 即使 keychain 暂时不可用。登出时通过 clearCryptoStoragePasswordCache 清除。
 */
const passwordCache = new Map<string, string>()

function buildKey(userId: string, deviceId: string): string {
  return `${STORAGE_PASSWORD_KEY_PREFIX}:${userId}:${deviceId}`
}

function cacheKey(userId: string, deviceId: string): string {
  return `${userId}:${deviceId}`
}

/** 生成 32 字节随机密码，base64 编码为字符串 */
function generateRandomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
}

/**
 * 获取或创建 crypto store 的 storagePassword。
 *
 * ISSUE-08 对接点：从系统 keychain 派生 storagePassword，传给 SDK 的 initRustCrypto，
 * 使 IndexedDB crypto store 和待发事件队列（PendingEventsCipher）加密存储。
 *
 * 一致性原则（关键）：
 *   - storagePassword 必须跨会话稳定，否则下次启动时用新密码无法解密旧 store，
 *     导致 WASM `StoreHandle.open` 失败（错误对象常为 `{}`，非 Error 实例）。
 *   - 因此 keychain 不可用时**不生成随机密码**，而是返回 null 让 SDK 以不加密方式打开
 *     store（storePrefix 存在但 storePassphrase 为 undefined），保持跨会话可读。
 *
 * 行为：
 *   - 首次调用：生成随机密码并存入 keychain（keychain 可用时）
 *   - 后续调用：从 keychain 读取同一密码
 *   - keychain 不可用：返回 null（SDK 降级为不加密 store）
 *   - keychain 可用但写入失败：返回 null（避免随机密码只在内存中、下次丢失）
 *
 * @param userId Matrix 用户 ID
 * @param deviceId Matrix 设备 ID
 * @returns storagePassword 字符串，或 null（keychain 不可用 / 写入失败）
 */
export async function getOrCreateCryptoStoragePassword(userId: string, deviceId: string): Promise<string | null> {
  const cKey = cacheKey(userId, deviceId)

  // 1. 优先从内存缓存读取（避免 MatrixClient 重建时 keychain 暂时读不到导致生成新密码）
  const cached = passwordCache.get(cKey)
  if (cached) {
    logger.debug(`从内存缓存读取 crypto storage password: ${userId}/${deviceId}`)
    return cached
  }

  const key = buildKey(userId, deviceId)

  try {
    // 2. 从 keychain 读取
    const existing = await getSecureSecret(key)
    if (existing) {
      logger.debug(`从 keychain 读取 crypto storage password: ${userId}/${deviceId}`)
      passwordCache.set(cKey, existing)
      return existing
    }

    // 3. keychain 中无记录 → 生成新密码并写入 keychain
    //    若 keychain 不可用或写入失败，返回 null（让 SDK 以不加密方式打开 store），
    //    **不**返回仅在内存中的随机密码——否则下次会话内存丢失后无法解密旧 store。
    const password = generateRandomPassword()
    const success = await setSecureSecret(key, password)
    if (!success) {
      // keychain 不可用或写入失败：不加密 store，避免跨会话密码不一致
      // 注意：返回 null 而非 undefined，因为调用方使用 `storagePassword ?? undefined`
      logger.warn(`keychain 不可用或写入失败，crypto store 将不加密（保持跨会话可读）: ${userId}/${deviceId}`)
      return null
    }

    passwordCache.set(cKey, password)
    logger.info(`生成并存储 crypto storage password: ${userId}/${deviceId}`)
    return password
  } catch (err) {
    logger.error(`获取 crypto storage password 失败: ${userId}/${deviceId}`, err)
    return null
  }
}

/**
 * 删除 keychain 中的 crypto storagePassword。
 *
 * 在用户登出或清除账号数据时调用，避免残留旧密码。
 *
 * @param userId Matrix 用户 ID
 * @param deviceId Matrix 设备 ID
 */
export async function deleteCryptoStoragePassword(userId: string, deviceId: string): Promise<void> {
  const cKey = cacheKey(userId, deviceId)
  passwordCache.delete(cKey)
  const key = buildKey(userId, deviceId)
  try {
    await deleteSecureSecret(key)
    logger.info(`已删除 crypto storage password: ${userId}/${deviceId}`)
  } catch (err) {
    logger.warn(`删除 crypto storage password 失败: ${userId}/${deviceId}`, err)
  }
}

/**
 * 清除所有内存缓存的 crypto storage password。
 *
 * 在用户登出时调用，确保下次登录不会复用旧会话的密码。
 */
export function clearCryptoStoragePasswordCache(): void {
  passwordCache.clear()
}
