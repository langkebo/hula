import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROBOT_ROOM_STATE_EVENT_TYPE, robotRoomStateSyncService } from '../RobotRoomStateSyncService'

const { getRoomMock, getRoomStateEventMock, sendStateEventMock } = vi.hoisted(() => ({
  getRoomMock: vi.fn(),
  getRoomStateEventMock: vi.fn(),
  sendStateEventMock: vi.fn()
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: () => ({
      getRoom: getRoomMock,
      getRoomStateEvent: getRoomStateEventMock,
      sendStateEvent: sendStateEventMock
    })
  }
}))

describe('RobotRoomStateSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads robot instances from room state content', async () => {
    getRoomMock.mockReturnValue({
      currentState: {
        getStateEvents: vi.fn(() => ({
          getContent: () => ({
            version: '1.0',
            updatedAt: 1710000000000,
            instances: [
              {
                botId: 'openclaw-assistant',
                ownerUserId: '@alice:example.com',
                status: 'paused',
                createdAt: 1710000000000,
                updatedAt: 1710000005000,
                metadata: {
                  source: 'matrix-state'
                }
              }
            ]
          })
        }))
      }
    })

    const instances = await robotRoomStateSyncService.loadRoomInstances('!room:hula')

    expect(instances).toEqual([
      {
        id: '!room:hula:openclaw-assistant',
        roomId: '!room:hula',
        botId: 'openclaw-assistant',
        ownerUserId: '@alice:example.com',
        status: 'paused',
        createdAt: 1710000000000,
        updatedAt: 1710000005000,
        metadata: {
          source: 'matrix-state'
        }
      }
    ])
  })

  it('saves room robot instances to matrix state and normalizes transient status', async () => {
    sendStateEventMock.mockResolvedValue({ event_id: '$state-1' })

    await robotRoomStateSyncService.saveRoomInstances('!room:hula', [
      {
        id: '!room:hula:openclaw-assistant',
        roomId: '!room:hula',
        botId: 'openclaw-assistant',
        ownerUserId: '@alice:example.com',
        status: 'thinking',
        createdAt: 1710000000000,
        updatedAt: 1710000005000,
        metadata: {
          lastPrompt: '总结一下'
        }
      },
      {
        id: '!room:hula:hula-notifier',
        roomId: '!room:hula',
        botId: 'hula-notifier',
        status: 'offline',
        createdAt: 1710000001000,
        updatedAt: 1710000006000
      }
    ])

    expect(sendStateEventMock).toHaveBeenCalledWith(
      '!room:hula',
      ROBOT_ROOM_STATE_EVENT_TYPE,
      expect.objectContaining({
        version: '1.0',
        instances: [
          expect.objectContaining({
            botId: 'openclaw-assistant',
            status: 'idle',
            metadata: {
              lastPrompt: '总结一下'
            }
          })
        ]
      }),
      ''
    )
  })

  it('falls back to getRoomStateEvent when room state is not cached locally', async () => {
    getRoomMock.mockReturnValue(null)
    getRoomStateEventMock.mockResolvedValue({
      version: '1.0',
      updatedAt: 1710000000000,
      instances: [
        {
          botId: 'trendradar-briefing',
          status: 'error',
          createdAt: 1710000000000,
          updatedAt: 1710000001000
        }
      ]
    })

    const instances = await robotRoomStateSyncService.loadRoomInstances('!room:hula')

    expect(getRoomStateEventMock).toHaveBeenCalledWith('!room:hula', ROBOT_ROOM_STATE_EVENT_TYPE, '')
    expect(instances[0]).toEqual(
      expect.objectContaining({
        botId: 'trendradar-briefing',
        status: 'error'
      })
    )
  })
})
