/**
 * Crypto localStorage 判据读写（从 `MatrixCryptoStateTracker` 抽出，Batch 4.2）。
 *
 * 这里存的是「上一次登录的 crypto 身份」与「上一次的加密原语」两个标记，
 * 用来判断本次启动是否需要**主动清理旧 store**（换账号/换设备/原语升级）。
 *
 * 抽出的原因：这是一组无状态的 KV 读写，与 crypto 状态机无关；且 key 名是跨会话契约
 * （测试直接按 localStorage key 断言），集中在一处更不易漂移。
 *
 * 不依赖 `matrix-js-sdk`，故不受 `check:sdk-boundary` 约束。
 */

/** 上一次登录使用的 userId（`@user:server`）。 */
export const LAST_CRYPTO_USER_KEY = 'tjg.lastCryptoUserId'

/**
 * 上一次「加密状态 + 加密原语」标记。
 *
 * 取值：`'k1'` = storageKey（32 字节）；`'p1'` / `'1'` = 历史 storagePassword；
 * `'0'` = 无密钥（store 未加密）；`null` = 首次运行。
 */
export const LAST_CRYPTO_ENCRYPTED_KEY = 'tjg.lastCryptoEncrypted'

/** 读取 localStorage 中的 lastCryptoUserId 记录。 */
export function readLastCryptoUser(): string | null {
  if (typeof globalThis.localStorage === 'undefined') return null
  return globalThis.localStorage.getItem(LAST_CRYPTO_USER_KEY)
}

/** 写入 localStorage 中的 lastCryptoUserId 记录。 */
export function writeLastCryptoUser(value: string): void {
  if (typeof globalThis.localStorage === 'undefined') return
  globalThis.localStorage.setItem(LAST_CRYPTO_USER_KEY, value)
}

/**
 * 读取上次的「加密状态 + 加密原语」标记。
 *
 * @returns `'k1'` = storageKey（32 字节）；`'p1'` / `'1'` = 历史 storagePassword；
 *   `'0'` = 无密钥（store 未加密）；`null` = 首次运行
 */
export function readLastCryptoEncrypted(): string | null {
  if (typeof globalThis.localStorage === 'undefined') return null
  return globalThis.localStorage.getItem(LAST_CRYPTO_ENCRYPTED_KEY)
}

/** 写入「加密状态 + 加密原语」标记（取值见 {@link readLastCryptoEncrypted}）。 */
export function writeLastCryptoEncrypted(value: string): void {
  if (typeof globalThis.localStorage === 'undefined') return
  globalThis.localStorage.setItem(LAST_CRYPTO_ENCRYPTED_KEY, value)
}

/** 清除 localStorage 中的 lastCryptoUserId 与加密状态记录。 */
export function clearLastCryptoUser(): void {
  if (typeof globalThis.localStorage === 'undefined') return
  globalThis.localStorage.removeItem(LAST_CRYPTO_USER_KEY)
  globalThis.localStorage.removeItem(LAST_CRYPTO_ENCRYPTED_KEY)
}
