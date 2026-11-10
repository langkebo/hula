import { ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

/**
 * 私密聊天解锁对话框的全局状态（模块级单例）。
 *
 * 为什么需要它：`/modal-secretChat` 虽然定义了路由，但**没有任何代码创建那个 Tauri 窗口**，
 * 密码框实际从未被打开过。改为应用内对话框后，路由守卫与入口按钮都需要一个「请求解锁」的
 * 统一入口，且守卫不能阻塞等待用户输入，因此用「记录意图 → 重定向 → 解锁后回跳」的模式。
 */

const visible = ref(false)
/** 解锁成功后要回跳的目标（字符串路径或路由对象，含 `!`/`:` 的 roomId 必须用路由对象）。 */
const pendingPath = ref<RouteLocationRaw | null>(null)
/** 失败计数，用于 UI 退避提示。 */
const failureCount = ref(0)

/** 打开解锁对话框；`targetPath` 为解锁后回跳目标。 */
export function openSecretChatUnlock(targetPath?: RouteLocationRaw): void {
  if (targetPath) {
    pendingPath.value = targetPath
  }
  failureCount.value = 0
  visible.value = true
}

/** 关闭解锁对话框（不清 pendingPath，调用方可自行消费）。 */
export function closeSecretChatUnlock(): void {
  visible.value = false
}

/** 取出并清空回跳目标。 */
export function consumeSecretChatPendingPath(): RouteLocationRaw | null {
  const path = pendingPath.value
  pendingPath.value = null
  return path
}

/** 丢弃回跳目标（解锁失败/用户取消时调用）。 */
export function clearSecretChatPendingPath(): void {
  pendingPath.value = null
}

/** 记录一次失败，返回当前累计次数。 */
export function recordSecretChatUnlockFailure(): number {
  failureCount.value += 1
  return failureCount.value
}

/** 读取解锁对话框状态（供组件与守卫使用）。 */
export function useSecretChatGate() {
  return { visible, pendingPath, failureCount }
}
