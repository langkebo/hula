/**
 * 已焚毁消息的本地黑名单。
 *
 * 为什么需要它：阅后即焚在服务端是 **per-user 时间登记**（`burn_after_read_service`），
 * 到期后只把该行标记 processed 并推 `BURN_MESSAGE_BURNED`，**不会 redact 房间事件**
 * ——因为房间事件由全员共享，一人到期就 redact 等于「一人已读、全员丢消息」。
 * 代价是：客户端的「烧掉」只活在内存里（`deleteMsg` / `isBurned`），
 * 重进会话或重新 sync 后，到期消息会原样复活。
 *
 * 本模块补上那份「跨会话的记忆」：事件 ID 落到 `localStorage`，
 * 消息列表渲染时据此过滤，让「重载后不再出现」成立。
 *
 * 语义边界（别误读）：
 * - 它**不是**加密或物理删除，服务端原文仍在（由 retention 策略兜底）；
 * - 它只影响**本端**的可见性，不改变其他成员的视图；
 * - 清空本地存储（或换设备）后，已到期但服务端尚未 sweep 的消息仍可能短暂出现。
 */
import { BURNED_MESSAGE_LIMIT, BURNED_MESSAGES_STORAGE_KEY } from '@/utils/storageKeys'

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem'>

/**
 * 进程内缓存。
 *
 * 消息列表是 computed，每次重建都会问「这条烧了吗」；直接读 `localStorage`
 * 会把它变成同步 IO 热点。首次读取后驻留内存，写入时同步更新。
 */
let cached: Set<string> | null = null

/** 仅供测试：清掉模块级缓存，避免用例之间互相污染。 */
export function resetBurnedEventCache(): void {
  cached = null
}

function parse(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && v.length > 0) : []
  } catch {
    // 坏数据（手工改过、半截写入）不该让整个消息列表炸掉，退化成「没有黑名单」。
    return []
  }
}

/** 读出全部已焚毁事件 ID（带进程内缓存）。 */
export function loadBurnedEventIds(storage: ReadableStorage = localStorage): Set<string> {
  if (cached) return cached
  try {
    cached = new Set(parse(storage.getItem(BURNED_MESSAGES_STORAGE_KEY)))
  } catch {
    // 隐私模式 / 禁用存储时 getItem 会抛，视作空黑名单。
    cached = new Set()
  }
  return cached
}

/** 该事件是否已被本端焚毁。 */
export function isEventBurned(eventId: string, storage: ReadableStorage = localStorage): boolean {
  if (!eventId) return false
  return loadBurnedEventIds(storage).has(eventId)
}

/**
 * 记下一个已焚毁事件。
 *
 * 幂等：重复记同一 ID 不产生写入。超出容量上限时丢弃最早写入的条目
 * （`Set` 保持插入顺序，直接 `slice` 尾部即可保留最近的）。
 */
export function markEventBurned(eventId: string, storage: ReadableStorage & WritableStorage = localStorage): void {
  if (!eventId) return
  const ids = loadBurnedEventIds(storage)
  if (ids.has(eventId)) return

  ids.add(eventId)

  // 先裁剪内存，再落盘：两边保持同一份内容，避免「内存无限涨、磁盘被截断」的错位。
  while (ids.size > BURNED_MESSAGE_LIMIT) {
    const oldest = ids.values().next()
    if (oldest.done) break
    ids.delete(oldest.value)
  }

  try {
    storage.setItem(BURNED_MESSAGES_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // 配额满/被禁用：内存里仍然生效（本次会话有效），只是下次启动会丢。
    // 这里刻意不抛，焚毁是「尽力而为」的清理，不该阻断消息渲染。
  }
}

/** 清空黑名单（用于「清除本地缓存」这类显式操作）。 */
export function clearBurnedEventIds(storage: WritableStorage = localStorage): void {
  cached = new Set()
  try {
    storage.setItem(BURNED_MESSAGES_STORAGE_KEY, '[]')
  } catch {
    // 同 markEventBurned：清理失败不阻断调用方。
  }
}
