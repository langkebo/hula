import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixRequestDeduper')

interface PendingRequest<T> {
  promise: Promise<T>
  startedAt: number
}

/**
 * 「卡住的 in-flight 条目」安全阀（60s）。
 *
 * 本类是**进行中合并（in-flight coalescing）**，不是结果缓存：条目在 promise settle 时即删除，
 * 因此同一 key 的前后两次调用**都会真的发请求**。
 * 需要这个阀是因为：若某个 promise 因下游缺陷永不 settle，条目会永久留在 map 里，
 * 之后所有同 key 调用会被**永久**接到那个死 promise 上（表现为该功能整体静默卡死）。
 * 超过本阈值即视为陈旧，重新发起。
 */
const STALE_IN_FLIGHT_MS = 60_000

/**
 * 请求去重器：合并**同一时刻正在进行**的相同请求。
 *
 * 语义边界（此前被参数名 `dedupWindowMs` / `windowMs` 误导为「窗口内返回缓存结果」）：
 * - 命中条件 = 同 key **且存在尚未 settle 的条目**；
 * - 条目在 `finally` 中删除 ⇒ 请求完成后的下一次调用**不会**复用结果，而是真的重新拉取。
 *   这对 `unread_count` / `pushers` 这类必须实时的读取是必要的：若改成「窗口内返回旧结果」，
 *   用户读完消息后立刻取未读数就会拿到旧值。
 * - 因此本类**不做结果缓存**。确需 TTL 缓存的场景由各服务自带的显式缓存承担
 *   （例如 SDK `RoomManager` 内部的按房间缓存）。
 *   也正因如此，本类**不提供** `windowMs` 参数 —— 那个参数既无法表达结果缓存，
 *   也无法表达「跨请求复用」，只会让调用方误以为自己在配 TTL。
 */
export class MatrixRequestDeduper {
  private static pending = new Map<string, PendingRequest<unknown>>()

  /**
   * 合并同一 key 上正在进行的请求。
   *
   * 并发调用（第一个尚未 settle 时）会复用同一个 promise 与其结果；已完成后再调用则会重新执行
   * `fetcher`。这保证「并发去重」而不引入「结果陈旧」。
   */
  static async dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = MatrixRequestDeduper.pending.get(key) as PendingRequest<T> | undefined
    if (existing && Date.now() - existing.startedAt < STALE_IN_FLIGHT_MS) {
      return existing.promise
    }

    const promise = fetcher()
    MatrixRequestDeduper.pending.set(key, { promise, startedAt: Date.now() })

    try {
      return await promise
    } finally {
      // 只在「当前条目仍是自己」时删除。
      // 否则会误删「安全阀过期后接替自己的新条目」，让那个仍在飞的请求失去合并能力
      // —— 这是静默失效（无报错、只是去重不再生效），由测试
      // 'stuck 条目被接替后不会误删接替者' 锁定。
      if (MatrixRequestDeduper.pending.get(key)?.promise === promise) {
        MatrixRequestDeduper.pending.delete(key)
      }
    }
  }

  static getPendingCount(): number {
    return MatrixRequestDeduper.pending.size
  }

  static clear(): void {
    MatrixRequestDeduper.pending.clear()
    logger.info('[Deduper] 请求去重缓存已清空')
  }
}
