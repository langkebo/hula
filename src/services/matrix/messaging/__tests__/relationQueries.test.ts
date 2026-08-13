import { describe, expect, it, vi } from 'vitest'
import { MatrixContentField, MatrixRelType } from '@/common/matrixConstants'
import type { MatrixClient, MatrixEvent } from '../../sdk'
import { createRelationQueries } from '../relationQueries'

type EventOverrides = {
  id?: string
  sender?: string
  ts?: number
  content?: Record<string, unknown>
}

/** 创建模拟 MatrixEvent 对象 */
function createEvent(overrides: EventOverrides = {}): MatrixEvent {
  const sender = overrides.sender ?? '@u:server.com'
  return {
    getId: () => overrides.id ?? '$evt',
    getSender: () => sender,
    getTs: () => overrides.ts ?? 0,
    getContent: () => overrides.content ?? {},
    getRelation: () => (overrides.content as Record<string, unknown>)?.[MatrixContentField.RELATES_TO],
    sender: { userId: sender }
  } as unknown as MatrixEvent
}

type RoomOverrides = {
  findEventById?: (id: string) => MatrixEvent | null
}

/** 创建模拟 Room 对象 */
function createRoom(events: MatrixEvent[], overrides: RoomOverrides = {}) {
  return {
    timeline: events,
    findEventById: overrides.findEventById ?? ((id: string) => events.find((e) => e.getId() === id) ?? null),
    getUnfilteredTimelineSet: () => ({
      getLiveTimeline: () => ({
        getEvents: () => events
      })
    })
  }
}

type ClientOverrides = {
  getRoom?: (id: string) => ReturnType<typeof createRoom> | null
  relations?: (
    roomId: string,
    eventId: string,
    relType: string | null,
    relationKey: unknown,
    opts: Record<string, unknown>
  ) => Promise<{ events: Array<{ event: unknown }>; nextBatch?: string; prevBatch?: string }>
}

/** 创建模拟 MatrixClient 对象 */
function createClient(overrides: ClientOverrides = {}): MatrixClient {
  return {
    getRoom: overrides.getRoom ?? (() => createRoom([])),
    relations:
      overrides.relations ??
      (async () => ({
        events: []
      }))
  } as unknown as MatrixClient
}

/** 编辑事件工厂：生成指向 targetId 的 m.replace 编辑 */
function createEditEvent(overrides: { id: string; targetId: string; ts: number; sender?: string; body?: string }) {
  return createEvent({
    id: overrides.id,
    ts: overrides.ts,
    sender: overrides.sender,
    content: {
      body: overrides.body ?? '新内容',
      msgtype: 'm.text',
      [MatrixContentField.RELATES_TO]: {
        rel_type: 'm.replace',
        event_id: overrides.targetId
      },
      'm.new_content': { body: overrides.body ?? '新内容', msgtype: 'm.text' }
    }
  })
}

describe('createRelationQueries', () => {
  describe('getEditHistory', () => {
    it('返回目标事件的编辑历史并按时间升序排列', () => {
      const edit1 = createEditEvent({ id: '$e1', targetId: '$origin', ts: 100, body: '第一版' })
      const edit2 = createEditEvent({ id: '$e2', targetId: '$origin', ts: 300, body: '第二版' })
      const room = createRoom([edit2, createEvent({ id: '$other' }), edit1])
      const queries = createRelationQueries(() => createClient({ getRoom: () => room }))

      const result = queries.getEditHistory('!room:server', '$origin')
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ eventId: '$e1', timestamp: 100, sender: '@u:server.com' })
      expect(result[0].newContent).toEqual({ body: '第一版', msgtype: 'm.text' })
      expect(result[1].eventId).toBe('$e2')
    })

    it('忽略非 m.replace 或指向其他事件的关系', () => {
      const edit = createEditEvent({ id: '$e1', targetId: '$origin', ts: 100 })
      const other = createEvent({
        id: '$other',
        content: {
          [MatrixContentField.RELATES_TO]: { rel_type: 'm.thread', event_id: '$origin' }
        }
      })
      const room = createRoom([edit, other])
      const queries = createRelationQueries(() => createClient({ getRoom: () => room }))

      expect(queries.getEditHistory('!room:server', '$origin')).toHaveLength(1)
    })

    it('当没有编辑时返回空数组', () => {
      const room = createRoom([createEvent({ id: '$normal' })])
      const queries = createRelationQueries(() => createClient({ getRoom: () => room }))

      expect(queries.getEditHistory('!room:server', '$origin')).toEqual([])
    })

    it('当 client 为 null 时返回空数组', () => {
      const queries = createRelationQueries(() => null)
      expect(queries.getEditHistory('!room:server', '$origin')).toEqual([])
    })

    it('当 room 不存在时返回空数组', () => {
      const queries = createRelationQueries(() => createClient({ getRoom: () => null }))
      expect(queries.getEditHistory('!room:server', '$origin')).toEqual([])
    })
  })

  describe('getLatestEdit', () => {
    it('返回时间戳最大的编辑事件', () => {
      const edit1 = createEditEvent({ id: '$e1', targetId: '$origin', ts: 100 })
      const edit2 = createEditEvent({ id: '$e2', targetId: '$origin', ts: 300 })
      const room = createRoom([edit1, edit2])
      const queries = createRelationQueries(() => createClient({ getRoom: () => room }))

      expect(queries.getLatestEdit('!room:server', '$origin')).toBe(edit2)
    })

    it('当没有编辑时返回 null', () => {
      const room = createRoom([createEvent({ id: '$normal' })])
      const queries = createRelationQueries(() => createClient({ getRoom: () => room }))

      expect(queries.getLatestEdit('!room:server', '$origin')).toBeNull()
    })

    it('当 client 为 null 时返回 null', () => {
      const queries = createRelationQueries(() => null)
      expect(queries.getLatestEdit('!room:server', '$origin')).toBeNull()
    })
  })

  describe('getReplyChain', () => {
    it('沿 m.in_reply_to 回溯构建回复链', () => {
      const root = createEvent({
        id: '$root',
        content: { body: '根消息' }
      })
      const mid = createEvent({
        id: '$mid',
        content: {
          body: '中间回复',
          [MatrixContentField.RELATES_TO]: { 'm.in_reply_to': { event_id: '$root' } }
        }
      })
      const latest = createEvent({
        id: '$latest',
        content: {
          body: '最新回复',
          [MatrixContentField.RELATES_TO]: { 'm.in_reply_to': { event_id: '$mid' } }
        }
      })
      const room = createRoom([latest, mid, root])
      const queries = createRelationQueries(() => createClient({ getRoom: () => room }))

      const result = queries.getReplyChain('!room:server', '$latest')
      expect(result.map((c) => c.eventId)).toEqual(['$latest', '$mid', '$root'])
    })

    it('受 maxDepth 限制链的长度', () => {
      const root = createEvent({ id: '$root', content: { body: '根' } })
      const mid = createEvent({
        id: '$mid',
        content: { [MatrixContentField.RELATES_TO]: { 'm.in_reply_to': { event_id: '$root' } } }
      })
      const latest = createEvent({
        id: '$latest',
        content: { [MatrixContentField.RELATES_TO]: { 'm.in_reply_to': { event_id: '$mid' } } }
      })
      const room = createRoom([latest, mid, root])
      const queries = createRelationQueries(() => createClient({ getRoom: () => room }))

      const result = queries.getReplyChain('!room:server', '$latest', 1)
      expect(result.map((c) => c.eventId)).toEqual(['$latest'])
    })

    it('当起始事件不存在时返回空数组', () => {
      const room = createRoom([createEvent({ id: '$a' })])
      const queries = createRelationQueries(() => createClient({ getRoom: () => room }))

      expect(queries.getReplyChain('!room:server', '$missing')).toEqual([])
    })

    it('当 client 为 null 时返回空数组', () => {
      const queries = createRelationQueries(() => null)
      expect(queries.getReplyChain('!room:server', '$latest')).toEqual([])
    })
  })

  describe('getThreadReplies', () => {
    it('返回指向线程根事件的回复并按时间升序排列', () => {
      const reply1 = createEvent({
        id: '$r1',
        ts: 100,
        content: { [MatrixContentField.RELATES_TO]: { rel_type: 'm.thread', event_id: '$root' } }
      })
      const reply2 = createEvent({
        id: '$r2',
        ts: 200,
        content: { [MatrixContentField.RELATES_TO]: { rel_type: 'm.thread', event_id: '$root' } }
      })
      const other = createEvent({
        id: '$other',
        content: { [MatrixContentField.RELATES_TO]: { rel_type: 'm.thread', event_id: '$otherRoot' } }
      })
      const room = createRoom([reply2, other, reply1])
      const queries = createRelationQueries(() => createClient({ getRoom: () => room }))

      const result = queries.getThreadReplies('!room:server', '$root')
      expect(result).toEqual([reply1, reply2])
    })

    it('当没有线程回复时返回空数组', () => {
      const room = createRoom([createEvent({ id: '$a' })])
      const queries = createRelationQueries(() => createClient({ getRoom: () => room }))

      expect(queries.getThreadReplies('!room:server', '$root')).toEqual([])
    })

    it('当 client 为 null 时返回空数组', () => {
      const queries = createRelationQueries(() => null)
      expect(queries.getThreadReplies('!room:server', '$root')).toEqual([])
    })
  })

  describe('getThreadInfo', () => {
    it('返回线程的回复数、参与者和最后回复', () => {
      const root = createEvent({
        id: '$root',
        sender: '@alice:server',
        content: { body: '根' }
      })
      const reply1 = createEvent({
        id: '$r1',
        sender: '@bob:server',
        ts: 100,
        content: { [MatrixContentField.RELATES_TO]: { rel_type: 'm.thread', event_id: '$root' } }
      })
      const reply2 = createEvent({
        id: '$r2',
        sender: '@alice:server',
        ts: 200,
        content: { [MatrixContentField.RELATES_TO]: { rel_type: 'm.thread', event_id: '$root' } }
      })
      const room = createRoom([root, reply1, reply2])
      const queries = createRelationQueries(() => createClient({ getRoom: () => room }))

      const result = queries.getThreadInfo('!room:server', '$root')
      expect(result).toMatchObject({
        threadId: '$root',
        rootEventId: '$root',
        replyCount: 2,
        participants: ['@bob:server', '@alice:server'],
        lastReply: { eventId: '$r2', sender: '@alice:server', timestamp: 200 }
      })
    })

    it('当线程根事件不存在时返回 null', () => {
      const room = createRoom([createEvent({ id: '$a' })])
      const queries = createRelationQueries(() => createClient({ getRoom: () => room }))

      expect(queries.getThreadInfo('!room:server', '$missing')).toBeNull()
    })

    it('当 client 为 null 时返回 null', () => {
      const queries = createRelationQueries(() => null)
      expect(queries.getThreadInfo('!room:server', '$root')).toBeNull()
    })
  })

  describe('getEventReplies', () => {
    it('返回 m.in_reply_to 指向目标事件的事件并按时间升序排列', () => {
      const reply1 = createEvent({
        id: '$r1',
        ts: 100,
        content: { [MatrixContentField.RELATES_TO]: { 'm.in_reply_to': { event_id: '$target' } } }
      })
      const reply2 = createEvent({
        id: '$r2',
        ts: 200,
        content: { [MatrixContentField.RELATES_TO]: { 'm.in_reply_to': { event_id: '$target' } } }
      })
      const other = createEvent({
        id: '$other',
        content: { [MatrixContentField.RELATES_TO]: { 'm.in_reply_to': { event_id: '$other' } } }
      })
      const room = createRoom([reply2, other, reply1])
      const queries = createRelationQueries(() => createClient({ getRoom: () => room }))

      const result = queries.getEventReplies('!room:server', '$target')
      expect(result).toEqual([reply1, reply2])
    })

    it('当没有回复时返回空数组', () => {
      const room = createRoom([createEvent({ id: '$a' })])
      const queries = createRelationQueries(() => createClient({ getRoom: () => room }))

      expect(queries.getEventReplies('!room:server', '$target')).toEqual([])
    })
  })

  describe('fetchRelations', () => {
    it('映射 relations 结果到 RelationsResponse', async () => {
      const relations = vi.fn(async () => ({
        events: [{ event: { event_id: '$r1' } }, { event: { event_id: '$r2' } }],
        nextBatch: 'next-token'
      }))
      const client = createClient({ relations })
      const queries = createRelationQueries(() => client)

      const result = await queries.fetchRelations('!room:server', '$target')
      expect(result).toEqual({
        chunk: [{ event_id: '$r1' }, { event_id: '$r2' }],
        next_batch: 'next-token'
      })
      expect(relations).toHaveBeenCalledWith('!room:server', '$target', null, null, {})
    })

    it('将 dir=b 映射为 Direction.Backward 并透传 limit', async () => {
      const relations = vi.fn(
        async (
          _roomId: string,
          _eventId: string,
          _relType: string | null,
          _key: unknown,
          _opts: Record<string, unknown>
        ) => ({ events: [] })
      )
      const client = createClient({ relations })
      const queries = createRelationQueries(() => client)

      await queries.fetchRelations('!room:server', '$target', { limit: 5, dir: 'b' })
      const opts = relations.mock.calls[0][4]
      expect(opts.limit).toBe(5)
      expect(opts.dir).toBe('b')
    })

    it('将 dir=f 映射为 Direction.Forward', async () => {
      const relations = vi.fn(
        async (
          _roomId: string,
          _eventId: string,
          _relType: string | null,
          _key: unknown,
          _opts: Record<string, unknown>
        ) => ({ events: [] })
      )
      const client = createClient({ relations })
      const queries = createRelationQueries(() => client)

      await queries.fetchRelations('!room:server', '$target', { dir: 'f' })
      expect(relations.mock.calls[0][4].dir).toBe('f')
    })

    it('当 relations 抛错时返回 null', async () => {
      const relations = vi.fn(async () => {
        throw new Error('network')
      })
      const client = createClient({ relations })
      const queries = createRelationQueries(() => client)

      await expect(queries.fetchRelations('!room:server', '$target')).resolves.toBeNull()
    })

    it('当 client 为 null 时返回 null', async () => {
      const queries = createRelationQueries(() => null)
      await expect(queries.fetchRelations('!room:server', '$target')).resolves.toBeNull()
    })
  })

  describe('fetchRelationsByType', () => {
    it('按类型调用 relations 并映射结果', async () => {
      const relations = vi.fn(async () => ({
        events: [{ event: { event_id: '$r1' } }],
        prevBatch: 'prev-token'
      }))
      const client = createClient({ relations })
      const queries = createRelationQueries(() => client)

      const result = await queries.fetchRelationsByType('!room:server', '$target', MatrixRelType.THREAD)
      expect(result).toEqual({
        chunk: [{ event_id: '$r1' }],
        prev_batch: 'prev-token'
      })
      expect(relations).toHaveBeenCalledWith('!room:server', '$target', 'm.thread', null, {})
    })

    it('当 relations 抛错时返回 null', async () => {
      const relations = vi.fn(async () => {
        throw new Error('network')
      })
      const client = createClient({ relations })
      const queries = createRelationQueries(() => client)

      await expect(queries.fetchRelationsByType('!room:server', '$target', MatrixRelType.REPLACES)).resolves.toBeNull()
    })
  })
})
