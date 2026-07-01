import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn()
}))

const mockGetRoom = vi.fn()
const mockSendTextMessage = vi.fn()

vi.mock('../QueryService', () => ({
  matrixRoomQueryService: {
    getRoom: mockGetRoom
  }
}))

vi.mock('../../messaging/MatrixMessageService', () => ({
  matrixMessageService: {
    sendTextMessage: mockSendTextMessage
  }
}))

vi.mock('../../MatrixClientService', () => {
  const mockService = {
    getClient: vi.fn()
  }
  return {
    default: mockService,
    matrixClientService: mockService
  }
})

const matrixClientService = (await import('../../MatrixClientService')).default
const { matrixAnnouncementService } = await import('../MatrixAnnouncementService')

interface MockStateEvent extends Partial<MatrixEvent> {
  getContent: () => Record<string, unknown>
}

function createRoom(options?: {
  pinned?: string[]
  topicEvent?: Partial<MatrixEvent> | null
  events?: Record<string, Partial<MatrixEvent>>
}): Room {
  const pinnedEvent: MockStateEvent | null =
    options?.pinned === undefined
      ? null
      : {
          getContent: () => ({ pinned: options.pinned })
        }

  const topicEvent = options?.topicEvent ?? null
  const events = options?.events ?? {}

  return {
    currentState: {
      getStateEvents: vi.fn((type: string) => {
        if (type === 'm.room.pinned_events') {
          return pinnedEvent
        }
        if (type === 'm.room.topic') {
          return topicEvent
        }
        return null
      })
    },
    findEventById: vi.fn((eventId: string) => events[eventId] ?? null)
  } as unknown as Room
}

describe('MatrixAnnouncementService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create pinned topic announcement via state event', async () => {
    const topicEvent = {
      getId: () => '$topic'
    } as unknown as MatrixEvent

    mockGetRoom.mockResolvedValueOnce(createRoom()).mockResolvedValueOnce(
      createRoom({
        topicEvent
      })
    )

    const mockClient = {
      sendStateEvent: vi.fn().mockResolvedValue(undefined)
    } as unknown as MatrixClient
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient)

    const result = await matrixAnnouncementService.pushAnnouncement('!room:example.com', {
      content: 'Pinned content',
      isPinned: true
    })

    expect(result).toBe('$topic')
    expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
      '!room:example.com',
      'm.room.topic',
      { topic: 'Pinned content' },
      ''
    )
  })

  it('should create normal announcement and append pinned event ids', async () => {
    mockSendTextMessage.mockResolvedValueOnce({ event_id: '$new-event' })
    mockGetRoom.mockResolvedValue(createRoom({ pinned: ['$old-event'] }))

    const mockClient = {
      sendStateEvent: vi.fn().mockResolvedValue(undefined)
    } as unknown as MatrixClient
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient)

    const result = await matrixAnnouncementService.pushAnnouncement('!room:example.com', {
      content: 'Normal content',
      isPinned: false
    })

    expect(result).toBe('$new-event')
    expect(mockSendTextMessage).toHaveBeenCalledWith('!room:example.com', 'Normal content')
    expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
      '!room:example.com',
      'm.room.pinned_events',
      { pinned: ['$old-event', '$new-event'] },
      ''
    )
  })

  it('should replace pinned event id when editing normal announcement', async () => {
    mockSendTextMessage.mockResolvedValueOnce({ event_id: '$replacement' })
    mockGetRoom.mockResolvedValue(createRoom({ pinned: ['$target', '$other'] }))

    const mockClient = {
      sendStateEvent: vi.fn().mockResolvedValue(undefined)
    } as unknown as MatrixClient
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient)

    const result = await matrixAnnouncementService.editAnnouncement('!room:example.com', {
      id: '$target',
      content: 'Edited content',
      isPinned: false
    })

    expect(result).toBe('$replacement')
    expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
      '!room:example.com',
      'm.room.pinned_events',
      { pinned: ['$replacement', '$other'] },
      ''
    )
  })

  it('should clear topic when deleting pinned topic announcement', async () => {
    const topicEvent = {
      getId: () => '$topic'
    } as unknown as MatrixEvent

    mockGetRoom.mockResolvedValue(
      createRoom({
        topicEvent
      })
    )

    const mockClient = {
      sendStateEvent: vi.fn().mockResolvedValue(undefined)
    } as unknown as MatrixClient
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient)

    await matrixAnnouncementService.deleteAnnouncement('!room:example.com', '$topic')

    expect(mockClient.sendStateEvent).toHaveBeenCalledWith('!room:example.com', 'm.room.topic', { topic: '' }, '')
  })

  it('should read topic and message announcements by id', async () => {
    const topicEvent = {
      getId: () => '$topic',
      getContent: () => ({ topic: 'Topic text' }),
      getSender: () => '@admin:example.com',
      getTs: () => 100
    } as unknown as MatrixEvent

    const messageEvent = {
      getId: () => '$message',
      getContent: () => ({ body: 'Message text' }),
      getSender: () => '@user:example.com',
      getTs: () => 200
    } as unknown as MatrixEvent

    mockGetRoom.mockResolvedValue(
      createRoom({
        topicEvent,
        events: {
          $message: messageEvent
        }
      })
    )

    await expect(matrixAnnouncementService.getAnnouncementById('!room:example.com', '$topic')).resolves.toEqual({
      id: '$topic',
      roomId: '!room:example.com',
      content: 'Topic text',
      isPinned: true,
      authorId: '@admin:example.com',
      createdAt: 100
    })

    await expect(matrixAnnouncementService.getAnnouncementById('!room:example.com', '$message')).resolves.toEqual({
      id: '$message',
      roomId: '!room:example.com',
      content: 'Message text',
      isPinned: false,
      authorId: '@user:example.com',
      createdAt: 200
    })
  })
})
