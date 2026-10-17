import type { FriendServiceEventHandler } from './friendUtils'

/**
 * 好友服务事件总线。
 *
 * 从 `MatrixFriendService` 门面中抽出，使 `MatrixFriendSync`（事件生产者）与
 * 事件监听方（组件/组合式函数）之间不再依赖门面实例，避免「为了让 Sync 能 emit
 * 而必须在门面里 new 它」的循环依赖。
 *
 * 门面的 `on` / `off` / `stop` 仍然转发到这里，对外 API 不变。
 */
class FriendEventBus {
  private readonly listeners = new Map<string, Set<FriendServiceEventHandler>>()

  /** 注册事件监听器（同一事件可注册多个回调）。 */
  on(event: string, callback: FriendServiceEventHandler): void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(callback)
  }

  /** 移除某一事件的监听器。 */
  off(event: string, callback: FriendServiceEventHandler): void {
    this.listeners.get(event)?.delete(callback)
  }

  /** 派发事件；单个监听器抛错不影响其它监听器。 */
  emit(event: string, data?: unknown): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const callback of set) {
      try {
        callback(data)
      } catch {
        // 监听器自身的异常不应中断其它监听器；由监听器内部自行记录日志
      }
    }
  }

  /** 清空全部监听器（服务停止时调用）。 */
  clear(): void {
    this.listeners.clear()
  }
}

export const friendEventBus = new FriendEventBus()
