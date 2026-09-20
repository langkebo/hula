import { decodeRecoveryKey } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SecretStorageKeyVault')

/**
 * SSSS（Secure Secret Storage）私钥的内存保险箱。
 *
 * 安全约定（必须遵守）：
 * - 密钥**只**保存在模块内存中，绝不写入 sessionStorage / localStorage / Pinia / 日志。
 *   历史缺陷是把原始私钥 base64 后写进 `sessionStorage['ssss_<keyId>']`——那是持久化存储，
 *   同源脚本可读、跨刷新存活、登出不清除，等价于把恢复密钥交给任何一次 XSS。
 * - 登出必须调用 {@link clearSecretStorageKeys}。
 * - 本模块只做"持有与取用"，不负责 UI；密钥来源是用户显式输入的恢复密钥。
 */

/** keyId → 原始私钥字节 */
const keys = new Map<string, Uint8Array<ArrayBuffer>>()

/**
 * 从用户输入的恢复密钥解析并存入内存保险箱。
 *
 * 恢复密钥格式为 base58（含前缀与校验字节），由 SDK 的 `decodeRecoveryKey` 校验；
 * 格式非法时抛错且不写入任何内容。
 *
 * @param recoveryKey 用户输入的恢复密钥（允许含空格）
 * @param availableKeys account data 中可用的 SSSS keyId 映射（来自 SDK 的 `opts.keys`）
 * @returns 实际写入的 keyId
 * @throws 恢复密钥格式非法，或没有可用的 keyId
 */
export function setSecretStorageKeyFromRecoveryKey(
  recoveryKey: string,
  availableKeys: Record<string, unknown>
): string {
  const decoded = decodeRecoveryKey(recoveryKey)

  const keyIds = Object.keys(availableKeys ?? {})
  if (keyIds.length === 0) {
    throw new Error('无法确定要解密的 SSSS 密钥 ID：账号未配置安全备份密钥')
  }

  // 多个 keyId 时取稳定顺序的第一个（调用方可按需扩展为显式指定）
  const keyId = keyIds[0]
  keys.set(keyId, decoded)
  logger.info(`已载入 SSSS 私钥到内存保险箱: keyId=${keyId}`)
  return keyId
}

/**
 * 直接存入已校验的 SSSS 私钥。
 *
 * 供 SDK 的 `cacheSecretStorageKey` 回调使用（SDK 已校验该密钥可用）。
 *
 * @param keyId SSSS 密钥 ID
 * @param key 原始私钥字节
 */
export function storeSecretStorageKey(keyId: string, key: Uint8Array): void {
  if (!keyId || key.length === 0) {
    throw new Error('无法缓存 SSSS 私钥：keyId 或密钥内容为空')
  }
  // 复制一份：既不保留 SDK 持有的内存引用，也把 ArrayBufferLike 收窄为 ArrayBuffer
  keys.set(keyId, Uint8Array.from(key))
  logger.info(`已缓存 SSSS 私钥到内存保险箱: keyId=${keyId}`)
}

/**
 * 取出可用于解密指定 SSSS 密钥集的私钥。
 *
 * 与 SDK `CryptoCallbacks.getSecretStorageKey` 的契约一致：
 * 命中返回 `[keyId, key]`，未命中返回 `null`。
 *
 * @param availableKeys SDK 传入的待解密密钥集
 */
export function getSecretStorageKey(availableKeys: Record<string, unknown>): [string, Uint8Array<ArrayBuffer>] | null {
  for (const keyId of Object.keys(availableKeys ?? {})) {
    const key = keys.get(keyId)
    if (key) {
      return [keyId, key]
    }
  }
  return null
}

/**
 * 判断保险箱中是否有可匹配指定密钥集的私钥。
 *
 * @param availableKeys SDK 传入的待解密密钥集
 */
export function hasSecretStorageKey(availableKeys: Record<string, unknown>): boolean {
  return getSecretStorageKey(availableKeys) !== null
}

/**
 * 清空内存保险箱。登出、切换账号、恢复流程结束后调用。
 */
export function clearSecretStorageKeys(): void {
  if (keys.size > 0) {
    logger.info(`清空 SSSS 私钥内存保险箱（${keys.size} 个 keyId）`)
  }
  keys.clear()
}
