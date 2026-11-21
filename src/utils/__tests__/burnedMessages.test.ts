import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearBurnedEventIds,
  isEventBurned,
  loadBurnedEventIds,
  markEventBurned,
  resetBurnedEventCache
} from '@/utils/burnedMessages'
import { BURNED_MESSAGE_LIMIT, BURNED_MESSAGES_STORAGE_KEY } from '@/utils/storageKeys'

/** 最小 Storage 替身：只实现 getItem/setItem，用来注入而不是碰真实 localStorage。 */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    raw: data
  }
}

describe('burnedMessages', () => {
  beforeEach(() => resetBurnedEventCache())

  it('标记后能查到，且未标记的查不到', () => {
    const storage = memoryStorage()
    expect(isEventBurned('$a', storage)).toBe(false)
    markEventBurned('$a', storage)
    expect(isEventBurned('$a', storage)).toBe(true)
    expect(isEventBurned('$b', storage)).toBe(false)
  })

  it('重复标记是幂等的，不会写重复项', () => {
    const storage = memoryStorage()
    markEventBurned('$a', storage)
    markEventBurned('$a', storage)
    markEventBurned('$a', storage)
    const persisted = JSON.parse(storage.raw.get(BURNED_MESSAGES_STORAGE_KEY) ?? '[]')
    expect(persisted).toEqual(['$a'])
  })

  it('落盘后可被新进程读出（模拟重载）', () => {
    const storage = memoryStorage()
    markEventBurned('$a', storage)
    // 清缓存 = 模拟重开应用
    resetBurnedEventCache()
    expect(isEventBurned('$a', storage)).toBe(true)
  })

  it('超出容量上限时保留最近的条目', () => {
    const storage = memoryStorage()
    for (let i = 0; i < BURNED_MESSAGE_LIMIT + 5; i += 1) {
      markEventBurned(`$e${i}`, storage)
    }
    const ids = loadBurnedEventIds(storage)
    expect(ids.size).toBe(BURNED_MESSAGE_LIMIT)
    // 最早的 5 条被丢弃，最新的还在
    expect(ids.has('$e0')).toBe(false)
    expect(ids.has(`$e${BURNED_MESSAGE_LIMIT + 4}`)).toBe(true)
  })

  it('坏数据退化为空集合而不是抛错', () => {
    const storage = memoryStorage({ [BURNED_MESSAGES_STORAGE_KEY]: '{not json' })
    expect(loadBurnedEventIds(storage).size).toBe(0)
  })

  it('非字符串元素被忽略', () => {
    const storage = memoryStorage({ [BURNED_MESSAGES_STORAGE_KEY]: '["$a", 1, null, {"x":1}, ""]' })
    expect([...loadBurnedEventIds(storage)]).toEqual(['$a'])
  })

  it('存储写入失败时内存仍生效（不阻断渲染）', () => {
    const storage = memoryStorage()
    const throwing = {
      getItem: storage.getItem,
      setItem: () => {
        throw new Error('QuotaExceededError')
      }
    }
    expect(() => markEventBurned('$a', throwing)).not.toThrow()
    expect(isEventBurned('$a', storage)).toBe(true)
  })

  it('空 ID 不写入', () => {
    const storage = memoryStorage()
    markEventBurned('', storage)
    expect(loadBurnedEventIds(storage).size).toBe(0)
  })

  it('清空后查不到', () => {
    const storage = memoryStorage()
    markEventBurned('$a', storage)
    clearBurnedEventIds(storage)
    expect(isEventBurned('$a', storage)).toBe(false)
  })
})
