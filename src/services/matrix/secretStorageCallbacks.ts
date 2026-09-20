import type { CryptoCallbacks } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { getSecretStorageKey, storeSecretStorageKey } from './secretStorageKeyVault'

const logger = createLogger('SecretStorageCallbacks')

/**
 * 构造 SDK 的 SSSS 加解密回调。
 *
 * 安全约定：
 * - 私钥只经 {@link ./secretStorageKeyVault} 驻留内存，**不写任何持久化存储**。
 *   历史缺陷把原始私钥 base64 写进 sessionStorage，登出不清除且可被同源脚本读取。
 * - 未载入密钥时返回 `null`，让 SDK 走"密钥不可用"分支，而不是静默用错密钥。
 *
 * @returns 可直接传给 `createClient({ cryptoCallbacks })` 的回调对象
 */
export function createSecretStorageCryptoCallbacks(): CryptoCallbacks {
  return {
    getSecretStorageKey: async (opts) => {
      const found = getSecretStorageKey(opts.keys)
      if (found) {
        logger.debug(`命中内存保险箱中的 SSSS 私钥: keyId=${found[0]}`)
      }
      return found
    },
    cacheSecretStorageKey: (keyId: string, _keyInfo: unknown, key: Uint8Array) => {
      // SDK 在校验通过后回调，此处缓存到内存（绝不落盘）
      storeSecretStorageKey(keyId, key)
    }
  }
}
