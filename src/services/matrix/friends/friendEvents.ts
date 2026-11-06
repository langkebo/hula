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

/**
 * 好友数据「代际」计数器。
 *
 * 用途：`MatrixFriendService.getFriends()` 的短 TTL 缓存据此失效。
 *
 * 为什么不直接用 `friendEventBus` 订阅写事件：`stop()` 会 `clear()` 掉全部监听器，
 * 内部订阅会一并消失，登出再登入后缓存就再也不失效了。代际计数器是无状态模块变量，
 * 不受 `clear()` 影响，也不需要写操作方 import 服务本体（避免循环依赖）。
 */
let friendsGeneration = 0

/** 标记好友数据已变化（写操作成功后调用），使读缓存立即失效。 */
export function bumpFriendsGeneration(): void {
  friendsGeneration += 1
}

/** 读取当前代际；缓存条目代际不一致即视为过期。 */
export function getFriendsGeneration(): number {
  return friendsGeneration
}

/**
 * 好友读取「降级信号」：按通道记录最近一次**拿不到数据**的失败原因（成功即清空）。
 *
 * 解决的是「空」与「失败」不可区分：服务层为兼容历史调用仍返回 `[]`/`false`，
 * 但 UI 需要知道这次是「真的没有」还是「后端挂了」，否则只会显示空列表 / 空搜索结果。
 *
 * 通道划分：
 * - `friends`  好友列表（`getFriends`）
 * - `requests` 好友申请收发列表（`getIncomingRequests` / `getOutgoingRequests`）
 * - `search`   加好友搜索（`searchFriends`）
 */
type FriendReadChannel = 'friends' | 'requests' | 'search'

const readErrors = new Map<FriendReadChannel, unknown>()

/** 记录某通道一次读取失败（供 UI 显示错误态 + 重试）。 */
export function setFriendReadError(channel: FriendReadChannel, error: unknown): void {
  readErrors.set(channel, error)
}

/** 某通道读取成功即清空，避免陈旧错误态残留。 */
export function clearFriendReadError(channel: FriendReadChannel): void {
  readErrors.delete(channel)
}

/** 某通道最近一次失败原因；`null` 表示上次读取成功。 */
export function getFriendReadError(channel: FriendReadChannel): unknown {
  return readErrors.get(channel) ?? null
}

/** 清空全部通道（服务停止 / 账号切换）。 */
export function clearAllFriendReadErrors(): void {
  readErrors.clear()
}

/* ---------------- `friends` 通道的具名包装（既有调用方保持不变） ---------------- */

/** 记录好友列表读取失败。 */
export function setFriendsLoadError(error: unknown): void {
  setFriendReadError('friends', error)
}

/** 好友列表读取成功，清空信号。 */
export function clearFriendsLoadError(): void {
  clearFriendReadError('friends')
}

/** 好友列表最近一次失败原因；`null` 表示上次读取成功。 */
export function getFriendsLoadError(): unknown {
  return getFriendReadError('friends')
}
