import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { createRoomSync } from '../sync'

type TimelineCallback = (payload: {
  roomId: string
  eventType: string
  roomInfo: Record<string, unknown>
  message: unknown
}) => void
type TimelineErrorCallback = (payload: { roomId: string; error: unknown }) => void

const { onTimelineEventMock, convertEventToMessageMock, markLiveFailureMock, clearLiveFailureMock } = vi.hoisted(
  () => ({
    onTimelineEventMock: vi.fn(),
    convertEventToMessageMock: vi.fn(),
    markLiveFailureMock: vi.fn(),
    clearLiveFailureMock: vi.fn()
  })
)

vi.mock('@/services/matrix/room/RealtimeService', () => ({
  matrixRoomRealtimeService: {
    onTimelineEvent: onTimelineEventMock,
    onRoomNameChange: vi.fn(),
    onRoomAvatarChange: vi.fn(),
    onRoomMemberChange: vi.fn()
  }
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    on: vi.fn()
  }
}))

vi.mock('@/services/matrix/MatrixEventService', () => ({
  matrixEventService: {
    convertEventToMessage: convertEventToMessageMock
  }
}))

vi.mock('@/services/matrix/room/CreationService', () => ({
  matrixRoomCreationService: {
    convertRoomToRoomInfo: vi.fn((room: { roomId: string }) => ({ roomId: room.roomId }))
  }
}))

vi.mock('@/services/matrix/sync/MatrixSlidingSyncService', () => ({
  default: {
    initialize: vi.fn(async () => undefined),
    registerCallbacks: vi.fn()
  }
}))

vi.mock('@/services/matrix/messaging/MatrixMessageAdapter', () => ({
  default: {
    convertMatrixContent: vi.fn(() => ({}))
  }
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({
    checkMsgExist: vi.fn(() => false),
    updateMsg: vi.fn(),
    pushMsg: vi.fn(),
    updateRecallMsg: vi.fn(),
    markLiveFailure: markLiveFailureMock,
    clearLiveFailure: clearLiveFailureMock
  })
}))

vi.mock('@/stores/domains/chat/chat/session', () => ({
  useSessionStore: () => ({
    updateSession: vi.fn()
  })
}))

const createSync = () =>
  createRoomSync({
    rooms: shallowRef(new Map()),
    updateRoom: vi.fn(),
    loadRooms: vi.fn(async () => true),
    scheduleTagsRefresh: vi.fn(),
    batchRefreshTags: vi.fn(async () => undefined)
  })

const getTimelineHandlers = (): { callback: TimelineCallback; onError: TimelineErrorCallback } => {
  const [callback, onError] = onTimelineEventMock.mock.calls[0]
  return { callback, onError }
}

describe('room sync 实时帧失败接线', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('把 onTimelineEvent 的 onError 落到 markLiveFailure', async () => {
    await createSync().setupEventListeners()
    const error = new Error('convert failed')

    getTimelineHandlers().onError({ roomId: '!r:e', error })

    expect(markLiveFailureMock).toHaveBeenCalledWith('!r:e', error)
  })

  it('一帧成功落地后清除 liveFailed', async () => {
    await createSync().setupEventListeners()

    getTimelineHandlers().callback({
      roomId: '!r:e',
      eventType: 'm.room.message',
      roomInfo: { roomId: '!r:e' },
      message: {
        clientKey: 'm1',
        message: { id: 'm1', roomId: '!r:e', type: 1, body: { body: 'hi' }, sendTime: 1 },
        fromUser: { uid: 'u', username: 'u' }
      }
    })

    expect(clearLiveFailureMock).toHaveBeenCalledWith('!r:e')
  })

  it('eventDecrypted 转换抛错时不冒泡，并按房间标记实时失败', async () => {
    const { matrixClientService } = await import('@/services/matrix/MatrixClientService')
    await createSync().setupEventListeners()
    const handler = vi.mocked(matrixClientService.on).mock.calls.find(([event]) => event === 'eventDecrypted')?.[1] as (
      payload: unknown
    ) => void
    const error = new Error('decrypt convert failed')
    convertEventToMessageMock.mockImplementationOnce(() => {
      throw error
    })

    expect(() =>
      handler({
        event: { isRedacted: () => false, getSender: () => '@u:e' },
        room: { roomId: '!r:e' }
      })
    ).not.toThrow()

    expect(markLiveFailureMock).toHaveBeenCalledWith('!r:e', error)
  })
})
