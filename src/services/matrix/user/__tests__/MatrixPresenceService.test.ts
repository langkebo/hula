import type { MatrixClient, PresenceManager } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixPresenceService } from '../MatrixPresenceService'

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(),
    waitForClientReady: vi.fn()
  }
}))

describe('MatrixPresenceService', () => {
  let mockClient: Partial<MatrixClient>
  let mockHttp: { authedRequest: ReturnType<typeof vi.fn> }
  let mockPresenceManager: {
    setPresence: ReturnType<typeof vi.fn>
    getPresence: ReturnType<typeof vi.fn>
    subscribeToPresence: ReturnType<typeof vi.fn>
    unsubscribeFromPresence: ReturnType<typeof vi.fn>
    getPresenceList: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockHttp = {
      authedRequest: vi.fn()
    }

    mockPresenceManager = {
      setPresence: vi.fn(),
      getPresence: vi.fn(),
      subscribeToPresence: vi.fn(),
      unsubscribeFromPresence: vi.fn(),
      getPresenceList: vi.fn()
    }

    mockClient = {
      http: mockHttp as unknown as MatrixClient['http'],
      getPresenceManager: vi.fn(() => mockPresenceManager as unknown as PresenceManager),
      getUserId: vi.fn(() => '@user:example.com'),
      on: vi.fn(),
      off: vi.fn()
    }

    vi.mocked(matrixClientService.getClient).mockReset()
    vi.mocked(matrixClientService.waitForClientReady).mockReset()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)
    vi.mocked(matrixClientService.waitForClientReady).mockResolvedValue(mockClient as MatrixClient)
  })

  describe('setPresence', () => {
    it('should set presence using presenceManager', async () => {
      mockPresenceManager.setPresence.mockResolvedValue(undefined)

      await matrixPresenceService.setPresence('online', 'Working')

      expect(mockPresenceManager.setPresence).toHaveBeenCalledWith('@user:example.com', 'online', 'Working')
    })

    it('should fallback to HTTP API when presenceManager is unavailable', async () => {
      mockClient.getPresenceManager = vi.fn(() => null)
      mockHttp.authedRequest.mockResolvedValue({})

      await matrixPresenceService.setPresence('unavailable', 'Busy')

      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'PUT',
        '/_matrix/client/v3/presence/%40user%3Aexample.com/status',
        undefined,
        { presence: 'unavailable', status_msg: 'Busy' }
      )
    })

    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      vi.mocked(matrixClientService.waitForClientReady).mockRejectedValue(
        new Error('Matrix client initialization timeout')
      )

      await expect(matrixPresenceService.setPresence('online')).rejects.toThrow()
    })
  })

  describe('getPresence', () => {
    it('should get presence using presenceManager', async () => {
      mockPresenceManager.getPresence.mockResolvedValue({
        presence: 'online',
        status_msg: 'Working',
        last_active_ago: 60000,
        currently_active: true
      })

      const result = await matrixPresenceService.getPresence('@other:example.com')

      expect(result).toEqual({
        user_id: '@other:example.com',
        presence: 'online',
        status_msg: 'Working',
        last_active_ago: 60000,
        currently_active: true
      })
    })

    it('should fallback to HTTP API when presenceManager is unavailable', async () => {
      mockClient.getPresenceManager = vi.fn(() => null)
      mockHttp.authedRequest.mockResolvedValue({
        presence: 'offline',
        last_active_ago: 300000
      })

      const result = await matrixPresenceService.getPresence('@other:example.com')

      expect(result.user_id).toBe('@other:example.com')
      expect(result.presence).toBe('offline')
    })
  })

  describe('getCurrentPresence', () => {
    it('should get current user presence', async () => {
      mockPresenceManager.getPresence.mockResolvedValue({
        presence: 'online',
        status_msg: null,
        last_active_ago: 0,
        currently_active: true
      })

      const result = await matrixPresenceService.getCurrentPresence()

      expect(result.user_id).toBe('@user:example.com')
    })
  })

  describe('subscribeToPresence', () => {
    it('should subscribe using presenceManager', async () => {
      const mockResponse = { presences: [] }
      mockPresenceManager.subscribeToPresence.mockResolvedValue(mockResponse)

      const result = await matrixPresenceService.subscribeToPresence(['@a:example.com', '@b:example.com'])

      expect(mockPresenceManager.subscribeToPresence).toHaveBeenCalledWith(['@a:example.com', '@b:example.com'])
      expect(result).toEqual(mockResponse)
    })

    it('should fallback to HTTP API', async () => {
      mockClient.getPresenceManager = vi.fn(() => null)
      mockHttp.authedRequest.mockResolvedValue({ presences: [] })

      await matrixPresenceService.subscribeToPresence(['@a:example.com'])

      expect(mockHttp.authedRequest).toHaveBeenCalledWith('POST', '/_matrix/client/v3/presence/list', undefined, {
        subscribe: ['@a:example.com']
      })
    })
  })

  describe('unsubscribeFromPresence', () => {
    it('should unsubscribe using presenceManager', async () => {
      mockPresenceManager.unsubscribeFromPresence.mockResolvedValue(undefined)

      await matrixPresenceService.unsubscribeFromPresence(['@a:example.com'])

      expect(mockPresenceManager.unsubscribeFromPresence).toHaveBeenCalledWith(['@a:example.com'])
    })
  })

  describe('getBatchPresence', () => {
    it('should get presence for multiple users', async () => {
      mockPresenceManager.getPresence
        .mockResolvedValueOnce({ presence: 'online', last_active_ago: 1000 })
        .mockResolvedValueOnce({ presence: 'offline', last_active_ago: 5000 })

      const result = await matrixPresenceService.getBatchPresence(['@a:example.com', '@b:example.com'])

      expect(result).toHaveLength(2)
      expect(result[0].user_id).toBe('@a:example.com')
      expect(result[0].presence).toBe('online')
      expect(result[1].user_id).toBe('@b:example.com')
      expect(result[1].presence).toBe('offline')
    })

    it('should continue on individual errors', async () => {
      mockPresenceManager.getPresence
        .mockRejectedValueOnce(new Error('not found'))
        .mockResolvedValueOnce({ presence: 'online', last_active_ago: 1000 })

      const result = await matrixPresenceService.getBatchPresence(['@a:example.com', '@b:example.com'])

      expect(result).toHaveLength(1)
      expect(result[0].user_id).toBe('@b:example.com')
    })
  })

  describe('onPresenceChange', () => {
    it('should register immediately when client is available', () => {
      const handler = vi.fn()

      const unsubscribe = matrixPresenceService.onPresenceChange(handler)

      expect(mockClient.on).toHaveBeenCalledTimes(1)
      unsubscribe()
      expect(mockClient.off).toHaveBeenCalledTimes(1)
    })

    it('should register after client becomes ready', async () => {
      const readyClient = {
        ...mockClient,
        on: vi.fn(),
        off: vi.fn()
      } as MatrixClient

      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      vi.mocked(matrixClientService.waitForClientReady).mockResolvedValue(readyClient)

      matrixPresenceService.onPresenceChange(vi.fn())
      await Promise.resolve()
      await Promise.resolve()

      expect(readyClient.on).toHaveBeenCalledTimes(1)
    })
  })
})
