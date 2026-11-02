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

// ---- 全局信任刷新节拍 --------------------------------------------------------

/** 信任状态刷新间隔（ms）：设备验证状态可能在会话期间变化。 */
const TRUST_REFRESH_TICK_MS = 30_000

/** 全局节拍版本号：每次 tick 递增，订阅方 `watch` 它来触发刷新。 */
export const trustTickVersion = shallowRef(0)

let trustTickSubscribers = 0
let trustTickTimer: ReturnType<typeof setInterval> | null = null

/**
 * 订阅全局信任刷新节拍。
 *
 * 历史实现是「每条加密消息一个 `setInterval`」，聊天页 200 条加密消息就会常驻
 * 200 个 30s 定时器 + 200 份重复的 `/keys/query`。改为全局共享节拍后：
 * 首个订阅者启动定时器，最后一个退订时停止。
 *
 * @returns 取消订阅函数（幂等）
 */
export function subscribeTrustTick(): () => void {
  trustTickSubscribers += 1
  if (!trustTickTimer) {
    trustTickTimer = setInterval(() => {
      trustTickVersion.value += 1
    }, TRUST_REFRESH_TICK_MS)
    // Node 测试环境不应被该定时器阻止退出（浏览器无 unref，故可选调用）
    ;(trustTickTimer as { unref?: () => void }).unref?.()
  }

  let active = true
  return () => {
    if (!active) return
    active = false
    trustTickSubscribers -= 1
    if (trustTickSubscribers > 0) return
    if (trustTickTimer) {
      clearInterval(trustTickTimer)
      trustTickTimer = null
    }
    trustTickSubscribers = 0
  }
}
