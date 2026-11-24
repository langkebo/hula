/**
 * 设置页「在飞写请求」注册表。
 *
 * ## 为什么需要它
 *
 * 设置页里有一部分表单（如账号资料：昵称 + 简介/性别/地区/生日）是 **blur 自动保存**，
 * 没有"未保存"概念，因此**不注册** `useSettingsTabDirty`，`hasDirty()` 恒为 false。
 *
 * 后果：用户改完输入框直接 Cmd+W / 点窗口红灯时，输入框还没失焦、`@blur` 没触发、
 * 写请求根本没发出，关窗守卫的 `if (!hasDirty()) return` 直接放行 —— 最后一次输入丢失。
 *
 * 这里用一个模块级集合把"已发出但未完成"的写请求暴露给关窗守卫，让守卫在放行前
 * 先 `flush` 一次。
 *
 * ## 为什么不用 pinia / ref
 *
 * 关窗发生在窗口销毁路径上，此刻 tab 组件可能已卸载、pinia 也可能已被 teardown；
 * 模块级 Set 没有生命周期依赖，且在 `await` 之间可以精确观察到 settle。
 * 用响应式反而引入无谓开销（守卫是同步读，不需要追踪依赖）。
 */

/** 归一化后的任务：`true` = 写成功，`false` = 写失败（不向外抛）。 */
const pendingWrites = new Set<Promise<boolean>>()

/** `flushSettingsWrites` 的默认超时：超时即放行，不让关窗卡死。 */
export const DEFAULT_FLUSH_TIMEOUT_MS = 8000

/**
 * 登记一个在飞写请求。
 *
 * - rejection 被归一成 `false`，避免未处理的 rejection 冒到全局（关窗路径上抛错
 *   会让窗口关不掉，比丢数据更糟）；
 * - settle 时**立刻**从集合移除，第二次关窗不会重复等待已完成的请求。
 */
export function trackSettingsWrite(task: Promise<unknown>): void {
  const tracked: Promise<boolean> = task.then(
    () => {
      pendingWrites.delete(tracked)
      return true
    },
    () => {
      pendingWrites.delete(tracked)
      return false
    }
  )
  pendingWrites.add(tracked)
}

/** 是否还有未完成的写请求（同步读取，供守卫在 `preventDefault` 前判定）。 */
export function hasPendingSettingsWrites(): boolean {
  return pendingWrites.size > 0
}

/**
 * 等在飞写请求全部结束。
 *
 * - **永不 reject**：失败只计数，不抛；
 * - 默认 8s 超时，到点直接 resolve（返回值里的 `failed` 含未完成任务数）；
 * - **循环 drain**：flush 期间 `activeElement.blur()` 可能链式触发多个字段的写请求，
 *   只快照一次会漏掉后登记的那些。
 */
export async function flushSettingsWrites(timeoutMs: number = DEFAULT_FLUSH_TIMEOUT_MS): Promise<{ failed: number }> {
  let failed = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const drain = (async () => {
    while (pendingWrites.size > 0) {
      const batch = Array.from(pendingWrites)
      const settled = await Promise.allSettled(batch)
      failed += settled.filter((item) => item.status === 'fulfilled' && item.value === false).length
    }
    return 'settled' as const
  })()

  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs)
  })

  const outcome = await Promise.race([drain, timeout])
  if (timer !== undefined) clearTimeout(timer)

  if (outcome === 'timeout') {
    // 超时也要清空：否则下次关窗会立刻再次等待同一批永不 settle 的请求。
    failed += pendingWrites.size
    pendingWrites.clear()
  }

  return { failed }
}

/** 测试用：重置注册表。 */
export function resetSettingsPendingWritesForTest(): void {
  pendingWrites.clear()
}
