import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixAccountService } from '../MatrixAccountService'
import matrixClientService from '../../MatrixClientService'

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
    http: { authedRequest: ReturnType<typeof vi.fn> }
  }

  beforeEach(() => {
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
      http: { authedRequest: vi.fn().mockResolvedValue({}) }
    }
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)
  })

  describe('updateDisplayName', () => {
    it('should update display name successfully', async () => {
      const result = await matrixAccountService.updateDisplayName('New Name')
      expect(result).toBe(true)
      expect(mockClient.setDisplayName).toHaveBeenCalledWith('New Name')
    })

    it('should throw when client not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)
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
      mockClient.http.authedRequest.mockResolvedValue(mockCaps)

      const result = await matrixAccountService.getCapabilities()
      expect(result).toEqual(mockCaps)
      expect(mockClient.http.authedRequest).toHaveBeenCalledWith('GET', '/_matrix/client/v3/capabilities')
    })

    it('should return empty object on error', async () => {
      mockClient.http.authedRequest.mockRejectedValue(new Error('fail'))
      const result = await matrixAccountService.getCapabilities()
      expect(result).toEqual({})
    })
  })

  describe('getThirdPartyProtocols', () => {
    it('should get third party protocols', async () => {
      const mockProtocols = { irc: { fields: ['network'] } }
      mockClient.http.authedRequest.mockResolvedValue(mockProtocols)

      const result = await matrixAccountService.getThirdPartyProtocols()
      expect(result).toEqual(mockProtocols)
    })
  })

  describe('getMyRooms', () => {
    it('should get my rooms', async () => {
      mockClient.http.authedRequest.mockResolvedValue({ room_ids: ['!room1:server', '!room2:server'] })

      const result = await matrixAccountService.getMyRooms()
      expect(result).toEqual(['!room1:server', '!room2:server'])
    })

    it('should return empty array on error', async () => {
      mockClient.http.authedRequest.mockRejectedValue(new Error('fail'))
      const result = await matrixAccountService.getMyRooms()
      expect(result).toEqual([])
    })
  })

  describe('getEventStream', () => {
    it('should get event stream with params', async () => {
      const mockEvents = { chunk: [], end: 'token1' }
      mockClient.http.authedRequest.mockResolvedValue(mockEvents)

      const result = await matrixAccountService.getEventStream('from_token', 15000)
      expect(result).toEqual(mockEvents)
      expect(mockClient.http.authedRequest).toHaveBeenCalledWith('GET', '/_matrix/client/v3/events', {
        timeout: '15000',
        from: 'from_token'
      })
    })

    it('should return empty object on error', async () => {
      mockClient.http.authedRequest.mockRejectedValue(new Error('fail'))
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
})
