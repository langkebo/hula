import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatrixContentField, MatrixRelType } from '@/common/matrixConstants'
import matrixClientService from '../../MatrixClientService'
import type { MatrixClient, MatrixEvent, Room } from '../../sdk'
import { matrixReceiptService } from '../MatrixReceiptService'
import { MatrixThreadState } from '../MatrixThreadState'

vi.mock('../MatrixReceiptService', () => ({
  matrixReceiptService: {
    sendReadReceiptByEventId: vi.fn()
  }
}))

type EventOverrides = {
  id?: string
  sender?: string | undefined
  ts?: number
  roomId?: string
  content?: Record<string, unknown>
}

/** 创建模拟 MatrixEvent 对象 */
function createEvent(overrides: EventOverrides = {}): MatrixEvent {
  const sender = overrides.sender ?? '@u:server.com'
  return {
    getId: () => overrides.id ?? '$evt',
    getSender: () => sender,
    getTs: () => overrides.ts ?? 0,
    getRoomId: () => overrides.roomId ?? '!room:server.com',
    getContent: () => overrides.content ?? {}
  } as unknown as MatrixEvent
}

/** 构建一个引用了 threadRootId 的线程回复事件 */
function createThreadReplyEvent(overrides: {
  id: string
  sender?: string
  threadRootId: string
  extra?: Record<string, unknown>
}) {
  return createEvent({
    id: overrides.id,
    sender: overrides.sender,
    content: {
      body: 'reply',
      [MatrixContentField.RELATES_TO]: {
        rel_type: MatrixRelType.THREAD,
        event_id: overrides.threadRootId
      },
      ...(overrides.extra ?? {})
    }
  })
}

/** 创建模拟 Room 对象，timeline 由 events 提供 */
function createRoom(
  events: MatrixEvent[],
  overrides: { getEventReadUpTo?: (userId: string, ignore: boolean) => string | null } = {}
): Room {
  return {
    getUnfilteredTimelineSet: () => ({
      getLiveTimeline: () => ({
        getEvents: () => events
      })
    }),
    getEventReadUpTo: overrides.getEventReadUpTo ?? (() => null)
  } as unknown as Room
}

type ClientOverrides = {
  getRoom?: (roomId: string) => Room | null
  getRooms?: () => Room[]
  getUserId?: () => string | null
  sendEvent?: (roomId: string, type: string, content: Record<string, unknown>) => Promise<unknown>
}

/** 创建模拟 MatrixClient 对象 */
function createClient(overrides: ClientOverrides = {}): MatrixClient {
  return {
    getRoom: overrides.getRoom ?? (() => null),
    getRooms: overrides.getRooms ?? (() => []),
    getUserId: overrides.getUserId ?? (() => '@me:server.com'),
    sendEvent: overrides.sendEvent ?? (async () => ({}))
  } as unknown as MatrixClient
}

describe('MatrixThreadState', () => {
  let state: MatrixThreadState
  let mockClient: MatrixClient
  let fetchThreadReplies: ReturnType<typeof vi.fn<(roomId: string, threadRootId: string) => MatrixEvent[]>>
  let sendReadReceiptByEventId: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchThreadReplies = vi.fn<(roomId: string, threadRootId: string) => MatrixEvent[]>(() => [])
    sendReadReceiptByEventId = (
      matrixReceiptService.sendReadReceiptByEventId as ReturnType<typeof vi.fn>
    ).mockResolvedValue(undefined)
    state = new MatrixThreadState(fetchThreadReplies)
    mockClient = createClient()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient)
  })

  describe('isThreadRoot', () => {
    it('should return true when a timeline event references the event as thread root', () => {
      const timelineEvents = [createThreadReplyEvent({ id: '$reply', threadRootId: '$root' })]
      vi.spyOn(mockClient, 'getRoom').mockReturnValue(createRoom(timelineEvents))
      const event = createEvent({ id: '$root', roomId: '!room' })

      expect(state.isThreadRoot(event)).toBe(true)
    })

    it('should return false when no timeline event references the event', () => {
      vi.spyOn(mockClient, 'getRoom').mockReturnValue(createRoom([]))
      const event = createEvent({ id: '$root', roomId: '!room' })

      expect(state.isThreadRoot(event)).toBe(false)
    })

    it('should return false when client is unavailable', () => {
      vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null as unknown as MatrixClient)
      expect(state.isThreadRoot(createEvent())).toBe(false)
    })

    it('should return false when room is missing', () => {
      vi.spyOn(mockClient, 'getRoom').mockReturnValue(null)
      const event = createEvent({ id: '$root', roomId: '!room' })

      expect(state.isThreadRoot(event)).toBe(false)
    })

    it('should return false when event has no id', () => {
      vi.spyOn(mockClient, 'getRoom').mockReturnValue(
        createRoom([createThreadReplyEvent({ id: '$reply', threadRootId: '$root' })])
      )
      const event = createEvent({ id: '', roomId: '!room' })

      expect(state.isThreadRoot(event)).toBe(false)
    })
  })

  describe('isInThread', () => {
    it('should return true for event with thread relation', () => {
      const event = createThreadReplyEvent({ id: '$r', threadRootId: '$root' })
      expect(state.isInThread(event)).toBe(true)
    })

    it('should return false for plain event', () => {
      const event = createEvent({ content: { body: 'hi' } })
      expect(state.isInThread(event)).toBe(false)
    })

    it('should return false for event with non-thread relation', () => {
      const event = createEvent({
        content: {
          [MatrixContentField.RELATES_TO]: { rel_type: 'm.replace', event_id: '$target' }
        }
      })
      expect(state.isInThread(event)).toBe(false)
    })
  })

  describe('isBodyInThread', () => {
    it('should return true for body with thread relation', () => {
      const body = { [MatrixContentField.RELATES_TO]: { rel_type: MatrixRelType.THREAD, event_id: '$root' } }
      expect(state.isBodyInThread(body)).toBe(true)
    })

    it('should return false for body without thread relation', () => {
      const body = { [MatrixContentField.RELATES_TO]: { rel_type: 'm.replace' } }
      expect(state.isBodyInThread(body)).toBe(false)
    })

    it('should return false for body without relates_to', () => {
      expect(state.isBodyInThread({ body: 'hi' })).toBe(false)
    })
  })

  describe('getThreadRootId', () => {
    it('should return root event id for thread event', () => {
      const event = createThreadReplyEvent({ id: '$r', threadRootId: '$root' })
      expect(state.getThreadRootId(event)).toBe('$root')
    })

    it('should return null for plain event', () => {
      expect(state.getThreadRootId(createEvent({ content: { body: 'hi' } }))).toBeNull()
    })

    it('should return null when thread event has no event_id', () => {
      const event = createEvent({
        content: { [MatrixContentField.RELATES_TO]: { rel_type: MatrixRelType.THREAD } }
      })
      expect(state.getThreadRootId(event)).toBeNull()
    })
  })

  describe('getThreadNotificationCount', () => {
    it('should count unread replies from others up to read receipt', async () => {
      vi.spyOn(mockClient, 'getRoom').mockReturnValue(createRoom([], { getEventReadUpTo: () => '$read' }))
      vi.spyOn(mockClient, 'getUserId').mockReturnValue('@me:server.com')
      fetchThreadReplies.mockReturnValue([
        createEvent({ id: '$r1', sender: '@other:server.com' }),
        createEvent({ id: '$read', sender: '@me:server.com' }),
        createEvent({ id: '$r2', sender: '@other:server.com' })
      ])

      const count = await state.getThreadNotificationCount('!room', '$root')

      // 遍历到 $read 即 break，$r1（他人）计数为 1
      expect(count).toBe(1)
    })

    it('should skip own replies', async () => {
      vi.spyOn(mockClient, 'getRoom').mockReturnValue(createRoom([], { getEventReadUpTo: () => null }))
      vi.spyOn(mockClient, 'getUserId').mockReturnValue('@me:server.com')
      fetchThreadReplies.mockReturnValue([
        createEvent({ id: '$r1', sender: '@me:server.com' }),
        createEvent({ id: '$r2', sender: '@me:server.com' })
      ])

      expect(await state.getThreadNotificationCount('!room', '$root')).toBe(0)
    })

    it('should return 0 when client unavailable', async () => {
      vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null as unknown as MatrixClient)
      expect(await state.getThreadNotificationCount('!room', '$root')).toBe(0)
    })

    it('should return 0 when room missing', async () => {
      vi.spyOn(mockClient, 'getRoom').mockReturnValue(null)
      expect(await state.getThreadNotificationCount('!room', '$root')).toBe(0)
    })

    it('should return 0 when user id missing', async () => {
      vi.spyOn(mockClient, 'getRoom').mockReturnValue(createRoom([]))
      vi.spyOn(mockClient, 'getUserId').mockReturnValue(null)
      expect(await state.getThreadNotificationCount('!room', '$root')).toBe(0)
    })
  })

  describe('markThreadAsRead', () => {
    it('should send read receipt for last reply', async () => {
      fetchThreadReplies.mockReturnValue([
        createEvent({ id: '$r1', sender: '@o:server.com' }),
        createEvent({ id: '$r2', sender: '@o:server.com' })
      ])

      await state.markThreadAsRead('!room', '$root')

      expect(sendReadReceiptByEventId).toHaveBeenCalledWith('!room', '$r2')
    })

    it('should do nothing when there are no replies', async () => {
      fetchThreadReplies.mockReturnValue([])

      await state.markThreadAsRead('!room', '$root')

      expect(sendReadReceiptByEventId).not.toHaveBeenCalled()
    })
  })
})
