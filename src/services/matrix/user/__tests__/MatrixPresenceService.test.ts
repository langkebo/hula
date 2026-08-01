import type { MatrixClient, PresenceManager } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { matrixPresenceService } from '../MatrixPresenceService'

const TEST_BASE_URL = 'https://matrix.example.com'
const PREFIX_V3 = '/_matrix/client/v3'

const _server = setupMswServer(
  http.put(`${TEST_BASE_URL}/_matrix/client/v3/presence/:userId/status`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(body as Record<string, unknown>)
  }),
  http.get(`${TEST_BASE_URL}/_matrix/client/v3/presence/:userId/status`, () => {
    return HttpResponse.json({ presence: 'offline', last_active_ago: 300000 })
  }),
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/presence/list`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ presences: [], ...(body as Record<string, unknown>) })
  }),
  http.get(`${TEST_BASE_URL}/_matrix/client/v3/presence/list/:userId`, () => {
    return HttpResponse.json({ presences: [] })
  })
)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixPresenceService', () => {
  let mockClient: Partial<MatrixClient>
  let mockHttp: { authedRequest: ReturnType<typeof vi.fn> }
  let mockPresenceManager: {
    setPresence: ReturnType<typeof vi.fn>
    getPresence: ReturnType<typeof vi.fn>
    subscribeToPresence: ReturnType<typeof vi.fn>
    updatePresenceList: ReturnType<typeof vi.fn>
    unsubscribeFromPresence: ReturnType<typeof vi.fn>
    getPresenceList: ReturnType<typeof vi.fn>
  }

  const authedRequestImpl = vi
    .fn()
    .mockImplementation(async (method: string, path: string, _queryParams?: unknown, body?: unknown) => {
      const prefixedPath = path.startsWith('/_') ? path : `${PREFIX_V3}${path}`
      const url = `${TEST_BASE_URL}${prefixedPath}`
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-access-token'
      }
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.json()
    })

  beforeEach(() => {
    vi.clearAllMocks()

    mockPresenceManager = {
      setPresence: vi.fn(),
      getPresence: vi.fn(),
      subscribeToPresence: vi.fn(),
      updatePresenceList: vi.fn(),
      unsubscribeFromPresence: vi.fn(),
      getPresenceList: vi.fn()
    }

    mockHttp = {
      authedRequest: authedRequestImpl
    }

    mockClient = {
      http: mockHttp as unknown as MatrixClient['http'],
      getPresenceManager: vi.fn(() => mockPresenceManager as unknown as PresenceManager),
      getUserId: vi.fn(() => '@user:example.com'),
      on: vi.fn(),
      off: vi.fn()
    }

    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as MatrixClient)
    vi.spyOn(matrixClientService, 'waitForClientReady').mockResolvedValue(mockClient as MatrixClient)
  })

  describe('setPresence', () => {
    it('should set presence using presenceManager', async () => {
      mockPresenceManager.setPresence.mockResolvedValue(undefined)

      await matrixPresenceService.setPresence('online', 'Working')

      expect(mockPresenceManager.setPresence).toHaveBeenCalledWith('online', 'Working')
    })

    it('should throw when presenceManager throws', async () => {
      mockPresenceManager.setPresence.mockRejectedValue(new Error('Network error'))

      await expect(matrixPresenceService.setPresence('unavailable', 'Busy')).rejects.toThrow('Network error')
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

    it('should return offline when presence is forbidden', async () => {
      const forbiddenError = new Error('Forbidden') as Error & { httpStatus: number; errcode?: string }
      forbiddenError.httpStatus = 403
      forbiddenError.errcode = 'M_FORBIDDEN'
      mockPresenceManager.getPresence.mockRejectedValue(forbiddenError)

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
    it('should subscribe using updatePresenceList', async () => {
      const mockResponse = { presences: [] }
      mockPresenceManager.updatePresenceList.mockResolvedValue(mockResponse)

      const result = await matrixPresenceService.subscribeToPresence(['@a:example.com', '@b:example.com'])

      expect(mockPresenceManager.updatePresenceList).toHaveBeenCalledWith(['@a:example.com', '@b:example.com'], undefined)
      expect(result).toEqual(mockResponse)
    })

    it('should pass unsubscribe ids to updatePresenceList', async () => {
      mockPresenceManager.updatePresenceList.mockResolvedValue({ presences: [] })

      await matrixPresenceService.subscribeToPresence(['@alice:server'], ['@bob:server'])

      expect(mockPresenceManager.updatePresenceList).toHaveBeenCalledWith(['@alice:server'], ['@bob:server'])
    })

    it('should propagate errors from updatePresenceList', async () => {
      mockPresenceManager.updatePresenceList.mockRejectedValue(new Error('Network error'))

      await expect(matrixPresenceService.subscribeToPresence(['@a:example.com'])).rejects.toThrow('Network error')
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
      } as unknown as MatrixClient

      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      vi.mocked(matrixClientService.waitForClientReady).mockResolvedValue(readyClient)

      matrixPresenceService.onPresenceChange(vi.fn())
      await Promise.resolve()
      await Promise.resolve()

      expect(readyClient.on).toHaveBeenCalledTimes(1)
    })
  })
})
