import type { GeneratedSecretStorageKey } from '@/types/matrix-extensions'

/** 可直接写入 account data 的 SSSS 密钥条目 */
export interface SsssAccountData {
  /** `m.secret_storage.key.<keyId>` 的内容 */
  keyDescription: GeneratedSecretStorageKey['keyInfo']
  /** 展示给用户的恢复密钥（编码后），不是私钥本身 */
  encodedPrivateKey: string
}

/**
 * 由 SDK 生成的恢复密钥构造 account data。
 *
 * 关键点：**algorithm / iv / mac 必须原样采用 SDK 的 `keyInfo`**。
 * SDK 的 `createRecoveryKeyFromPassphrase` 内部走 `calculateKeyCheck`，
 * 已按规范（`m.secret_storage.v1.aes-hmac-sha2`、16 字节 IV、MAC 覆盖
 * encrypted(32 个 0 字节) 与 IV）算好。任何手写重算都会造成规范漂移，
 * 使 `addKey`/`checkKey` 抛 `Unknown algorithm`，密钥无法被校验。
 *
 * @param generatedKey SDK 生成的恢复密钥对象
 * @returns 写入 account data 所需的数据
 */
export function buildSsssAccountData(generatedKey: GeneratedSecretStorageKey): SsssAccountData {
  if (!generatedKey?.keyInfo?.algorithm || !generatedKey.keyInfo.iv || !generatedKey.keyInfo.mac) {
    throw new Error('SSSS 密钥描述不完整：SDK 未返回 algorithm/iv/mac，拒绝写入 account data')
  }

  return {
    keyDescription: generatedKey.keyInfo,
    encodedPrivateKey: generatedKey.encodedPrivateKey
  }
}
