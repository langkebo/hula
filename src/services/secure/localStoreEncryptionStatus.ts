import type { SecureStorageBackendInfo } from './secureStorage'

/**
 * 本地密钥库（crypto store）的加密状态（F-4）。
 *
 * 三档不是两档 —— 这是本模块存在的唯一理由：
 * 历史实现把「原生密钥库不可用」直接等同「明文落盘」，于是 Linux 无 Secret Service
 * 的机器会被误报为「私钥明文」。事实是中间还有一档 `encrypted_file_fallback`：
 * secret 仍受 master-key 加密的文件保护，只是保护强度低于 OS 密钥库。
 *
 * - `encrypted-native`   ：OS 原生密钥库可用，crypto store 加密
 * - `encrypted-degraded` ：原生不可用、但加密文件 fallback 生效，crypto store **仍加密**
 * - `plaintext`          ：安全存储完全不可用，私钥与房间密钥**明文落盘**
 * - `unknown`            ：crypto 尚未尝试初始化（未登录 / 未就绪），不下判断
 */
export type LocalStoreEncryptionLevel = 'encrypted-native' | 'encrypted-degraded' | 'plaintext' | 'unknown'

/**
 * 由「crypto store 是否加密」与「安全存储后端事实」推导展示用等级。
 *
 * 判定顺序刻意如此：
 * 1. `storeEncrypted === null` → 未尝试，`unknown`（不能猜）；
 * 2. `storeEncrypted === false` → 一定是明文（后端可用却拿不到 key ⇒ 写失败也会落这里），
 *    此时即便 `info.degraded` 为真也必须报 `plaintext` —— **以实测为准，不以配置为准**；
 * 3. `storeEncrypted === true` 且后端 degraded → `encrypted-degraded`；
 * 4. 其余 `encrypted-native`。
 */
export function deriveLocalStoreEncryptionLevel(
  storeEncrypted: boolean | null,
  info: SecureStorageBackendInfo | null
): LocalStoreEncryptionLevel {
  if (storeEncrypted === null) return 'unknown'
  if (storeEncrypted === false) return 'plaintext'
  if (info?.degraded === true) return 'encrypted-degraded'
  return 'encrypted-native'
}

/** 该等级是否属于「有风险、需要让用户知道」的档位 */
export function isLocalStoreEncryptionConcerning(level: LocalStoreEncryptionLevel): boolean {
  return level === 'plaintext'
}
