import { describe, expect, it, vi } from 'vitest'
import { createMockMatrixClient, createMockMatrixEvent, createMockRoom } from '../matrixMocks'

describe('createMockMatrixClient', () => {
  it('returns an object with the most-mocked client methods as vi.fn()', () => {
    const client = createMockMatrixClient()
    expect(vi.isMockFunction(client.getRoom)).toBe(true)
    expect(vi.isMockFunction(client.getRooms)).toBe(true)
    expect(vi.isMockFunction(client.uploadContent)).toBe(true)
    expect((client as any).__isMock).toBe(true)
  })

  it('default getUserId returns @self:example.com', () => {
    const client = createMockMatrixClient()
    expect(client.getUserId()).toBe('@self:example.com')
  })

  it('overrides win over defaults', () => {
    const client = createMockMatrixClient({ getUserId: vi.fn(() => '@alice:matrix.org') })
    expect(client.getUserId()).toBe('@alice:matrix.org')
  })

  it('manager accessors short-circuit to null by default', () => {
    const client = createMockMatrixClient() as any
    expect(client.getDirectMessageManager?.()).toBeNull()
    expect(client.getWidgetsManager?.()).toBeNull()
  })
})

describe('createMockRoom', () => {
  it('seeds roomId on getRoomId() and direct property', () => {
    const room = createMockRoom('!my-room:server')
    expect(room.roomId).toBe('!my-room:server')
    expect(room.getRoomId?.()).toBe('!my-room:server')
  })

  it('default membership is join with 2 joined members', () => {
    const room = createMockRoom()
    expect(room.getMyMembership?.()).toBe('join')
    expect((room as any).getJoinedMemberCount()).toBe(2)
  })

  it('overrides win over defaults', () => {
    const room = createMockRoom('!r:s', { name: 'Alice & Bob' as any })
    expect(room.name).toBe('Alice & Bob')
  })

  it('currentState.getStateEvents is a vi.fn returning []', () => {
    const room = createMockRoom()
    expect((room as any).currentState.getStateEvents()).toEqual([])
    expect(vi.isMockFunction((room as any).currentState.getStateEvents)).toBe(true)
  })
})

describe('createMockMatrixEvent', () => {
  it('seeds content into getContent() and getWireContent()', () => {
    const event = createMockMatrixEvent({ body: 'hello', msgtype: 'm.text' })
    expect(event.getContent()).toEqual({ body: 'hello', msgtype: 'm.text' })
    expect(event.getWireContent()).toEqual({ body: 'hello', msgtype: 'm.text' })
  })

  it('default ids and types are sensible placeholders', () => {
    const event = createMockMatrixEvent()
    expect((event as any).getType()).toBe('m.room.message')
    expect((event as any).getSender()).toBe('@other:example.com')
    expect((event as any).getId()).toBe('$event-id')
  })

  it('overrides win for typed extensions', () => {
    const event = createMockMatrixEvent({}, { customMethod: () => 42 } as any)
    expect((event as any).customMethod()).toBe(42)
  })
})
