import { info } from '@tauri-apps/plugin-log'

interface PendingRequest<T> {
  promise: Promise<T>
  timestamp: number
}

export class MatrixRequestDeduper {
  private static pending = new Map<string, PendingRequest<unknown>>()
  private static dedupWindowMs = 100

  static async dedupe<T>(
    key: string,
    fetcher: () => Promise<T>,
    windowMs: number = MatrixRequestDeduper.dedupWindowMs
  ): Promise<T> {
    const existing = MatrixRequestDeduper.pending.get(key) as PendingRequest<T> | undefined
    if (existing && Date.now() - existing.timestamp < windowMs) {
      return existing.promise
    }

    const promise = fetcher()
    MatrixRequestDeduper.pending.set(key, { promise, timestamp: Date.now() })

    try {
      const result = await promise
      return result
    } finally {
      MatrixRequestDeduper.pending.delete(key)
    }
  }

  static getPendingCount(): number {
    return MatrixRequestDeduper.pending.size
  }

  static clear(): void {
    MatrixRequestDeduper.pending.clear()
    info('[Deduper] 请求去重缓存已清空')
  }
}

export function createDedupedFetcher<T>(
  keyPrefix: string,
  fetcher: (id: string) => Promise<T>
): (id: string) => Promise<T> {
  return (id: string): Promise<T> => {
    return MatrixRequestDeduper.dedupe(`${keyPrefix}:${id}`, () => fetcher(id))
  }
}
