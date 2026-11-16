/**
 * 媒体库「配额可能已变化」的通知通道（§19.22 边界 3）。
 *
 * 配额是服务端聚合值，本地缓存没有任何失效依据：上传或删除成功后如果不主动通知，
 * 展示配额的组件只能靠 60s TTL 或重新挂载才会更新，用户会看到「刚传完却还是旧用量」。
 *
 * 这里只做**通知**，不持有任何业务状态：订阅方自行决定是否重新取数。
 */

type MediaQuotaChangedListener = () => void

const listeners = new Set<MediaQuotaChangedListener>()

/** 订阅配额变化通知；返回取消订阅函数（组件卸载时必须调用）。 */
export function onMediaQuotaChanged(listener: MediaQuotaChangedListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 媒体库发生写入（上传 / 删除成功）后调用，让配额展示方自行失效重取。 */
export function notifyMediaQuotaChanged(): void {
  for (const listener of listeners) listener()
}
