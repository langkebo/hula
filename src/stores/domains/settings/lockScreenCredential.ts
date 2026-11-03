/**
 * 锁屏密码凭据：只在本地持久化 PBKDF2 派生结果，绝不落盘明文密码。
 * 复用 secretChat 的 verifier 编解码，并以 `lock-screen:` 前缀隔离命名空间，
 * 避免锁屏凭据被误用为私聊加密口令。
 */
import {
  createSecretChatVerifier,
  verifySecretChatVerifier,
  zeroize
} from '@/services/matrix/privateChat/secretChatCrypto'

const LOCK_SCREEN_PREFIX = 'lock-screen:'

/** 生成可直接持久化的锁屏凭据；派生出的 dbKey 当场清零，不参与任何存储。 */
export async function createLockScreenVerifier(password: string): Promise<string> {
  const { encodedVerifier, dbKey } = await createSecretChatVerifier(password)
  zeroize(dbKey)
  return `${LOCK_SCREEN_PREFIX}${encodedVerifier}`
}

/** 校验锁屏密码；凭据缺失、前缀不符或载荷损坏一律返回 false，不抛异常。 */
export async function verifyLockScreenVerifier(password: string, encoded: string): Promise<boolean> {
  if (!encoded.startsWith(LOCK_SCREEN_PREFIX)) return false
  const payload = encoded.slice(LOCK_SCREEN_PREFIX.length)
  if (!payload) return false
  const { valid, dbKey } = await verifySecretChatVerifier(password, payload)
  zeroize(dbKey)
  return valid
}
