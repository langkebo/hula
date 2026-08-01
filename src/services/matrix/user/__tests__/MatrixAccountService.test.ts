import type { MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { matrixAccountService } from '../MatrixAccountService'

const TEST_BASE_URL = 'https://matrix.example.com'
const PREFIX_V3 = '/_matrix/client/v3'

const server = setupMswServer(
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/capabilities`, () => {
    return HttpResponse.json({ capabilities: { 'm.room.tombstone': { enabled: true } } })
  }),
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/thirdparty/protocols`, () => {
    return HttpResponse.json({ irc: { fields: ['network'] } })
  }),
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/my_rooms`, () => {
    return HttpResponse.json({ room_ids: ['!room1:server', '!room2:server'] })
  }),
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/events`, () => {
    return HttpResponse.json({ chunk: [], end: 'token1' })
  })
)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const mockAuthedRequest = vi
  .fn()
  .mockImplementation(async (method: string, path: string, queryParams?: unknown, body?: unknown) => {
    const defaultPrefix = path.startsWith('/_') ? '' : PREFIX_V3
    const url = new URL(`${TEST_BASE_URL}${defaultPrefix}${path}`)
    if (queryParams && typeof queryParams === 'object') {
      for (const [key, value] of Object.entries(queryParams as Record<string, string>)) {
        url.searchParams.set(key, value)
      }
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-access-token'
    }
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return response.json()
  })

describe('MatrixAccountService', () => {
  let mockClient: {
    setDisplayName: ReturnType<typeof vi.fn>
    setAvatarUrl: ReturnType<typeof vi.fn>
    getProfileInfo: ReturnType<typeof vi.fn>
    getUserId: ReturnType<typeof vi.fn>
    getDeviceId: ReturnType<typeof vi.fn>
    getDevices: ReturnType<typeof vi.fn>
    setDeviceName: ReturnType<typeof vi.fn>
    deleteDevice: ReturnType<typeof vi.fn>
    deleteMultipleDevices: ReturnType<typeof vi.fn>
    setPresence: ReturnType<typeof vi.fn>
    getAccountData: ReturnType<typeof vi.fn>
    setAccountData: ReturnType<typeof vi.fn>
    getCapabilitiesManager: ReturnType<typeof vi.fn>
    getThirdPartyManager: ReturnType<typeof vi.fn>
    http: { authedRequest: ReturnType<typeof vi.fn> }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockClient = {
      setDisplayName: vi.fn().mockResolvedValue({}),
      setAvatarUrl: vi.fn().mockResolvedValue({}),
      getProfileInfo: vi.fn().mockResolvedValue({
        displayname: 'Test User',
        avatar_url: 'mxc://server/avatar'
      }),
      getUserId: vi.fn(() => '@user:server'),
      getDeviceId: vi.fn(() => 'DEVICE1'),
      getDevices: vi.fn().mockResolvedValue({ devices: [] }),
      setDeviceName: vi.fn().mockResolvedValue({}),
      deleteDevice: vi.fn().mockResolvedValue({}),
      deleteMultipleDevices: vi.fn().mockResolvedValue({}),
      setPresence: vi.fn().mockResolvedValue({}),
      getAccountData: vi.fn().mockReturnValue(null),
      setAccountData: vi.fn().mockResolvedValue(undefined),
      getCapabilitiesManager: vi.fn().mockReturnValue({
        getCapabilities: vi.fn().mockResolvedValue(undefined)
      }),
      getThirdPartyManager: vi.fn().mockReturnValue({
        getThirdpartyProtocols: vi.fn().mockResolvedValue({})
      }),
      http: { authedRequest: mockAuthedRequest }
    }
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as unknown as MatrixClient)
  })

  describe('updateDisplayName', () => {
    it('should update display name successfully', async () => {
      const result = await matrixAccountService.updateDisplayName('New Name')
      expect(result).toBe(true)
      expect(mockClient.setDisplayName).toHaveBeenCalledWith('New Name')
    })

    it('should throw when client not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      await expect(matrixAccountService.updateDisplayName('test')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('updateAvatar', () => {
    it('should update avatar successfully', async () => {
      const result = await matrixAccountService.updateAvatar('mxc://server/new')
      expect(result).toBe(true)
      expect(mockClient.setAvatarUrl).toHaveBeenCalledWith('mxc://server/new')
    })
  })

  describe('getDevices', () => {
    it('should get device list', async () => {
      mockClient.getDevices.mockResolvedValue([{ device_id: 'D1', display_name: 'Desktop' }])

      const result = await matrixAccountService.getDevices()
      expect(result).toHaveLength(1)
      expect(result[0].deviceId).toBe('D1')
    })
  })

  describe('getCapabilities', () => {
    it('should get capabilities', async () => {
      const mockCaps = { capabilities: { 'm.room.tombstone': { enabled: true } } }
      mockClient.getCapabilitiesManager = vi.fn().mockReturnValue({
        getCapabilities: vi.fn().mockResolvedValue(mockCaps)
      })

      const result = await matrixAccountService.getCapabilities()
      expect(result).toEqual(mockCaps)
      expect(mockClient.getCapabilitiesManager).toHaveBeenCalled()
    })

    it('should return empty object on error', async () => {
      mockClient.getCapabilitiesManager = vi.fn().mockReturnValue({
        getCapabilities: vi.fn().mockRejectedValue(new Error('HTTP 500'))
      })
      const result = await matrixAccountService.getCapabilities()
      expect(result).toEqual({})
    })
  })

  describe('getThirdPartyProtocols', () => {
    it('should get third party protocols', async () => {
      const mockProtocols = { irc: { fields: ['network'] } }
      mockClient.getThirdPartyManager = vi.fn().mockReturnValue({
        getThirdpartyProtocols: vi.fn().mockResolvedValue(mockProtocols)
      })

      const result = await matrixAccountService.getThirdPartyProtocols()
      expect(result).toEqual(mockProtocols)
      expect(mockClient.getThirdPartyManager).toHaveBeenCalled()
    })
  })

  describe('getMyRooms', () => {
    it('should get my rooms', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}${PREFIX_V3}/my_rooms`, () => {
          return HttpResponse.json({ room_ids: ['!room1:server', '!room2:server'] })
        })
      )

      const result = await matrixAccountService.getMyRooms()
      expect(result).toEqual(['!room1:server', '!room2:server'])
    })

    it('should return empty array on error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}${PREFIX_V3}/my_rooms`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      const result = await matrixAccountService.getMyRooms()
      expect(result).toEqual([])
    })
  })

  describe('getEventStream', () => {
    it('should get event stream with params', async () => {
      const mockEvents = { chunk: [], end: 'token1' }
      server.use(
        http.get(`${TEST_BASE_URL}${PREFIX_V3}/events`, () => {
          return HttpResponse.json(mockEvents)
        })
      )

      const result = await matrixAccountService.getEventStream('from_token', 15000)
      expect(result).toEqual(mockEvents)
      expect(mockAuthedRequest).toHaveBeenCalledWith('GET', '/events', {
        timeout: '15000',
        from: 'from_token'
      })
    })

    it('should return empty object on error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}${PREFIX_V3}/events`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      const result = await matrixAccountService.getEventStream()
      expect(result).toEqual({})
    })
  })

  describe('setPresence', () => {
    it('should set presence with status message', async () => {
      const result = await matrixAccountService.setPresence('online', 'Working')
      expect(result).toBe(true)
      expect(mockClient.setPresence).toHaveBeenCalledWith('online', { status_msg: 'Working' })
    })
  })

  describe('getAccountData', () => {
    it('should return account data content when available', async () => {
      const mockAccountDataEvent = {
        getContent: vi.fn().mockReturnValue({ badges: [{ id: 'badge1' }] })
      }
      const mockClientWithData = {
        ...mockClient,
        getAccountData: vi.fn().mockReturnValue(mockAccountDataEvent)
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClientWithData as unknown as MatrixClient)

      const result = await matrixAccountService.getAccountData('m.badges')
      expect(result).toEqual({ badges: [{ id: 'badge1' }] })
      expect(mockClientWithData.getAccountData).toHaveBeenCalledWith('m.badges')
    })

    it('should return null when no account data exists', async () => {
      const mockClientWithData = {
        ...mockClient,
        getAccountData: vi.fn().mockReturnValue(null)
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClientWithData as unknown as MatrixClient)

      const result = await matrixAccountService.getAccountData('m.badges')
      expect(result).toBeNull()
    })

    it('should return null when account data has no content', async () => {
      const mockAccountDataEvent = {
        getContent: vi.fn().mockReturnValue(null)
      }
      const mockClientWithData = {
        ...mockClient,
        getAccountData: vi.fn().mockReturnValue(mockAccountDataEvent)
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClientWithData as unknown as MatrixClient)

      const result = await matrixAccountService.getAccountData('m.badges')
      expect(result).toBeNull()
    })

    it('should return null on error', async () => {
      const mockClientWithData = {
        ...mockClient,
        getAccountData: vi.fn().mockImplementation(() => {
          throw new Error('Network error')
        })
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClientWithData as unknown as MatrixClient)

      const result = await matrixAccountService.getAccountData('m.badges')
      expect(result).toBeNull()
    })
  })

  describe('setAccountData', () => {
    it('should set account data successfully', async () => {
      const mockClientWithData = {
        ...mockClient,
        setAccountData: vi.fn().mockResolvedValue(undefined)
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClientWithData as unknown as MatrixClient)

      await expect(matrixAccountService.setAccountData('m.badges', { wearingItemId: 'badge1' })).resolves.not.toThrow()
      expect(mockClientWithData.setAccountData).toHaveBeenCalledWith('m.badges', {
        wearingItemId: 'badge1'
      })
    })

    it('should throw when setAccountData fails', async () => {
      const error = new Error('Server error')
      const mockClientWithData = {
        ...mockClient,
        setAccountData: vi.fn().mockRejectedValue(error)
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClientWithData as unknown as MatrixClient)

      await expect(matrixAccountService.setAccountData('m.badges', {})).rejects.toThrow('Server error')
    })
  })
})
