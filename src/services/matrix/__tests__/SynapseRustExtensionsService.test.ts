import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../MatrixClientService', () => ({
  default: {
    getClient: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('SynapseRustExtensionsService', () => {
  let synapseRustExtensionsService: typeof import('../SynapseRustExtensionsService').synapseRustExtensionsService
  let matrixClientService: typeof import('../MatrixClientService').default

  const mockFetch = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
    synapseRustExtensionsService = (await import('../SynapseRustExtensionsService')).synapseRustExtensionsService
    matrixClientService = (await import('../MatrixClientService')).default

    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getHomeserverUrl: vi.fn(() => 'https://matrix.example.com'),
      getAccessToken: vi.fn(() => 'test-token'),
      getUserId: vi.fn(() => '@user:example.com')
    } as any)

    ;(synapseRustExtensionsService as any).baseUrl = 'https://matrix.example.com'
    ;(synapseRustExtensionsService as any).accessToken = 'test-token'
  })

  describe('getFriends', () => {
    it('should get friends list', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ user_id: '@friend:server', display_name: 'Friend' }] })
      })
      const result = await synapseRustExtensionsService.getFriends()
      expect(result).toHaveLength(1)
      expect(result[0].user_id).toBe('@friend:server')
    })

    it('should return empty array on error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'unauthorized' })
      })
      const result = await synapseRustExtensionsService.getFriends()
      expect(result).toEqual([])
    })
  })

  describe('sendFriendRequest', () => {
    it('should send friend request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { request_id: 1, status: 'pending' } })
      })
      const result = await synapseRustExtensionsService.sendFriendRequest('@user:server')
      expect(result.request_id).toBe(1)
    })

    it('should throw on error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'forbidden' })
      })
      await expect(synapseRustExtensionsService.sendFriendRequest('@user:server')).rejects.toThrow()
    })
  })

  describe('checkFriendship', () => {
    it('should return true for friends', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { are_friends: true } })
      })
      const result = await synapseRustExtensionsService.checkFriendship('@friend:server')
      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'not found' })
      })
      const result = await synapseRustExtensionsService.checkFriendship('@friend:server')
      expect(result).toBe(false)
    })
  })

  describe('removeFriend', () => {
    it('should remove friend', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' })
      })
      await expect(synapseRustExtensionsService.removeFriend('@friend:server')).resolves.toBeUndefined()
    })
  })

  describe('getBurnStats', () => {
    it('should get burn stats', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { total_burned: 5, total_pending: 2, rooms_with_burn_enabled: 3 } })
      })
      const result = await synapseRustExtensionsService.getBurnStats()
      expect(result.total_burned).toBe(5)
      expect(result.rooms_with_burn_enabled).toBe(3)
    })

    it('should return defaults on error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'fail' })
      })
      const result = await synapseRustExtensionsService.getBurnStats()
      expect(result.total_burned).toBe(0)
    })
  })

  describe('enableBurnAfterRead', () => {
    it('should enable burn after read', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' })
      })
      await expect(synapseRustExtensionsService.enableBurnAfterRead('!room:server', true)).resolves.toBeUndefined()
    })
  })

  describe('isBurnAfterReadEnabled', () => {
    it('should check burn status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { enabled: true } })
      })
      const result = await synapseRustExtensionsService.isBurnAfterReadEnabled('!room:server')
      expect(result).toBe(true)
    })
  })

  describe('enableAntiScreenshot', () => {
    it('should enable anti screenshot', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' })
      })
      await expect(synapseRustExtensionsService.enableAntiScreenshot('!room:server', true)).resolves.toBeUndefined()
    })
  })

  describe('getInviteBlocklist', () => {
    it('should get invite blocklist', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { blocked_users: ['@bad:server'], updated_ts: 123 } })
      })
      const result = await synapseRustExtensionsService.getInviteBlocklist('!room:server')
      expect(result.blocked_users).toHaveLength(1)
    })
  })

  describe('getRoomSummary', () => {
    it('should get room summary', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
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
          })
      })
      const result = await synapseRustExtensionsService.getRoomSummary('!room:server')
      expect(result?.room_id).toBe('!room:server')
      expect(result?.name).toBe('Test Room')
    })

    it('should return null on error when throwOnError is false', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'not found' })
      })
      const result = await synapseRustExtensionsService.getRoomSummary('!room:server', false)
      expect(result).toBeNull()
    })
  })

  describe('stop', () => {
    it('should clear access token', () => {
      synapseRustExtensionsService.stop()
      expect((synapseRustExtensionsService as any).accessToken).toBe('')
    })
  })
})
