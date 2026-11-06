import {
  createSecretChatVerifier,
  isSecretChatKdfVerifier,
  verifySecretChatVerifier,
  zeroize
} from '@/services/matrix/privateChat/secretChatCrypto'
import { lockSecretChatSession, unlockSecretChatSession } from './secretChatSession'
import { verifyPasswordHash } from './settings-helpers'

/**
 * 私密聊天设置动作的**纯函数实现**。
 *
 * 从 `setting.ts` 抽出（该文件已超 600 行）：pinia action 只做单行转发，
 * 这样体积护栏不受新逻辑影响，而 secretChat 这一子域的逻辑也能集中在一处阅读。
 */

/** action 复用的最小 store 形状（避免与 pinia 定义循环依赖）。 */
interface SecretChatStoreLike {
  secretChat: {
    enabled: boolean
    passwordHash: string
    hideSessions: boolean
    autoLock: boolean
    lockTimeout: number
  }
  ensureSecretChatSettings(): void
  isSecretChatConfigured(): boolean
}

/** 校验口令，并在旧格式（`sha256:` / DJB2）验证通过时返回可升级的 PBKDF2 verifier。 */
async function verifyCredential(
  password: string,
  stored: string
): Promise<{ valid: boolean; dbKey: Uint8Array | null; upgradedVerifier: string | null }> {
  if (isSecretChatKdfVerifier(stored)) {
    const result = await verifySecretChatVerifier(password, stored)
    return { valid: result.valid, dbKey: result.dbKey, upgradedVerifier: null }
  }
  const legacy = await verifyPasswordHash(password, stored)
  if (!legacy.valid) {
    return { valid: false, dbKey: null, upgradedVerifier: null }
  }
  const { encodedVerifier, dbKey } = await createSecretChatVerifier(password)
  return { valid: true, dbKey, upgradedVerifier: encodedVerifier }
}

/** 内部：校验并顺带升级旧 verifier。 */
async function verifyAndUpgrade(
  store: SecretChatStoreLike,
  password: string
): Promise<{ valid: boolean; dbKey: Uint8Array | null }> {
  store.ensureSecretChatSettings()
  if (!store.secretChat.enabled) {
    return { valid: false, dbKey: null }
  }
  const result = await verifyCredential(password, store.secretChat.passwordHash)
  if (result.upgradedVerifier) {
    store.secretChat.passwordHash = result.upgradedVerifier
  }
  return { valid: result.valid, dbKey: result.dbKey }
}

/**
 * 设置密码：PBKDF2 派生 verifier（落盘）与 dbKey（**当场清零**，解锁时再派生）。
 * 设置完成即「已配置但未解锁」，用户需输一次密码才能进入。
 */
export async function applySecretChatPassword(store: SecretChatStoreLike, password: string): Promise<void> {
  store.ensureSecretChatSettings()
  const { encodedVerifier, dbKey } = await createSecretChatVerifier(password)
  zeroize(dbKey)
  store.secretChat.passwordHash = encodedVerifier
  store.secretChat.enabled = true
  lockSecretChatSession('密码已更新')
}

/** 开启/关闭私密聊天；**开启前必须已设置密码**，否则抛错由 UI 引导设置。 */
export function applySecretChatEnabled(store: SecretChatStoreLike, enabled: boolean): void {
  store.ensureSecretChatSettings()
  if (enabled && !store.isSecretChatConfigured()) {
    throw new Error('SECRET_CHAT_PASSWORD_REQUIRED')
  }
  store.secretChat.enabled = enabled
  if (!enabled) {
    store.secretChat.hideSessions = false
    store.secretChat.autoLock = false
    lockSecretChatSession('功能已关闭')
  }
}

/** 仅校验密码（不改解锁态），用于「修改密码前验证旧密码」。 */
export async function verifySecretChatPasswordOnly(store: SecretChatStoreLike, password: string): Promise<boolean> {
  const result = await verifyAndUpgrade(store, password)
  zeroize(result.dbKey)
  return result.valid
}

/** 校验密码并解锁：成功时把 dbKey 写入内存态解锁会话。 */
export async function unlockSecretChatWithPassword(store: SecretChatStoreLike, password: string): Promise<boolean> {
  const result = await verifyAndUpgrade(store, password)
  if (!result.valid || !result.dbKey) {
    zeroize(result.dbKey)
    return false
  }
  unlockSecretChatSession(result.dbKey)
  return true
}

/** 清除密码并上锁。 */
export function resetSecretChatPassword(store: SecretChatStoreLike): void {
  store.ensureSecretChatSettings()
  store.secretChat.enabled = false
  store.secretChat.passwordHash = ''
  store.secretChat.hideSessions = false
  store.secretChat.autoLock = false
  store.secretChat.lockTimeout = 5
  lockSecretChatSession('密码已清除')
}

/** 设置「隐藏会话」开关。 */
export function applySecretChatHideSessions(store: SecretChatStoreLike, enabled: boolean): void {
  store.ensureSecretChatSettings()
  store.secretChat.hideSessions = enabled
}

/** 设置「自动锁」开关；关闭时把超时复位为默认 5 分钟。 */
export function applySecretChatAutoLock(store: SecretChatStoreLike, enabled: boolean): void {
  store.ensureSecretChatSettings()
  store.secretChat.autoLock = enabled
  if (!enabled) {
    store.secretChat.lockTimeout = 5
  }
}

/** 设置锁定时长（分钟，至少 1）。 */
export function applySecretChatLockTimeout(store: SecretChatStoreLike, minutes: number): void {
  store.ensureSecretChatSettings()
  store.secretChat.lockTimeout = Math.max(1, Math.round(minutes))
}
