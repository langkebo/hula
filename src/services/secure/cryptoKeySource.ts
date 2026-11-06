/**
 * crypto storageKey 的「来源标记」簿记。
 *
 * ## 为什么必须记来源
 *
 * 同一台设备的同一 crypto store 只能被**同一把**密钥打开。密钥来源有两条互斥路径：
 * 安全存储（keychain / 加密文件 fallback）与本地解锁密码派生（仅内存）。
 * 若不记来源，后端可用性一旦跨会话变化（例如 keychain 恢复可用、或反过来失效），
 * 下一次启动就会「按当时的可用性」重新选一条路径，拿到另一把密钥去打开旧 store，
 * 结果是 `An object failed to be decrypted while unpickling` —— 用户丢掉本地会话密钥。
 *
 * 记录后语义变得确定：
 * - `secure`：只读安全存储；缺失/损坏 → fail-closed，不得改用本地密钥；
 * - `local`：只认本地解锁密钥；本次会话未解锁 → fail-closed，不得改读安全存储；
 * - 未记录（首次运行 / 升级前的旧安装）：由调用方按「安全存储优先」决策并回写。
 *
 * 这里只存「来源」这一个枚举值，不含任何密钥材料，泄露它无法解密任何东西。
 */

import { createLogger } from '@/utils/Logger'

const logger = createLogger('CryptoKeySource')

export const CRYPTO_KEY_SOURCE_STORAGE_KEY = 'tjg-crypto-key-source-v1'

/** storageKey 的实际来源 */
export type CryptoKeySource = 'secure' | 'local'

/** 读取来源标记表；解析异常/损坏一律按「无记录」处理（不阻塞启动）。 */
function readKeySourceMap(): Record<string, CryptoKeySource> {
  try {
    const raw = globalThis.localStorage?.getItem(CRYPTO_KEY_SOURCE_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, CryptoKeySource> = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === 'secure' || value === 'local') out[id] = value
    }
    return out
  } catch {
    return {}
  }
}

function writeKeySourceMap(map: Record<string, CryptoKeySource>): void {
  try {
    if (Object.keys(map).length === 0) {
      globalThis.localStorage?.removeItem(CRYPTO_KEY_SOURCE_STORAGE_KEY)
      return
    }
    globalThis.localStorage?.setItem(CRYPTO_KEY_SOURCE_STORAGE_KEY, JSON.stringify(map))
  } catch (err) {
    // 标记写不进去只会退化成"下次仍按可用性猜"，不影响本次密钥正确性
    logger.warn('记录 crypto storageKey 来源失败', err)
  }
}

/** 读取某个 `userId:deviceId` 已记录的来源；无记录返回 null。 */
export function readKeySource(cKey: string): CryptoKeySource | null {
  return readKeySourceMap()[cKey] ?? null
}

/** 记录某个 `userId:deviceId` 的实际来源（只在真正取到密钥后调用）。 */
export function writeKeySource(cKey: string, source: CryptoKeySource): void {
  const map = readKeySourceMap()
  if (map[cKey] === source) return
  map[cKey] = source
  writeKeySourceMap(map)
}

/** 清除某个 `userId:deviceId` 的来源标记（删除密钥时同步调用）。 */
export function clearKeySource(cKey: string): void {
  const map = readKeySourceMap()
  if (!(cKey in map)) return
  delete map[cKey]
  writeKeySourceMap(map)
}
