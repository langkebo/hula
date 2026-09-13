import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatrixContentField, MatrixRelType } from '@/common/matrixConstants'
import matrixClientService from '../../MatrixClientService'
import type { MatrixClient, MatrixEvent, Room } from '../../sdk'
import type { ThreadingManagerCompat } from '../threadTypes'
import { buildDisplayMessage, getThreadingManager } from '../threadUtils'

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
    getContent: () => overrides.content ?? {}
  } as unknown as MatrixEvent
}

type MemberOverrides = {
  name?: string
  avatarUrl?: string
}

/** 创建模拟 RoomMember 对象 */
function createMember(overrides: MemberOverrides = {}) {
  return {
    name: overrides.name,
    getMxcAvatarUrl: () => overrides.avatarUrl
  }
}

type RoomOverrides = {
  getMember?: (userId: string) => ReturnType<typeof createMember> | null
}

/** 创建模拟 Room 对象 */
function createRoom(overrides: RoomOverrides = {}): Room {
  return {
    getMember: overrides.getMember ?? (() => createMember({ name: 'Display Name' }))
  } as unknown as Room
}

describe('getThreadingManager', () => {
  let mockClient: Partial<MatrixClient>
  let manager: ThreadingManagerCompat

  beforeEach(() => {
    manager = { getGlobalThreadList: vi.fn() }
    mockClient = {} as unknown as MatrixClient
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as MatrixClient)
  })

  /** 辅助：启用方法路径的 manager（SDK 方式） */
  function enableMethodPath() {
    ;(mockClient as unknown as { getThreadingManager: () => ThreadingManagerCompat }).getThreadingManager = () =>
      manager
  }

  /** 辅助：启用属性路径的 fallback（旧式/测试） */
  function enablePropertyPath() {
    delete (mockClient as unknown as { getThreadingManager?: unknown }).getThreadingManager
    ;(mockClient as unknown as { threadingManager: ThreadingManagerCompat }).threadingManager = manager
  }

  it('should call getThreadingManager() when SDK method is available (preferred path)', () => {
    enableMethodPath()
    expect(getThreadingManager()).toBe(manager)
  })

  it('should fall back to threadingManager property when method is unavailable (legacy path)', () => {
    enablePropertyPath()
    expect(getThreadingManager()).toBe(manager)
  })

  it('should return null when no client is available', () => {
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null as unknown as MatrixClient)
    expect(getThreadingManager()).toBeNull()
  })

  it('should return null when client has neither method nor property', () => {
    // 无 getThreadingManager，也无 threadingManager 属性
    expect(getThreadingManager()).toBeNull()
  })

  it('should prefer method over property when both exist', () => {
    const legacyManager = { getGlobalThreadList: vi.fn() }
    enableMethodPath()
    ;(mockClient as unknown as { threadingManager: typeof legacyManager }).threadingManager = legacyManager
    expect(getThreadingManager()).toBe(manager)
  })
})

describe('buildDisplayMessage', () => {
  it('should resolve sender name and avatar from room member', () => {
    const room = createRoom({
      getMember: () => createMember({ name: 'Alice', avatarUrl: 'mxc://avatar' })
    })
    const event = createEvent({
      id: '$e1',
      sender: '@alice:server.com',
      ts: 1234,
      content: { body: 'hello', msgtype: 'm.text' }
    })

    const result = buildDisplayMessage(room, event)

    expect(result).toEqual({
      eventId: '$e1',
      sender: '@alice:server.com',
      senderName: 'Alice',
      avatarUrl: 'mxc://avatar',
      content: 'hello',
      timestamp: 1234,
      inReplyTo: undefined
    })
  })

  it('should fall back to sender when member is missing', () => {
    const room = createRoom({ getMember: () => null })
    const event = createEvent({ sender: '@ghost:server.com', content: { body: 'hi' } })

    const result = buildDisplayMessage(room, event)

    expect(result.senderName).toBe('@ghost:server.com')
    expect(result.avatarUrl).toBeUndefined()
  })

  it('should fall back to empty string when sender missing', () => {
    const room = createRoom({ getMember: () => null })
    const event = createEvent({ sender: '', content: { body: 'hi' } })

    const result = buildDisplayMessage(room, event)

    expect(result.sender).toBe('')
    expect(result.senderName).toBe('')
  })

  it('should use empty string for content when body missing', () => {
    const room = createRoom()
    const event = createEvent({ content: { msgtype: 'm.emote' } })

    const result = buildDisplayMessage(room, event)

    expect(result.content).toBe('')
  })

  it('should use empty string for eventId when missing', () => {
    const room = createRoom()
    const event = createEvent({ id: '', content: { body: 'x' } })

    const result = buildDisplayMessage(room, event)

    expect(result.eventId).toBe('')
  })

  it('should extract inReplyTo from m.relates_to content', () => {
    const room = createRoom()
    const event = createEvent({
      content: {
        body: 'reply',
        [MatrixContentField.RELATES_TO]: {
          rel_type: MatrixRelType.THREAD,
          event_id: '$root',
          'm.in_reply_to': { event_id: '$target' }
        }
      }
    })

    const result = buildDisplayMessage(room, event)

    expect(result.inReplyTo).toBe('$target')
  })

  it('should leave inReplyTo undefined when no m.in_reply_to present', () => {
    const room = createRoom()
    const event = createEvent({ content: { body: 'plain' } })

    const result = buildDisplayMessage(room, event)

    expect(result.inReplyTo).toBeUndefined()
  })
})
