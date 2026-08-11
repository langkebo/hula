import { deleteSecureSecret, getSecureSecret, setSecureSecret } from '@/services/secure/secureStorage'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('CryptoStorageKey')

const STORAGE_PASSWORD_KEY_PREFIX = 'tjg-crypto-storage-password'

function buildKey(userId: string, deviceId: string): string {
  return `${STORAGE_PASSWORD_KEY_PREFIX}:${userId}:${deviceId}`
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
 * - 首次调用时生成随机密码并存入 keychain
 * - 后续调用从 keychain 读取同一密码（保证同一用户+设备 crypto store 可解密）
 * - keychain 不可用时返回 null（SDK 降级为不加密，适用于 dev/浏览器环境）
 *
 * @param userId Matrix 用户 ID
 * @param deviceId Matrix 设备 ID
 * @returns storagePassword 字符串，或 null（keychain 不可用）
 */
export async function getOrCreateCryptoStoragePassword(userId: string, deviceId: string): Promise<string | null> {
  const key = buildKey(userId, deviceId)

  try {
    const existing = await getSecureSecret(key)
    if (existing) {
      logger.debug(`从 keychain 读取 crypto storage password: ${userId}/${deviceId}`)
      return existing
    }

    const password = generateRandomPassword()
    const success = await setSecureSecret(key, password)
    if (!success) {
      logger.warn(`无法将 crypto storage password 写入 keychain，crypto store 将不加密: ${userId}/${deviceId}`)
      return null
    }

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
  const key = buildKey(userId, deviceId)
  try {
    await deleteSecureSecret(key)
    logger.info(`已删除 crypto storage password: ${userId}/${deviceId}`)
  } catch (err) {
    logger.warn(`删除 crypto storage password 失败: ${userId}/${deviceId}`, err)
  }
}
