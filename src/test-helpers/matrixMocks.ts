/**
 * Typed factories for matrix-js-sdk shapes used in unit tests.
 *
 * Replace inline `{ ... } as MatrixClient` / `as Room` casts with a single
 * call site, so when the SDK shape drifts we update one helper instead of
 * grepping ~800 cast sites.
 *
 * Each factory returns a plain object cast to `unknown` and re-cast via the
 * helper's return type. Override fields with `overrides` to specialize.
 */
import { vi } from 'vitest'
import type { MatrixClient, Room, MatrixEvent } from 'matrix-js-sdk'

type AnyFn = (...args: unknown[]) => unknown

export type MockMatrixClient<T = MatrixClient> = T & {
  __isMock: true
}

const baseClientShape = () => ({
  getRoom: vi.fn(() => null),
  getRooms: vi.fn(() => [] as Room[]),
  getUserId: vi.fn(() => '@self:example.com'),
  getDeviceId: vi.fn(() => 'DEVICE_ID'),
  getProfile: vi.fn(async () => ({})),
  searchUserDirectory: vi.fn(async () => ({ results: [], limited: false })),
  reportEvent: vi.fn(async () => ({})),
  getServerRetention: vi.fn(async () => ({})),
  getRoomStateEvent: vi.fn(async () => ({})),
  uploadContent: vi.fn(async () => ({ content_uri: 'mxc://example/abc' })),
  sync: vi.fn(async () => ({})),
  stopClient: vi.fn(),
  // Manager accessors — return null by default so `?.` chains short-circuit.
  getDirectMessageManager: vi.fn(() => null),
  getMediaQuotaManager: vi.fn(() => null),
  getDeviceManager: vi.fn(() => null),
  getKeyBackupManager: vi.fn(() => null),
  getPushers: vi.fn(async () => []),
  getWidgetsManager: vi.fn(() => null)
})

/**
 * Build a typed MatrixClient mock.
 *
 * Each method on the returned object is a `vi.fn()` so callers can assert
 * `.toHaveBeenCalledWith(...)` without re-mocking the whole client.
 *
 * @param overrides Per-test overrides — these win over the defaults.
 */
export const createMockMatrixClient = <O extends Record<string, AnyFn | unknown>>(
  overrides: O = {} as O
): MockMatrixClient<MatrixClient & O> => {
  const client = { ...baseClientShape(), ...overrides, __isMock: true as const }
  return client as unknown as MockMatrixClient<MatrixClient & O>
}

const baseRoomShape = (roomId = '!room:example.com') => ({
  roomId,
  name: roomId,
  timeline: [] as MatrixEvent[],
  getRoomId: vi.fn(() => roomId),
  getMyMembership: vi.fn(() => 'join'),
  getUnreadNotificationCount: vi.fn(() => 0),
  getMxcAvatarUrl: vi.fn(() => null),
  getJoinedMemberCount: vi.fn(() => 2),
  getUnfilteredTimelineSet: vi.fn(() => ({
    getLiveTimeline: vi.fn(() => ({ getEvents: vi.fn(() => [] as MatrixEvent[]) }))
  })),
  currentState: {
    getStateEvents: vi.fn(() => [] as MatrixEvent[])
  }
})

export type MockRoom<T = Room> = T & { __isMock: true }

/**
 * Build a typed Room mock. Pass `roomId` to make the id unique across tests.
 */
export const createMockRoom = <O extends Record<string, unknown>>(
  roomId: string = '!room:example.com',
  overrides: O = {} as O
): MockRoom<Room & O> => {
  const room = { ...baseRoomShape(roomId), ...overrides, __isMock: true as const }
  return room as unknown as MockRoom<Room & O>
}

const baseEventShape = (content: Record<string, unknown> = {}) => ({
  getContent: vi.fn(() => content),
  getWireContent: vi.fn(() => content),
  getType: vi.fn(() => 'm.room.message'),
  getSender: vi.fn(() => '@other:example.com'),
  getStateKey: vi.fn(() => undefined as string | undefined),
  getId: vi.fn(() => '$event-id'),
  getRoomId: vi.fn(() => '!room:example.com'),
  getTs: vi.fn(() => Date.now())
})

export type MockMatrixEvent<T = MatrixEvent> = T & { __isMock: true }

/**
 * Build a typed MatrixEvent mock. Pass content to seed `getContent()` /
 * `getWireContent()`.
 */
export const createMockMatrixEvent = <O extends Record<string, unknown>>(
  content: Record<string, unknown> = {},
  overrides: O = {} as O
): MockMatrixEvent<MatrixEvent & O> => {
  const event = { ...baseEventShape(content), ...overrides, __isMock: true as const }
  return event as unknown as MockMatrixEvent<MatrixEvent & O>
}
