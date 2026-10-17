import { type ComputedRef, computed, ref, shallowRef } from 'vue'
import { zeroize } from '@/services/matrix/privateChat/secretChatCrypto'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SecretChatSession')

/**
 * 私密聊天解锁态（模块级单例，**刻意不用 pinia**）。
 *
 * 为什么不用 store：
 * - `dbKey` 是本地加密密钥，**绝不能落盘，也不该出现在 devtools / 持久化快照里**；
 * - 解锁态必须在进程重启后归零（重启即锁），而 pinia persist 很容易把它一起存下去。
 *
 * 生命周期：`unlock()` 写入 → 空闲/失焦/切后台/登出 `lock()` 清零。
 */

/** 空闲检查间隔（毫秒）。 */
const SWEEP_INTERVAL_MS = 30_000

const unlockedAt = ref<number | null>(null)
const lastActivityAt = ref(0)
/** `shallowRef`：dbKey 是字节数组，不需要深层响应式。 */
const dbKey = shallowRef<Uint8Array | null>(null)
const isUnlocked = computed(() => unlockedAt.value !== null && dbKey.value !== null)

let sweepTimer: ReturnType<typeof setInterval> | null = null
let lockListeners: Array<() => void> = []
let timeoutProvider: (() => number) | null = null

/** 注册「已锁定」回调（供路由/页面跳转使用），返回注销函数。 */
export function onSecretChatLocked(listener: () => void): () => void {
  lockListeners.push(listener)
  return () => {
    lockListeners = lockListeners.filter((item) => item !== listener)
  }
}

/** 当前是否已解锁。 */
export function isSecretChatUnlocked(): boolean {
  return isUnlocked.value
}

/** 写入解锁态；覆盖旧密钥前先清零，避免泄漏。 */
export function unlockSecretChatSession(key: Uint8Array): void {
  zeroize(dbKey.value)
  dbKey.value = key
  unlockedAt.value = Date.now()
  lastActivityAt.value = Date.now()
  logger.info('私密聊天已解锁')
}

/** 主动上锁：清零密钥、通知监听方。 */
export function lockSecretChatSession(reason?: string): void {
  if (unlockedAt.value === null && dbKey.value === null) return
  zeroize(dbKey.value)
  dbKey.value = null
  unlockedAt.value = null
  lastActivityAt.value = 0
  logger.info(`私密聊天已锁定${reason ? `：${reason}` : ''}`)
  for (const listener of lockListeners) {
    try {
      listener()
    } catch (err) {
      logger.warn('锁定时监听器抛错（已忽略）:', err)
    }
  }
}

/** 记录一次用户活动（由私密页的交互事件调用）。 */
export function touchSecretChatSession(): void {
  if (unlockedAt.value !== null) {
    lastActivityAt.value = Date.now()
  }
}

/** 取当前 dbKey 的只读引用（调用方不得修改或持有超过必要时间）。 */
export function getSecretChatDbKey(): Uint8Array | null {
  return dbKey.value
}

/**
 * 启动自动锁巡检。
 *
 * @param getTimeoutMinutes 读取当前锁定时长（分钟），由调用方注入，避免 store 循环依赖
 */
export function startSecretChatAutoLock(getTimeoutMinutes: () => number): void {
  timeoutProvider = getTimeoutMinutes
  if (sweepTimer !== null) return
  sweepTimer = setInterval(() => {
    if (unlockedAt.value === null) return
    const minutes = timeoutProvider?.() ?? 5
    const timeoutMs = Math.max(1, minutes) * 60_000
    if (Date.now() - lastActivityAt.value >= timeoutMs) {
      lockSecretChatSession('空闲超时')
    }
  }, SWEEP_INTERVAL_MS)
}

/** 停止自动锁巡检（登出/测试清理时调用）。 */
export function stopSecretChatAutoLock(): void {
  if (sweepTimer !== null) {
    clearInterval(sweepTimer)
    sweepTimer = null
  }
  timeoutProvider = null
}

/** 供 UI 读取的响应式视图。 */
export function useSecretChatSession(): {
  isUnlocked: ComputedRef<boolean>
  unlockedAt: typeof unlockedAt
  lastActivityAt: typeof lastActivityAt
} {
  return { isUnlocked, unlockedAt, lastActivityAt }
}

/** 测试用：重置全部状态。 */
export function resetSecretChatSessionForTest(): void {
  zeroize(dbKey.value)
  dbKey.value = null
  unlockedAt.value = null
  lastActivityAt.value = 0
  lockListeners = []
  stopSecretChatAutoLock()
}
