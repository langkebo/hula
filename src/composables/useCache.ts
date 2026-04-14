import { ref, onUnmounted } from 'vue'
import { LRUCache } from '@/utils/LRUCache'

interface CacheOptions {
  maxSize?: number
  ttl?: number
}

interface CacheEntry<V> {
  value: V
  expiresAt: number | null
}

export function useCache<V = unknown>(namespace: string, options: CacheOptions = {}) {
  const { maxSize = 100, ttl = 0 } = options

  const cache = new LRUCache<string, CacheEntry<V>>(maxSize)
  const hits = ref(0)
  const misses = ref(0)

  function get(key: string): V | undefined {
    const entry = cache.get(key)
    if (!entry) {
      misses.value++
      return undefined
    }

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      cache.delete(key)
      misses.value++
      return undefined
    }

    hits.value++
    return entry.value
  }

  function set(key: string, value: V): void {
    const expiresAt = ttl > 0 ? Date.now() + ttl : null
    cache.set(key, { value, expiresAt })
  }

  function has(key: string): boolean {
    const entry = cache.get(key)
    if (!entry) return false
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      cache.delete(key)
      return false
    }
    return true
  }

  function delete_(key: string): boolean {
    return cache.delete(key)
  }

  function clear(): void {
    cache.clear()
    hits.value = 0
    misses.value = 0
  }

  function getOrSet(key: string, factory: () => V): V {
    const existing = get(key)
    if (existing !== undefined) return existing

    const value = factory()
    set(key, value)
    return value
  }

  async function getOrSetAsync(key: string, factory: () => Promise<V>): Promise<V> {
    const existing = get(key)
    if (existing !== undefined) return existing

    const value = await factory()
    set(key, value)
    return value
  }

  const hitRate = ref(0)
  function updateHitRate(): void {
    const total = hits.value + misses.value
    hitRate.value = total > 0 ? hits.value / total : 0
  }

  onUnmounted(() => {
    cache.clear()
  })

  return {
    get,
    set,
    has,
    delete: delete_,
    clear,
    getOrSet,
    getOrSetAsync,
    size: () => cache.size,
    hits,
    misses,
    hitRate,
    updateHitRate,
    namespace
  }
}

const globalCaches = new Map<string, LRUCache<string, CacheEntry<unknown>>>()

export function getGlobalCache<V = unknown>(
  namespace: string,
  options: CacheOptions = {}
): {
  get: (key: string) => V | undefined
  set: (key: string, value: V) => void
  has: (key: string) => boolean
  delete: (key: string) => boolean
  clear: () => void
} {
  const { maxSize = 100, ttl = 0 } = options

  if (!globalCaches.has(namespace)) {
    globalCaches.set(namespace, new LRUCache<string, CacheEntry<unknown>>(maxSize))
  }

  const cache = globalCaches.get(namespace)!

  return {
    get(key: string): V | undefined {
      const entry = cache.get(key) as CacheEntry<V> | undefined
      if (!entry) return undefined
      if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
        cache.delete(key)
        return undefined
      }
      return entry.value
    },
    set(key: string, value: V): void {
      const expiresAt = ttl > 0 ? Date.now() + ttl : null
      cache.set(key, { value, expiresAt })
    },
    has(key: string): boolean {
      const entry = cache.get(key) as CacheEntry<V> | undefined
      if (!entry) return false
      if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
        cache.delete(key)
        return false
      }
      return true
    },
    delete(key: string): boolean {
      return cache.delete(key)
    },
    clear(): void {
      cache.clear()
    }
  }
}
