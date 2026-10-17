import { shallowRef } from 'vue'

/**
 * 消息信任状态缓存（模块级单例）。
 *
 * 为什么独立成模块而不是放在 composable 里：登出流程（`MatrixClientAuth.logout`）需要清空它，
 * 若 auth 直接 import composable，会形成 `service → composable → matrixClientService → auth` 的循环。
 * 本模块**不依赖任何矩阵服务**，只提供容器与版本号，因此两个方向都能安全引用。
 */

export type MessageTrustLevel = 'verified' | 'unverified' | 'risk' | 'plain'

/**
 * key 必须带账号维度（`` `${accountUserId}:${senderId}` ``，由调用方拼装）。
 *
 * 只用 senderId 时，换账号后同一 MXID 会命中上一账号的判定 ——
 * 上个账号里该好友设备已验证（绿锁），换账号后未经任何验证也显示绿锁，属残留的假安全信号。
 */
export const senderDeviceCache = new Map<string, MessageTrustLevel>()

/** 缓存版本号：Map 本身非响应式，改缓存后递增它来驱动 computed 重算。 */
export const trustCacheVersion = shallowRef(0)

/** 递增版本号（写入/清空缓存后调用）。 */
export function bumpTrustCacheVersion(): void {
  trustCacheVersion.value += 1
}

/**
 * 清空信任缓存。**登出 / 切换账号时必须调用**，否则残留的绿锁会跨账号沿用。
 */
export function clearSenderDeviceCache(): void {
  if (senderDeviceCache.size === 0) return
  senderDeviceCache.clear()
  bumpTrustCacheVersion()
}
