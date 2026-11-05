import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchEventDoc, SearchRoomDoc } from '../matrixWorkerTypes'
import {
  handleSearchBootstrapEvents,
  handleSearchBootstrapRooms,
  handleSearchQuery,
  handleSearchRedactEvent,
  handleSearchRemoveRoom,
  handleSearchReset,
  handleSearchSetKey,
  handleSearchStats,
  handleSearchUpsertEvents
} from '../workerSearchHandlers'

vi.mock('../workerLogger', () => ({
  createWorkerLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

vi.mock('../searchIndexDb', () => ({
  loadRoomsFromDB: vi.fn(),
  loadEventsFromDB: vi.fn(),
  saveRoomsToDB: vi.fn(),
  saveEventsToDB: vi.fn(),
  deleteEventFromDB: vi.fn(),
  deleteRoomFromDB: vi.fn(),
  clearAllSearchData: vi.fn(),
  setSearchIndexKey: vi.fn()
}))

const { clearAllSearchData, deleteEventFromDB, deleteRoomFromDB, setSearchIndexKey } = await import('../searchIndexDb')

/** 造一条消息文档（默认落在同一个房间） */
const ev = (eventId: string, body: string, extra: Partial<SearchEventDoc> = {}): SearchEventDoc => ({
  eventId,
  roomId: '!r1:hs',
  sender: '@a:hs',
  timestamp: 1_700_000_000_000,
  body,
  ...extra
})

const room = (roomId: string, name: string): SearchRoomDoc => ({ roomId, name })

/** 便捷：消息搜索并取 eventId 列表 */
const searchIds = (term: string, extra: { roomId?: string; limit?: number; offset?: number } = {}): string[] => {
  const result = handleSearchQuery({ term, scope: 'messages', ...extra })
  return (result.messages ?? []).map((hit) => hit.eventId)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(clearAllSearchData).mockResolvedValue(undefined)
  vi.mocked(deleteEventFromDB).mockResolvedValue(undefined)
  vi.mocked(deleteRoomFromDB).mockResolvedValue(undefined)
  // reset 会清空六个内存结构，保证用例互不影响（模块级单例，不能靠重新 import）
  handleSearchReset()
})

describe('房间名搜索', () => {
  it('前缀命中优先于包含命中，同分按名称排序', () => {
    handleSearchBootstrapRooms({
      rooms: [room('!a:hs', 'Sergent'), room('!b:hs', 'General'), room('!c:hs', 'a gen')]
    })

    const rooms = handleSearchQuery({ term: 'GEN', scope: 'rooms' }).rooms ?? []

    // 大小写已归一；General 是前缀（200），另两个是包含（100）
    expect(rooms.map((r) => r.roomId)).toEqual(['!b:hs', '!c:hs', '!a:hs'])
    expect(rooms.map((r) => r.score)).toEqual([200, 100, 100])
  })

  it('无名称时用 roomId 兜底参与匹配', () => {
    handleSearchBootstrapRooms({ rooms: [room('!magic-room:hs', '')] })

    const rooms = handleSearchQuery({ term: 'magic', scope: 'rooms' }).rooms ?? []

    expect(rooms).toHaveLength(1)
    expect(rooms[0].roomName).toBe('!magic-room:hs')
  })

  it('房间搜索同样受 limit/offset 约束', () => {
    handleSearchBootstrapRooms({
      rooms: [room('!a:hs', 'team 1'), room('!b:hs', 'team 2'), room('!c:hs', 'team 3')]
    })

    expect(handleSearchQuery({ term: 'team', scope: 'rooms', limit: 2 }).rooms).toHaveLength(2)
    expect(handleSearchQuery({ term: 'team', scope: 'rooms', limit: 2, offset: 2 }).rooms).toHaveLength(1)
  })
})

describe('消息搜索', () => {
  it('大小写与连续空白归一后再匹配', () => {
    handleSearchBootstrapEvents({ events: [ev('$e1', 'Hello    WORLD')] })

    expect(searchIds('hello world')).toEqual(['$e1'])
    expect(searchIds('  HELLO   world  ')).toEqual(['$e1'])
  })

  it('多词查询是「短语」语义：token 都要在，且必须连续出现', () => {
    handleSearchBootstrapEvents({
      events: [ev('$phrase', 'hello world again'), ev('$reordered', 'world hello again')]
    })

    // 两条都含 hello / world 两个 token，但只有 $phrase 是连续子串
    expect(searchIds('hello world')).toEqual(['$phrase'])
  })

  it('中文没有 ASCII 分词，走全量扫描仍能命中', () => {
    handleSearchBootstrapEvents({ events: [ev('$zh', '今天下午三点开会'), ev('$other', '无关内容')] })

    // tokenize 只认 [a-z0-9_]+，中文一律无 token ⇒ 走「全量 + includes」兜底
    expect(searchIds('下午三点')).toEqual(['$zh'])
  })

  it('单字符查询不会退化成空结果', () => {
    handleSearchBootstrapEvents({ events: [ev('$x', 'x marks the spot')] })

    expect(searchIds('x')).toEqual(['$x'])
  })

  it('没有任何索引命中时返回空（不回落全量）', () => {
    handleSearchBootstrapEvents({ events: [ev('$e1', 'hello world')] })

    expect(searchIds('zzz')).toEqual([])
  })

  it('空查询直接返回空，不返回全部消息', () => {
    handleSearchBootstrapEvents({ events: [ev('$e1', 'hello')] })

    expect(searchIds('')).toEqual([])
    expect(searchIds('   ')).toEqual([])
  })

  it('roomId 过滤只在该房间内检索', () => {
    handleSearchBootstrapEvents({
      events: [ev('$a', 'needle here', { roomId: '!r1:hs' }), ev('$b', 'needle there', { roomId: '!r2:hs' })]
    })

    expect(searchIds('needle')).toHaveLength(2)
    expect(searchIds('needle', { roomId: '!r2:hs' })).toEqual(['$b'])
  })
})

describe('排序与分页', () => {
  it('完全匹配 > 前缀匹配 > 包含匹配', () => {
    const base = 1_700_000_000_000
    handleSearchBootstrapEvents({
      events: [
        ev('$contains', 'prefix alpha suffix', { timestamp: base + 3000 }),
        ev('$exact', 'alpha', { timestamp: base }),
        ev('$prefix', 'alpha beta', { timestamp: base + 1000 })
      ]
    })

    const hits = handleSearchQuery({ term: 'alpha', scope: 'messages' }).messages ?? []

    // 分数档位（300/200/100）远大于时间戳带来的千分之一点，因此不受先后顺序影响
    expect(hits.map((h) => h.eventId)).toEqual(['$exact', '$prefix', '$contains'])
    expect(hits[0].score).toBeGreaterThan(hits[1].score)
    expect(hits[1].score).toBeGreaterThan(hits[2].score)
  })

  it('同档位按时间倒序（新的在前）', () => {
    const base = 1_700_000_000_000
    handleSearchBootstrapEvents({
      events: [ev('$old', 'alpha one', { timestamp: base }), ev('$new', 'alpha two', { timestamp: base + 5000 })]
    })

    expect(searchIds('alpha')).toEqual(['$new', '$old'])
  })

  it('limit / offset 对消息生效，默认 20 条', () => {
    handleSearchBootstrapEvents({
      events: Array.from({ length: 25 }, (_, i) => ev(`$m${i}`, `alpha ${i}`, { timestamp: 1_700_000_000_000 + i }))
    })

    expect(searchIds('alpha')).toHaveLength(20)
    expect(searchIds('alpha', { limit: 5 })).toHaveLength(5)
    expect(searchIds('alpha', { limit: 5, offset: 20 })).toHaveLength(5)
  })

  it('分词按词边界：单词内部的子串搜不到', () => {
    handleSearchBootstrapEvents({ events: [ev('$e1', 'xtargetx')] })

    // `[a-z0-9_]+` 把 xtargetx 当成一个 token ⇒ 倒排索引里没有 target。
    // 这是刻意记录的行为：中文靠「全量 + includes」兜底，英文走 token 精确匹配。
    expect(searchIds('target')).toEqual([])
    expect(searchIds('xtargetx')).toEqual(['$e1'])
  })

  it('preview 以命中词为中心截取窗口', () => {
    const body = `${'x'.repeat(100)} target ${'y'.repeat(100)}`
    handleSearchBootstrapEvents({ events: [ev('$p', body)] })

    const hit = handleSearchQuery({ term: 'target', scope: 'messages' }).messages?.[0]

    expect(hit?.preview).toContain('target')
    // 命中位置前留 40 字符、后留 80 字符
    expect(hit?.preview.length).toBeLessThanOrEqual(40 + 'target'.length + 80)
    expect(hit?.preview.startsWith('x')).toBe(true)
  })
})

describe('索引维护', () => {
  it('同 eventId 覆盖写入后，旧正文的词不再命中', () => {
    handleSearchBootstrapEvents({ events: [ev('$e1', 'obsolete wording')] })
    handleSearchUpsertEvents({ events: [ev('$e1', 'replacement wording')] })

    // 回归点：若 upsert 没先 removeIndexedEvent，旧词会残留在倒排索引里。
    // 查询侧还有 `doc.normalizedBody.includes(term)` 二次过滤，所以**脏 token 只泄漏内存、
    // 不会产生错结果** —— 必须用 token 计数才能测出来。
    expect(searchIds('obsolete')).toEqual([])
    expect(searchIds('replacement')).toEqual(['$e1'])
    expect(handleSearchStats().events).toBe(1)
    expect(handleSearchStats().tokens).toBe(2) // replacement / wording（obsolete 必须已被摘除）
  })

  it('撤回事件后不可再搜到', () => {
    handleSearchBootstrapEvents({ events: [ev('$e1', 'secret message')] })
    handleSearchRedactEvent({ eventId: '$e1' })

    expect(searchIds('secret')).toEqual([])
    expect(vi.mocked(deleteEventFromDB)).toHaveBeenCalledWith('$e1')
    expect(handleSearchStats().events).toBe(0)
  })

  it('删除房间会连带清掉该房间的消息索引', () => {
    handleSearchBootstrapEvents({
      events: [ev('$a', 'needle', { roomId: '!r1:hs' }), ev('$b', 'needle', { roomId: '!r2:hs' })]
    })
    handleSearchRemoveRoom({ roomId: '!r1:hs' })

    expect(searchIds('needle')).toEqual(['$b'])
    expect(vi.mocked(deleteRoomFromDB)).toHaveBeenCalledWith('!r1:hs')
    expect(handleSearchStats().rooms).toBe(0)
  })

  it('每房间上限 500 条，超出后淘汰时间戳最旧的', () => {
    handleSearchBootstrapEvents({
      events: Array.from({ length: 501 }, (_, i) => ev(`$e${i}`, `e${i}`, { timestamp: 1_700_000_000_000 + i }))
    })

    expect(handleSearchStats().events).toBe(500)
    expect(searchIds('e0')).toEqual([]) // ts 最小，被淘汰
    expect(searchIds('e500')).toEqual(['$e500'])
  })

  it('正文超过 500 字符的部分不入索引', () => {
    handleSearchBootstrapEvents({ events: [ev('$long', `${'x'.repeat(520)} needle`)] })

    // trimSearchBody 截断到 500 字符 ⇒ needle 根本不在索引里
    expect(searchIds('needle')).toEqual([])
  })

  it('非法文档被忽略：缺 eventId / 缺 roomId / 空正文', () => {
    handleSearchBootstrapEvents({
      events: [ev('', 'no id'), ev('$noRoom', 'no room', { roomId: '' }), ev('$blank', '   ')]
    })

    expect(handleSearchStats()).toEqual({ rooms: 0, events: 0, tokens: 0 })
  })

  it('payload 缺字段时按空数组处理，不抛错', () => {
    expect(() => handleSearchBootstrapEvents({})).not.toThrow()
    expect(() => handleSearchUpsertEvents({})).not.toThrow()
    expect(() => handleSearchBootstrapRooms({})).not.toThrow()
    expect(handleSearchStats()).toEqual({ rooms: 0, events: 0, tokens: 0 })
  })

  it('stats 反映房间数、事件数与倒排 token 数', () => {
    handleSearchBootstrapRooms({ rooms: [room('!r1:hs', 'Room')] })
    handleSearchBootstrapEvents({ events: [ev('$e1', 'alpha beta')] })

    const stats = handleSearchStats()

    expect(stats.rooms).toBe(1)
    expect(stats.events).toBe(1)
    // alpha / beta 两个 token
    expect(stats.tokens).toBe(2)
  })
})

describe('索引加密密钥（F-4 / D3）', () => {
  it('提供 key 时解码为字节并下发给 DB 层，不清空索引', () => {
    vi.mocked(clearAllSearchData).mockClear() // beforeEach 的 reset 也会调用它，先清计数
    const encoded = btoa('0123456789abcdef')
    handleSearchSetKey({ key: encoded })

    const arg = vi.mocked(setSearchIndexKey).mock.calls[0][0]
    expect(arg).toBeInstanceOf(Uint8Array)
    expect(arg?.length).toBe(16)
    expect(clearAllSearchData).not.toHaveBeenCalled()
  })

  it('key 为 null 时清空索引库（D3 之前写过明文，不能留在磁盘）', () => {
    vi.mocked(clearAllSearchData).mockClear()
    handleSearchSetKey({ key: null })

    expect(setSearchIndexKey).toHaveBeenCalledWith(null)
    expect(clearAllSearchData).toHaveBeenCalledTimes(1)
  })

  it('空字符串 key 等同 null', () => {
    vi.mocked(clearAllSearchData).mockClear()
    handleSearchSetKey({ key: '' })

    expect(setSearchIndexKey).toHaveBeenCalledWith(null)
    expect(clearAllSearchData).toHaveBeenCalledTimes(1)
  })
})

describe('initSearchEngine', () => {
  it('同一 worker 生命周期内只从 IndexedDB 加载一次', async () => {
    // 模块级 `isSearchIndexLoaded` 无法通过 handleSearchReset 复位，只能重新 import 拿干净实例
    vi.resetModules()
    const db = await import('../searchIndexDb')
    vi.mocked(db.loadRoomsFromDB).mockResolvedValue([room('!r1:hs', 'Room')])
    vi.mocked(db.loadEventsFromDB).mockResolvedValue([ev('$e1', 'hello world')])
    const mod = await import('../workerSearchHandlers')

    await mod.initSearchEngine()
    await mod.initSearchEngine()

    expect(db.loadRoomsFromDB).toHaveBeenCalledTimes(1)
    expect(db.loadEventsFromDB).toHaveBeenCalledTimes(1)
    // 加载后立即可查（说明 upsert 路径与内存索引都接上了）
    expect(mod.handleSearchQuery({ term: 'hello', scope: 'messages' }).messages).toHaveLength(1)
  })
})
