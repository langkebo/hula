/**
 * 缩略图缓存清理器 (TTL + LRU)
 *
 * 纯逻辑模块：所有副作用（文件删除、元数据持久化）通过注入依赖完成，
 * 因此可在不依赖 Tauri 运行时的 Vitest 环境中测试。
 *
 * - TTL：缓存项在 {@link MAX_AGE_MS}（7 天）后视为过期。
 * - LRU：当缓存总大小超过 {@link MAX_TOTAL_SIZE}（500MB）时，淘汰最久未访问的项。
 */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 天
export const MAX_TOTAL_SIZE = 500 * 1024 * 1024 // 500MB

export interface CacheMetadata {
  /** 缓存创建时间（用于 TTL） */
  createdAt: number
  /** 最近访问时间（用于 LRU） */
  lastAccessed: number
  /** 文件大小（字节） */
  size: number
}

export interface JanitorDeps {
  /** 删除指定路径的文件，返回是否删除成功 */
  deleteFile: (path: string) => Promise<boolean>
  /** 启动时加载已持久化的元数据 */
  loadMetadata?: () => Map<string, CacheMetadata>
  /** 元数据变更时持久化 */
  saveMetadata?: (metadata: Map<string, CacheMetadata>) => void
}

export interface JanitorOptions {
  /** 注入时钟，便于测试 */
  now?: () => number
  /** 初始元数据（优先于 loadMetadata） */
  initialMetadata?: Map<string, CacheMetadata>
  /** 覆盖默认 TTL（便于测试） */
  maxAgeMs?: number
  /** 覆盖默认总大小上限（便于测试） */
  maxTotalSize?: number
}

export class ThumbnailCacheJanitor {
  private readonly metadata: Map<string, CacheMetadata>
  private readonly deps: JanitorDeps
  private readonly now: () => number
  private readonly maxAgeMs: number
  private readonly maxTotalSize: number

  constructor(deps: JanitorDeps, options: JanitorOptions = {}) {
    this.deps = deps
    this.now = options.now ?? Date.now
    this.maxAgeMs = options.maxAgeMs ?? MAX_AGE_MS
    this.maxTotalSize = options.maxTotalSize ?? MAX_TOTAL_SIZE
    this.metadata = options.initialMetadata ?? deps.loadMetadata?.() ?? new Map()
  }

  /** 记录一个缓存项（仅元数据，不触发淘汰） */
  recordCache(path: string, size: number): void {
    const t = this.now()
    this.metadata.set(path, { createdAt: t, lastAccessed: t, size })
    this.persist()
  }

  /** 添加缓存项并按需执行 LRU 淘汰，返回被淘汰的路径列表 */
  async add(path: string, size: number): Promise<string[]> {
    this.recordCache(path, size)
    return this.evictLRU()
  }

  /** 判断缓存项是否存在且未过期 */
  isFresh(path: string): boolean {
    const entry = this.metadata.get(path)
    if (!entry) return false
    return this.now() - entry.createdAt <= this.maxAgeMs
  }

  /** 命中缓存时更新最近访问时间 */
  touch(path: string): void {
    const entry = this.metadata.get(path)
    if (!entry) return
    entry.lastAccessed = this.now()
    this.persist()
  }

  /** 删除单个缓存项的元数据（不删除文件） */
  forget(path: string): void {
    if (this.metadata.delete(path)) {
      this.persist()
    }
  }

  /** 扫描并删除所有过期项（TTL 清理），返回被删除的路径列表 */
  async cleanupExpired(): Promise<string[]> {
    const now = this.now()
    const removed: string[] = []
    for (const [path, entry] of this.metadata) {
      if (now - entry.createdAt > this.maxAgeMs) {
        const deleted = await this.deps.deleteFile(path)
        if (deleted) {
          this.metadata.delete(path)
          removed.push(path)
        }
      }
    }
    this.persist()
    return removed
  }

  /** 当总大小超限时，淘汰最久未访问的项直到回到上限以内 */
  async evictLRU(): Promise<string[]> {
    const removed: string[] = []
    let totalSize = this.getTotalSize()
    if (totalSize <= this.maxTotalSize) return removed
    while (totalSize > this.maxTotalSize && this.metadata.size > 1) {
      const oldestPath = this.findLRU()
      if (!oldestPath) break
      const entry = this.metadata.get(oldestPath)
      if (!entry) break
      const deleted = await this.deps.deleteFile(oldestPath)
      if (deleted) {
        totalSize -= entry.size
        this.metadata.delete(oldestPath)
        removed.push(oldestPath)
      } else {
        // 删除失败则跳出，避免死循环
        break
      }
    }
    this.persist()
    return removed
  }

  /** 当前所有缓存项总大小（字节） */
  getTotalSize(): number {
    let total = 0
    for (const entry of this.metadata.values()) total += entry.size
    return total
  }

  getMetadata(path: string): CacheMetadata | undefined {
    return this.metadata.get(path)
  }

  /** 当前缓存项数量 */
  size(): number {
    return this.metadata.size
  }

  private findLRU(): string | null {
    let oldestPath: string | null = null
    let oldestTime = Infinity
    for (const [path, entry] of this.metadata) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestPath = path
      }
    }
    return oldestPath
  }

  private persist(): void {
    this.deps.saveMetadata?.(this.metadata)
  }
}
