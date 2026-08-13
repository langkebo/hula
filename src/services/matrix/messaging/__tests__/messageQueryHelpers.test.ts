import { describe, expect, it } from 'vitest'
import { MatrixEventType } from '@/common/matrixConstants'
import type { MatrixClient, MatrixEvent } from '../../sdk'
import {
  findEventByIdAcrossRooms,
  getMessageEvents,
  getMessageList,
  getMsgList,
  getMsgListByIds,
  getRoomMessage,
  getUnreadMessages
} from '../messageQueryHelpers'

type EventOverrides = {
  id?: string
  sender?: string
  ts?: number
  type?: string
  content?: Record<string, unknown>
  relation?: { event_id?: string; rel_type?: string; 'm.in_reply_to'?: { event_id?: string } }
}

/** 创建模拟 MatrixEvent 对象 */
function createEvent(overrides: EventOverrides = {}): MatrixEvent {
  const sender = overrides.sender ?? '@u:server.com'
  return {
    getId: () => overrides.id ?? '$evt',
    getSender: () => sender,
    getTs: () => overrides.ts ?? 0,
    getType: () => overrides.type ?? MatrixEventType.ROOM_MESSAGE,
    getContent: () => overrides.content ?? {},
    getRelation: () => overrides.relation,
    event: overrides.content ?? {},
    sender: { userId: sender }
  } as unknown as MatrixEvent
}

type RoomOverrides = {
  id?: string
  findEventById?: (id: string) => MatrixEvent | null
  hasUserReadEvent?: (userId: string, eventId: string) => boolean
}

/** 创建模拟 Room 对象 */
function createRoom(events: MatrixEvent[], overrides: RoomOverrides = {}) {
  return {
    id: overrides.id ?? '!room:server.com',
    timeline: events,
    findEventById: overrides.findEventById ?? ((id: string) => events.find((e) => e.getId() === id) ?? null),
    hasUserReadEvent: overrides.hasUserReadEvent ?? (() => false),
    getUnfilteredTimelineSet: () => ({
      getLiveTimeline: () => ({
        getEvents: () => events
      })
    })
  }
}

type ClientOverrides = {
  rooms?: ReturnType<typeof createRoom>[]
  getRoom?: (id: string) => ReturnType<typeof createRoom> | null
  getUserId?: () => string
  http?: { authedRequest: (method: string, path: string, params: Record<string, unknown>) => Promise<unknown> }
}

/** 创建模拟 MatrixClient 对象 */
function createClient(overrides: ClientOverrides = {}): MatrixClient {
  const rooms = overrides.rooms ?? []
  return {
    getRooms: () => rooms,
    getRoom: overrides.getRoom ?? ((id: string) => rooms.find((r) => r.id === id) ?? null),
    getUserId: overrides.getUserId ?? (() => '@me:server.com'),
    http: overrides.http ?? { authedRequest: async () => ({ chunk: [] }) }
  } as unknown as MatrixClient
}

describe('messageQueryHelpers', () => {
  describe('findEventByIdAcrossRooms', () => {
    it('在任一房间中找到目标事件时返回该事件', () => {
      const target = createEvent({ id: '$target' })
      const roomA = createRoom([createEvent({ id: '$a' })], { id: '!a:server' })
      const roomB = createRoom([createEvent({ id: '$b' }), target], { id: '!b:server' })
      const client = createClient({ rooms: [roomA, roomB] })

      expect(findEventByIdAcrossRooms(client, '$target')).toBe(target)
    })

    it('当所有房间都找不到时返回 null', () => {
      const roomA = createRoom([createEvent({ id: '$a' })], { id: '!a:server' })
      const client = createClient({ rooms: [roomA] })

      expect(findEventByIdAcrossRooms(client, '$missing')).toBeNull()
    })

    it('当没有房间时返回 null', () => {
      const client = createClient({ rooms: [] })
      expect(findEventByIdAcrossRooms(client, '$target')).toBeNull()
    })
  })

  describe('getMessageEvents', () => {
    it('无选项时返回房间 timeline 全部事件', async () => {
      const events = [createEvent({ id: '$1' }), createEvent({ id: '$2' })]
      const room = createRoom(events)
      const client = createClient({ rooms: [room] })

      const result = await getMessageEvents(client, room.id)
      expect(result).toEqual(events)
    })

    it('按 limit 截断返回的事件数量', async () => {
      const events = [createEvent({ id: '$1' }), createEvent({ id: '$2' }), createEvent({ id: '$3' })]
      const room = createRoom(events)
      const client = createClient({ rooms: [room] })

      const result = await getMessageEvents(client, room.id, { limit: 2 })
      expect(result).toEqual([events[0], events[1]])
    })

    it('按 sender 过滤事件', async () => {
      const events = [
        createEvent({ id: '$1', sender: '@alice:server' }),
        createEvent({ id: '$2', sender: '@bob:server' })
      ]
      const room = createRoom(events)
      const client = createClient({ rooms: [room] })

      const result = await getMessageEvents(client, room.id, { sender: '@alice:server' })
      expect(result).toEqual([events[0]])
    })

    it('当房间不存在时返回空数组', async () => {
      const client = createClient({ rooms: [] })
      const result = await getMessageEvents(client, '!missing:server')
      expect(result).toEqual([])
    })

    it('当 timeline 为空时返回空数组', async () => {
      const room = createRoom([])
      const client = createClient({ rooms: [room] })
      const result = await getMessageEvents(client, room.id)
      expect(result).toEqual([])
    })
  })

  describe('getRoomMessage', () => {
    it('找到目标事件时返回该事件', async () => {
      const target = createEvent({ id: '$target' })
      const room = createRoom([target])
      const client = createClient({ rooms: [room] })

      const result = await getRoomMessage(client, room.id, '$target')
      expect(result).toBe(target)
    })

    it('当房间不存在时返回 null', async () => {
      const client = createClient({ rooms: [] })
      const result = await getRoomMessage(client, '!missing:server', '$target')
      expect(result).toBeNull()
    })

    it('当事件不存在时返回 null', async () => {
      const room = createRoom([createEvent({ id: '$a' })])
      const client = createClient({ rooms: [room] })

      const result = await getRoomMessage(client, room.id, '$missing')
      expect(result).toBeNull()
    })
  })

  describe('getUnreadMessages', () => {
    it('返回他人发送且未读的 m.room.message 事件', async () => {
      const unread = createEvent({ id: '$1', sender: '@alice:server', ts: 100 })
      const room = createRoom([unread, createEvent({ id: '$2', sender: '@bob:server', ts: 200 })])
      const client = createClient({ rooms: [room], getUserId: () => '@me:server' })

      const result = await getUnreadMessages(client, room.id)
      expect(result).toEqual([unread, room.timeline[1]])
    })

    it('排除自己发送的事件', async () => {
      const mine = createEvent({ id: '$mine', sender: '@me:server' })
      const room = createRoom([mine])
      const client = createClient({ rooms: [room], getUserId: () => '@me:server' })

      const result = await getUnreadMessages(client, room.id)
      expect(result).toEqual([])
    })

    it('排除已读的事件', async () => {
      const event = createEvent({ id: '$1', sender: '@alice:server' })
      const room = createRoom([event], { hasUserReadEvent: () => true })
      const client = createClient({ rooms: [room], getUserId: () => '@me:server' })

      const result = await getUnreadMessages(client, room.id)
      expect(result).toEqual([])
    })

    it('排除非 m.room.message 类型的事件', async () => {
      const event = createEvent({ id: '$1', sender: '@alice:server', type: 'm.room.name' })
      const room = createRoom([event])
      const client = createClient({ rooms: [room], getUserId: () => '@me:server' })

      const result = await getUnreadMessages(client, room.id)
      expect(result).toEqual([])
    })

    it('当房间不存在时返回空数组', async () => {
      const client = createClient({ rooms: [] })
      const result = await getUnreadMessages(client, '!missing:server')
      expect(result).toEqual([])
    })

    it('当 timeline 为空时返回空数组', async () => {
      const room = createRoom([])
      const client = createClient({ rooms: [room], getUserId: () => '@me:server' })

      const result = await getUnreadMessages(client, room.id)
      expect(result).toEqual([])
    })
  })

  describe('getMessageList', () => {
    it('当房间不存在时返回空列表与 hasMore=false', async () => {
      const client = createClient({ rooms: [] })
      const result = await getMessageList({ roomId: '!missing:server' }, client)
      expect(result).toEqual({ events: [], hasMore: false })
    })

    it('无分页选项时返回前 limit 条事件且 hasMore=false', async () => {
      const events = [createEvent({ id: '$1' }), createEvent({ id: '$2' })]
      const room = createRoom(events)
      const client = createClient({ rooms: [room] })

      const result = await getMessageList({ roomId: room.id }, client)
      expect(result.events).toEqual(events)
      expect(result.hasMore).toBe(false)
    })

    it('按 limit 截断返回的事件数量', async () => {
      const events = [createEvent({ id: '$1' }), createEvent({ id: '$2' }), createEvent({ id: '$3' })]
      const room = createRoom(events)
      const client = createClient({ rooms: [room] })

      const result = await getMessageList({ roomId: room.id, limit: 2 }, client)
      expect(result.events).toEqual([events[0], events[1]])
    })

    it('按 sender 过滤事件', async () => {
      const events = [
        createEvent({ id: '$1', sender: '@alice:server' }),
        createEvent({ id: '$2', sender: '@bob:server' })
      ]
      const room = createRoom(events)
      const client = createClient({ rooms: [room] })

      const result = await getMessageList({ roomId: room.id, sender: '@bob:server' }, client)
      expect(result.events).toEqual([events[1]])
    })

    it('按 type 过滤事件', async () => {
      const events = [
        createEvent({ id: '$1', type: MatrixEventType.ROOM_MESSAGE }),
        createEvent({ id: '$2', type: 'm.room.name' })
      ]
      const room = createRoom(events)
      const client = createClient({ rooms: [room] })

      const result = await getMessageList({ roomId: room.id, type: 'm.room.name' }, client)
      expect(result.events).toEqual([events[1]])
    })

    it('按 threadId 过滤线程回复事件', async () => {
      const threadReply = createEvent({
        id: '$reply',
        relation: { rel_type: 'm.thread', event_id: '$root' }
      })
      const normal = createEvent({ id: '$normal' })
      const room = createRoom([threadReply, normal])
      const client = createClient({ rooms: [room] })

      const result = await getMessageList({ roomId: room.id, threadId: '$root' }, client)
      expect(result.events).toEqual([threadReply])
    })

    it('before 分页返回目标事件之前的事件且 hasMore=true', async () => {
      const events = [
        createEvent({ id: '$1' }),
        createEvent({ id: '$2' }),
        createEvent({ id: '$3' }),
        createEvent({ id: '$4' })
      ]
      const room = createRoom(events)
      const client = createClient({ rooms: [room] })

      const result = await getMessageList({ roomId: room.id, limit: 2, before: '$4' }, client)
      expect(result.events).toEqual([events[1], events[2]])
      expect(result.hasMore).toBe(true)
    })

    it('before 的 beforeIndex 为 0 时返回空分页段且 hasMore=false', async () => {
      const events = [createEvent({ id: '$1' }), createEvent({ id: '$2' }), createEvent({ id: '$3' })]
      const room = createRoom(events)
      const client = createClient({ rooms: [room] })

      const result = await getMessageList({ roomId: room.id, limit: 2, before: '$1' }, client)
      expect(result.events).toEqual([events[0], events[1]])
      expect(result.hasMore).toBe(false)
    })

    it('before 事件不在本地且本地不足 limit 时从服务端拉取并前置原始 chunk', async () => {
      const events = [createEvent({ id: '$1' }), createEvent({ id: '$2' })]
      const rawServer = [{ event_id: '$s1' }, { event_id: '$s2' }]
      const http = {
        authedRequest: async () => ({ chunk: rawServer })
      }
      const room = createRoom(events)
      const client = createClient({ rooms: [room], http })

      const result = await getMessageList({ roomId: room.id, limit: 5, before: '$missing' }, client)
      expect(result.events).toEqual([...rawServer, ...events])
      expect(result.hasMore).toBe(false)
    })

    it('after 分页返回目标事件之后的事件且 hasMore=true', async () => {
      const events = [
        createEvent({ id: '$1' }),
        createEvent({ id: '$2' }),
        createEvent({ id: '$3' }),
        createEvent({ id: '$4' }),
        createEvent({ id: '$5' }),
        createEvent({ id: '$6' })
      ]
      const room = createRoom(events)
      const client = createClient({ rooms: [room] })

      const result = await getMessageList({ roomId: room.id, limit: 2, after: '$1' }, client)
      expect(result.events).toEqual([events[1], events[2]])
      expect(result.hasMore).toBe(true)
    })

    it('after 事件不在本地且本地不足 limit 时从服务端拉取并后置原始 chunk', async () => {
      const events = [createEvent({ id: '$1' }), createEvent({ id: '$2' })]
      const rawServer = [{ event_id: '$s1' }]
      const http = {
        authedRequest: async () => ({ chunk: rawServer })
      }
      const room = createRoom(events)
      const client = createClient({ rooms: [room], http })

      const result = await getMessageList({ roomId: room.id, limit: 5, after: '$missing' }, client)
      expect(result.events).toEqual([...events, ...rawServer])
      expect(result.hasMore).toBe(false)
    })
  })

  describe('getMsgList', () => {
    it('当房间不存在时返回空数组', async () => {
      const client = createClient({ rooms: [] })
      const result = await getMsgList(client, '!missing:server')
      expect(result).toEqual([])
    })

    it('返回 timeline 前 limit 条事件', async () => {
      const events = [createEvent({ id: '$1' }), createEvent({ id: '$2' }), createEvent({ id: '$3' })]
      const room = createRoom(events)
      const client = createClient({ rooms: [room] })

      const result = await getMsgList(client, room.id, 2)
      expect(result).toEqual([events[0], events[1]])
    })

    it('按 sender 过滤事件', async () => {
      const events = [
        createEvent({ id: '$1', sender: '@alice:server' }),
        createEvent({ id: '$2', sender: '@bob:server' })
      ]
      const room = createRoom(events)
      const client = createClient({ rooms: [room] })

      const result = await getMsgList(client, room.id, 20, { sender: '@alice:server' })
      expect(result).toEqual([events[0]])
    })

    it('按 type 过滤事件', async () => {
      const events = [
        createEvent({ id: '$1', type: MatrixEventType.ROOM_MESSAGE }),
        createEvent({ id: '$2', type: 'm.room.name' })
      ]
      const room = createRoom(events)
      const client = createClient({ rooms: [room] })

      const result = await getMsgList(client, room.id, 20, { type: 'm.room.name' })
      expect(result).toEqual([events[1]])
    })
  })

  describe('getMsgListByIds', () => {
    it('按 msgIds 列表在多个房间中查找并返回命中事件', async () => {
      const target = createEvent({ id: '$target' })
      const roomA = createRoom([createEvent({ id: '$a' })], { id: '!a:server' })
      const roomB = createRoom([createEvent({ id: '$b' }), target], { id: '!b:server' })
      const client = createClient({ rooms: [roomA, roomB] })

      const result = await getMsgListByIds(client, { msgIds: ['$a', '$target', '$missing'] })
      expect(result).toEqual([roomA.timeline[0], target])
    })

    it('msgIds 为空数组时返回空数组', async () => {
      const client = createClient({ rooms: [] })
      const result = await getMsgListByIds(client, { msgIds: [] })
      expect(result).toEqual([])
    })

    it('传入字符串时委托给 getMsgList', async () => {
      const events = [createEvent({ id: '$1' }), createEvent({ id: '$2' })]
      const room = createRoom(events)
      const client = createClient({ rooms: [room] })

      const result = await getMsgListByIds(client, '!room:server.com', 1)
      expect(result).toEqual([events[0]])
    })
  })
})
