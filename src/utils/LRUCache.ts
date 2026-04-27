/**
 * LRU (Least Recently Used) 缓存实现
 * 当缓存达到最大容量时，自动淘汰最久未使用的项
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>
  private maxSize: number

  constructor(maxSize: number = 50) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  /**
   * 获取缓存项
   * 访问后会将该项移到最新位置
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined
    }

    const value = this.cache.get(key)!
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  /**
   * 设置缓存项
   * 如果缓存已满，会删除最久未使用的项
   */
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, value)
  }

  /**
   * 检查缓存中是否存在指定的键
   */
  has(key: K): boolean {
    return this.cache.has(key)
  }

  /**
   * 删除指定的缓存项
   */
  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * 获取当前缓存大小
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * 获取最大缓存容量
   */
  get capacity(): number {
    return this.maxSize
  }

  /**
   * 获取所有键
   */
  keys(): IterableIterator<K> {
    return this.cache.keys()
  }

  /**
   * 获取所有值
   */
  values(): IterableIterator<V> {
    return this.cache.values()
  }

  /**
   * 获取所有键值对
   */
  entries(): IterableIterator<[K, V]> {
    return this.cache.entries()
  }

  /**
   * 遍历所有缓存项
   */
  forEach(callback: (value: V, key: K, map: Map<K, V>) => void): void {
    this.cache.forEach(callback)
  }
}
