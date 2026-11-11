import { createLogger } from '@/utils/Logger'

const logger = createLogger('LocalStorageUsage')

/**
 * localStorage 占用（UTF-16 近似字节数）。
 *
 * 为什么不直接用 `navigator.storage.estimate()`：它只给总用量，
 * 无法拆分「有多少是 localStorage、多少是 IndexedDB」。
 * 存储管理页要给出可解释的明细，就必须自己量。
 *
 * 口径：`(key.length + value.length) * 2`（JS 字符串按 UTF-16 存储，2 字节/码元）。
 * 这是**近似值**，不含浏览器自身开销，但用于「哪些数据占了多少」排序足够。
 */
export interface LocalStorageUsage {
  /** 全部键值对的近似字节数 */
  totalBytes: number
  /** 顶层前缀（`key.split(':')[0]`）→ 近似字节数，降序 */
  byPrefix: Array<{ prefix: string; bytes: number; keys: number }>
  /** 键数量 */
  keyCount: number
}

/** 无 localStorage 环境（SSR / 测试）返回全零，不抛错 */
export function measureLocalStorageUsage(): LocalStorageUsage {
  const empty: LocalStorageUsage = { totalBytes: 0, byPrefix: [], keyCount: 0 }

  let storage: Storage | null = null
  try {
    storage = typeof localStorage === 'undefined' ? null : localStorage
  } catch (error) {
    // 隐私模式 / 禁用存储时访问 localStorage 会抛 SecurityError
    logger.warn('localStorage 不可访问', error)
    return empty
  }
  if (!storage) return empty

  const buckets = new Map<string, { bytes: number; keys: number }>()
  let totalBytes = 0
  let keyCount = 0

  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key === null) continue
      const value = storage.getItem(key) ?? ''
      const bytes = (key.length + value.length) * 2
      totalBytes += bytes
      keyCount++
      const prefix = key.split(':')[0] || key
      const bucket = buckets.get(prefix) ?? { bytes: 0, keys: 0 }
      bucket.bytes += bytes
      bucket.keys++
      buckets.set(prefix, bucket)
    }
  } catch (error) {
    logger.error('统计 localStorage 失败', error)
    return empty
  }

  const byPrefix = [...buckets.entries()]
    .map(([prefix, bucket]) => ({ prefix, ...bucket }))
    .sort((a, b) => b.bytes - a.bytes)

  return { totalBytes, byPrefix, keyCount }
}
