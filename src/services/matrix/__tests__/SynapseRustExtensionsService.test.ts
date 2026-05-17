import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../MatrixClientService', () => {
  const getClient = vi.fn(() => null as MatrixClient | null)
  const getHomeserverUrl = vi.fn(() => null as string | null)
  const getAccessToken = vi.fn(() => null as string | null)
  const waitForClientReady = vi.fn()
  const mock = { getClient, getHomeserverUrl, getAccessToken, waitForClientReady }
  return { default: mock, matrixClientService: mock }
})

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../network/runtimeFetch', () => ({
  getRuntimeAwareFetch: vi.fn()
}))

vi.mock('../EndpointCapabilityService', () => ({
  default: {
    check: vi.fn(() => Promise.resolve(true))
  }
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => key
  })
}))

describe('SynapseRustExtensionsService', () => {
  let synapseRustExtensionsService: typeof import('../SynapseRustExtensionsService').synapseRustExtensionsService
  let matrixClientService: typeof import('../MatrixClientService').default
  let getRuntimeAwareFetch: typeof import('../network/runtimeFetch').getRuntimeAwareFetch
  let endpointCapabilityService: typeof import('../EndpointCapabilityService').default

  const mockFetch = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    synapseRustExtensionsService = (await import('../SynapseRustExtensionsService')).synapseRustExtensionsService
    matrixClientService = (await import('../MatrixClientService')).default
    getRuntimeAwareFetch = (await import('../network/runtimeFetch')).getRuntimeAwareFetch
    endpointCapabilityService = (await import('../EndpointCapabilityService')).default
    vi.mocked(getRuntimeAwareFetch).mockReturnValue(mockFetch)
    vi.mocked(endpointCapabilityService.check).mockResolvedValue(true)
    vi.mocked(matrixClientService.getHomeserverUrl).mockReturnValue('https://matrix.example.com')
    vi.mocked(matrixClientService.getAccessToken).mockReturnValue('test-token')
    vi.mocked(matrixClientService.waitForClientReady).mockResolvedValue({
      getHomeserverUrl: vi.fn(() => 'https://matrix.example.com'),
      getAccessToken: vi.fn(() => 'test-token'),
      getUserId: vi.fn(() => '@user:example.com')
    } as unknown as MatrixClient)

    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getHomeserverUrl: vi.fn(() => 'https://matrix.example.com'),
      getAccessToken: vi.fn(() => 'test-token'),
      getUserId: vi.fn(() => '@user:example.com')
    } as unknown as MatrixClient)

    ;(synapseRustExtensionsService as unknown as { baseUrl: string }).baseUrl = 'https://matrix.example.com'
    ;(synapseRustExtensionsService as unknown as { accessToken: string }).accessToken = 'test-token'
    // 重置私有缓存以确保测试独立性
    ;(synapseRustExtensionsService as any).friendEndpointAvailable = null
  })

  describe('getFriends', () => {
    it('should get friends list', async () => {
      const data = { data: [{ user_id: '@friend:server', display_name: 'Friend' }] }
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })
      const result = await synapseRustExtensionsService.getFriends()
      expect(result).toHaveLength(1)
      expect(result[0].user_id).toBe('@friend:server')
    })

    it('should return empty array on error', async () => {
      const data = { error: 'unauthorized' }
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })
      const result = await synapseRustExtensionsService.getFriends()
      expect(result).toEqual([])
    })
  })

  describe('searchFriends', () => {
    it('should reuse configured homeserver and token before client becomes ready', async () => {
      ;(synapseRustExtensionsService as unknown as { baseUrl: string }).baseUrl = ''
      ;(synapseRustExtensionsService as unknown as { accessToken: string }).accessToken = ''
      const data = { results: [{ user_id: '@ljf1:server', username: 'ljf1' }] }
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })

      const result = await synapseRustExtensionsService.searchFriends('ljf1', { mode: 'exact' })

      expect(matrixClientService.waitForClientReady).not.toHaveBeenCalled()
      expect(result).toEqual([{ user_id: '@ljf1:server', username: 'ljf1' }])
    })
  })

  describe('sendFriendRequest', () => {
    it('should send friend request', async () => {
      const data = { data: { request_id: 1, status: 'pending' } }
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })
      const result = await synapseRustExtensionsService.sendFriendRequest('@user:server')
      expect(result.request_id).toBe(1)
    })

    it('should throw on error', async () => {
      const data = { error: 'forbidden' }
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })
      await expect(synapseRustExtensionsService.sendFriendRequest('@user:server')).rejects.toThrow()
    })
  })

  describe('checkFriendship', () => {
    it('should return true for friends', async () => {
      const data = { data: { are_friends: true } }
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })
      const result = await synapseRustExtensionsService.checkFriendship('@friend:server')
      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      const data = { error: 'not found' }
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })
      const result = await synapseRustExtensionsService.checkFriendship('@friend:server')
      expect(result).toBe(false)
    })
  })

  describe('removeFriend', () => {
    it('should remove friend', async () => {
      const data = { status: 'ok' }
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })
      await expect(synapseRustExtensionsService.removeFriend('@friend:server')).resolves.toBeUndefined()
    })
  })

  describe('getBurnStats', () => {
    it('should get burn stats', async () => {
      const data = { data: { total_burned: 5, total_pending: 2, rooms_with_burn_enabled: 3 } }
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })
      const result = await synapseRustExtensionsService.getBurnStats()
      expect(result.total_burned).toBe(5)
      expect(result.rooms_with_burn_enabled).toBe(3)
    })

    it('should return defaults on error', async () => {
      const data = { error: 'fail' }
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })
      const result = await synapseRustExtensionsService.getBurnStats()
      expect(result.total_burned).toBe(0)
    })
  })

  describe('enableBurnAfterRead', () => {
    it('should enable burn after read', async () => {
      const data = { status: 'ok' }
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })
      await expect(synapseRustExtensionsService.enableBurnAfterRead('!room:server', true)).resolves.toBeUndefined()
    })
  })

  describe('isBurnAfterReadEnabled', () => {
    it('should check burn status', async () => {
      const data = { data: { enabled: true } }
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })
      const result = await synapseRustExtensionsService.isBurnAfterReadEnabled('!room:server')
      expect(result).toBe(true)
    })
  })

  describe('enableAntiScreenshot', () => {
    it('should enable anti screenshot', async () => {
      const data = { status: 'ok' }
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })
      await expect(synapseRustExtensionsService.enableAntiScreenshot('!room:server', true)).resolves.toBeUndefined()
    })
  })

  describe('getInviteBlocklist', () => {
    it('should get invite blocklist', async () => {
      const data = { data: { blocked_users: ['@bad:server'], updated_ts: 123 } }
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })
      const result = await synapseRustExtensionsService.getInviteBlocklist('!room:server')
      expect(result.blocked_users).toHaveLength(1)
    })
  })

  describe('getRoomSummary', () => {
    it('should get room summary', async () => {
      const data = {
        data: {
          room_id: '!room:server',
          name: 'Test Room',
          heroes: [],
          stats: {
            room_id: '!room:server',
            total_events: 100,
            total_messages: 50,
            total_media: 10,
            storage_size: 1024
          }
        }
      }
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })
      const result = await synapseRustExtensionsService.getRoomSummary('!room:server')
      expect(result?.room_id).toBe('!room:server')
      expect(result?.name).toBe('Test Room')
    })

    it('should accept bare room summary payloads from synapse-rust', async () => {
      const data = {
        room_id: '!room:server',
        name: 'Bare Room',
        heroes: [],
        stats: {
          room_id: '!room:server',
          total_events: 10,
          total_messages: 6,
          total_media: 1,
          storage_size: 256
        }
      }
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })

      const result = await synapseRustExtensionsService.getRoomSummary('!room:server')

      expect(result?.room_id).toBe('!room:server')
      expect(result?.name).toBe('Bare Room')
    })

    it('should return null on error when throwOnError is false', async () => {
      const data = { error: 'not found' }
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })
      const result = await synapseRustExtensionsService.getRoomSummary('!room:server', false)
      expect(result).toBeNull()
    })
  })

  describe('room summary collections', () => {
    it('should accept bare member arrays from synapse-rust', async () => {
      const data = [{ user_id: '@user:server' }]
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })

      const result = await synapseRustExtensionsService.getRoomSummaryMembers('!room:server')
      expect(result).toHaveLength(1)
      expect(result[0].user_id).toBe('@user:server')
    })

    it('should accept bare state arrays from synapse-rust', async () => {
      const data = [{ event_type: 'm.room.name', content: { name: 'Room' } }]
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })

      const result = await synapseRustExtensionsService.getRoomSummaryState('!room:server')
      expect(result).toHaveLength(1)
      expect(result[0].event_type).toBe('m.room.name')
    })

    it('should accept bare stats objects from synapse-rust', async () => {
      const data = { room_id: '!r', total_messages: 5 }
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data)
      })

      const result = await synapseRustExtensionsService.getRoomSummaryStats('!room:server')
      expect(result?.total_messages).toBe(5)
    })
  })

  it('should clear access token', () => {
    synapseRustExtensionsService.clear()
    expect((synapseRustExtensionsService as any).accessToken).toBe('')
  })
})
