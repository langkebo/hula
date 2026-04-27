import { describe, it, expect, vi, beforeEach } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixRoomService } from '../MatrixRoomService'
import type { MatrixClient } from 'matrix-js-sdk'

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixRoomService - Extended Features', () => {
  let mockClient: Partial<MatrixClient>
  let mockRoom: any

  beforeEach(() => {
    mockRoom = {
      getAltAliases: vi.fn(() => ['#alias2:example.com']),
      getCanonicalAlias: vi.fn(() => '#alias1:example.com'),
      name: 'Test Room'
    }

    mockClient = {
      forget: vi.fn(),
      upgradeRoom: vi.fn(),
      joinRoom: vi.fn(),
      createAlias: vi.fn(),
      deleteAlias: vi.fn(),
      getRoom: vi.fn(() => mockRoom),
      getEventContext: vi.fn()
    }

    vi.mocked(matrixClientService.getClient).mockReset()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)
  })

  describe('forgetRoom', () => {
    it('should call client.forget with roomId', async () => {
      vi.mocked(mockClient.forget!).mockResolvedValue(undefined)

      await matrixRoomService.forgetRoom('!room:example.com')

      expect(mockClient.forget).toHaveBeenCalledWith('!room:example.com')
    })

    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

      await expect(matrixRoomService.forgetRoom('!room:example.com')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('upgradeRoom', () => {
    it('should upgrade room to new version', async () => {
      vi.mocked(mockClient.upgradeRoom!).mockResolvedValue('!newroom:example.com')

      const result = await matrixRoomService.upgradeRoom('!room:example.com', 'v11')

      expect(result).toBe('!newroom:example.com')
      expect(mockClient.upgradeRoom).toHaveBeenCalledWith('!room:example.com', 'v11')
    })
  })

  describe('knockRoom', () => {
    it('should knock on room with reason', async () => {
      vi.mocked(mockClient.joinRoom!).mockResolvedValue({ roomId: '!room:example.com' } as any)

      await matrixRoomService.knockRoom('!room:example.com', 'I would like to join')

      expect(mockClient.joinRoom).toHaveBeenCalledWith(
        '!room:example.com',
        expect.objectContaining({ reason: 'I would like to join' })
      )
    })
  })

  describe('getRoomAliases', () => {
    it('should return canonical alias and alt aliases', async () => {
      const aliases = await matrixRoomService.getRoomAliases('!room:example.com')

      expect(aliases).toEqual(['#alias1:example.com', '#alias2:example.com'])
    })

    it('should return empty array when room not found', async () => {
      vi.mocked(mockClient.getRoom!).mockReturnValue(null)

      const aliases = await matrixRoomService.getRoomAliases('!room:example.com')

      expect(aliases).toEqual([])
    })
  })

  describe('setRoomAlias', () => {
    it('should create room alias', async () => {
      vi.mocked(mockClient.createAlias!).mockResolvedValue(undefined)

      await matrixRoomService.setRoomAlias('!room:example.com', '#myroom:example.com')

      expect(mockClient.createAlias).toHaveBeenCalledWith('#myroom:example.com', '!room:example.com')
    })
  })

  describe('deleteRoomAlias', () => {
    it('should delete room alias', async () => {
      vi.mocked(mockClient.deleteAlias!).mockResolvedValue(undefined)

      await matrixRoomService.deleteRoomAlias('#myroom:example.com')

      expect(mockClient.deleteAlias).toHaveBeenCalledWith('#myroom:example.com')
    })
  })

  describe('getEventContext', () => {
    it('should return event context', async () => {
      const context = {
        event: { type: 'm.room.message' },
        events_before: [{ type: 'm.room.message', content: { body: 'before' } }],
        events_after: [{ type: 'm.room.message', content: { body: 'after' } }],
        state: []
      }
      vi.mocked(mockClient.getEventContext!).mockResolvedValue(context)

      const result = await matrixRoomService.getEventContext('!room:example.com', '$event1', 10)

      expect(result).toEqual(context)
      expect(mockClient.getEventContext).toHaveBeenCalledWith('!room:example.com', '$event1', { limit: 10 })
    })

    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

      await expect(matrixRoomService.getEventContext('!room', '$event')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('Room v3 Extensions', () => {
    let mockHttp: { authedRequest: ReturnType<typeof vi.fn>; request: ReturnType<typeof vi.fn> }

    beforeEach(() => {
      mockHttp = { authedRequest: vi.fn(), request: vi.fn() }
      mockClient = {
        ...mockClient,
        http: mockHttp as any,
        getUserId: vi.fn(() => '@user:example.com'),
        getDeviceId: vi.fn(() => 'DEVICE1'),
        sendStateEvent: vi.fn()
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)
    })

    describe('getRoomVersion', () => {
      it('should return room version from create event', async () => {
        mockRoom = {
          currentState: {
            getStateEvents: vi.fn().mockReturnValue({
              getContent: vi.fn().mockReturnValue({ room_version: 'v10' })
            })
          }
        }
        vi.mocked(mockClient.getRoom!).mockReturnValue(mockRoom)

        const result = await matrixRoomService.getRoomVersion('!room:example.com')

        expect(result).toBe('v10')
      })

      it('should return null when room not found', async () => {
        vi.mocked(mockClient.getRoom!).mockReturnValue(null)

        const result = await matrixRoomService.getRoomVersion('!room:example.com')

        expect(result).toBeNull()
      })
    })

    describe('getRoomCapabilities', () => {
      it('should get room capabilities via API', async () => {
        const mockCaps = { capabilities: { 'm.room.tombstone': { enabled: true } } }
        mockHttp.authedRequest.mockResolvedValue(mockCaps)

        const result = await matrixRoomService.getRoomCapabilities('!room:example.com')

        expect(result).toEqual(mockCaps)
        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          'GET',
          '/_matrix/client/v3/rooms/!room%3Aexample.com/capabilities'
        )
      })

      it('should return empty object on error', async () => {
        mockHttp.authedRequest.mockRejectedValue(new Error('fail'))

        const result = await matrixRoomService.getRoomCapabilities('!room:example.com')

        expect(result).toEqual({})
      })
    })

    describe('getRoomTimeline', () => {
      it('should get room timeline with options', async () => {
        const mockTimeline = { chunk: [{ type: 'm.room.message' }], start: 't1', end: 't2' }
        mockHttp.authedRequest.mockResolvedValue(mockTimeline)

        const result = await matrixRoomService.getRoomTimeline('!room:example.com', { from: 't0', limit: 20, dir: 'f' })

        expect(result).toEqual(mockTimeline)
        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          'GET',
          '/_matrix/client/v3/rooms/!room%3Aexample.com/timeline',
          { from: 't0', limit: '20', dir: 'f' }
        )
      })

      it('should return empty chunk on error', async () => {
        mockHttp.authedRequest.mockRejectedValue(new Error('fail'))

        const result = await matrixRoomService.getRoomTimeline('!room:example.com')

        expect(result.chunk).toEqual([])
      })
    })

    describe('getRoomUnreadCount', () => {
      it('should get unread count', async () => {
        mockHttp.authedRequest.mockResolvedValue({ unread_notifications: 5, unread_highlighted: 1 })

        const result = await matrixRoomService.getRoomUnreadCount('!room:example.com')

        expect(result).toEqual({ unread_notifications: 5, unread_highlighted: 1 })
      })

      it('should return zeros on error', async () => {
        mockHttp.authedRequest.mockRejectedValue(new Error('fail'))

        const result = await matrixRoomService.getRoomUnreadCount('!room:example.com')

        expect(result).toEqual({ unread_notifications: 0, unread_highlighted: 0 })
      })
    })

    describe('getRoomAccountData', () => {
      it('should get room account data', async () => {
        const mockData = { custom_key: 'value' }
        mockHttp.authedRequest.mockResolvedValue(mockData)

        const result = await matrixRoomService.getRoomAccountData('!room:example.com', 'custom.type')

        expect(result).toEqual(mockData)
      })

      it('should return null on error', async () => {
        mockHttp.authedRequest.mockRejectedValue(new Error('fail'))

        const result = await matrixRoomService.getRoomAccountData('!room:example.com', 'custom.type')

        expect(result).toBeNull()
      })
    })

    describe('setRoomAccountData', () => {
      it('should set room account data', async () => {
        mockHttp.authedRequest.mockResolvedValue({})

        await matrixRoomService.setRoomAccountData('!room:example.com', 'custom.type', { key: 'value' })

        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          'PUT',
          expect.stringContaining('/account_data/custom.type'),
          undefined,
          { key: 'value' }
        )
      })
    })

    describe('getPinnedEvents', () => {
      it('should get pinned events from room state', async () => {
        mockRoom = {
          currentState: {
            getStateEvents: vi.fn().mockReturnValue({
              getContent: vi.fn().mockReturnValue({ pinned: ['$event1', '$event2'] })
            })
          }
        }
        vi.mocked(mockClient.getRoom!).mockReturnValue(mockRoom)

        const result = await matrixRoomService.getPinnedEvents('!room:example.com')

        expect(result).toEqual(['$event1', '$event2'])
      })

      it('should return empty array when no pinned events', async () => {
        mockRoom = {
          currentState: {
            getStateEvents: vi.fn().mockReturnValue({
              getContent: vi.fn().mockReturnValue({})
            })
          }
        }
        vi.mocked(mockClient.getRoom!).mockReturnValue(mockRoom)

        const result = await matrixRoomService.getPinnedEvents('!room:example.com')

        expect(result).toEqual([])
      })
    })

    describe('setPinnedEvents', () => {
      it('should set pinned events via state event', async () => {
        vi.mocked(mockClient.sendStateEvent!).mockResolvedValue({ event_id: '$event1' } as any)

        await matrixRoomService.setPinnedEvents('!room:example.com', ['$event1'])

        expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
          '!room:example.com',
          'm.room.pinned_events',
          { pinned: ['$event1'] },
          ''
        )
      })
    })

    describe('getInviteBlocklist', () => {
      it('should get invite blocklist', async () => {
        mockHttp.authedRequest.mockResolvedValue({ blocked: ['@bad:example.com'] })

        const result = await matrixRoomService.getInviteBlocklist('!room:example.com')

        expect(result).toEqual(['@bad:example.com'])
      })

      it('should return empty array on error', async () => {
        mockHttp.authedRequest.mockRejectedValue(new Error('fail'))

        const result = await matrixRoomService.getInviteBlocklist('!room:example.com')

        expect(result).toEqual([])
      })
    })

    describe('setInviteBlocklist', () => {
      it('should set invite blocklist', async () => {
        mockHttp.authedRequest.mockResolvedValue({})

        await matrixRoomService.setInviteBlocklist('!room:example.com', ['@bad:example.com'])

        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          'POST',
          '/_matrix/client/v3/rooms/!room%3Aexample.com/invite_blocklist',
          undefined,
          { blocked: ['@bad:example.com'] }
        )
      })
    })

    describe('timestampToEvent', () => {
      it('should find event by timestamp', async () => {
        const mockResult = { event_id: '$event1', origin_server_ts: 1234567890 }
        mockHttp.authedRequest.mockResolvedValue(mockResult)

        const result = await matrixRoomService.timestampToEvent('!room:example.com', 1234567890, 'b')

        expect(result).toEqual(mockResult)
        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          'GET',
          '/_matrix/client/v1/rooms/!room%3Aexample.com/timestamp_to_event',
          { ts: '1234567890', dir: 'b' }
        )
      })

      it('should return null on error', async () => {
        mockHttp.authedRequest.mockRejectedValue(new Error('fail'))

        const result = await matrixRoomService.timestampToEvent('!room:example.com', 1234567890)

        expect(result).toBeNull()
      })
    })

    describe('getTags', () => {
      it('should get tags for a room', async () => {
        const mockTags = { 'm.favourite': { order: 0.1 }, 'm.lowpriority': { order: 1.0 } }
        mockHttp.authedRequest.mockResolvedValue({ tags: mockTags })

        const result = await matrixRoomService.getTags('!room:example.com')

        expect(result).toEqual(mockTags)
      })

      it('should return empty object when no userId', async () => {
        vi.mocked(mockClient.getUserId!).mockReturnValue(null as any)

        const result = await matrixRoomService.getTags('!room:example.com')

        expect(result).toEqual({})
      })
    })

    describe('setTag', () => {
      it('should set a tag with order', async () => {
        mockHttp.authedRequest.mockResolvedValue({})

        await matrixRoomService.setTag('!room:example.com', 'm.favourite', 0.5)

        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          'PUT',
          expect.stringContaining('/tags/m.favourite'),
          undefined,
          { order: 0.5 }
        )
      })
    })

    describe('removeTag', () => {
      it('should remove a tag', async () => {
        mockHttp.authedRequest.mockResolvedValue({})

        await matrixRoomService.removeTag('!room:example.com', 'm.favourite')

        expect(mockHttp.authedRequest).toHaveBeenCalledWith('DELETE', expect.stringContaining('/tags/m.favourite'))
      })
    })
  })
})
