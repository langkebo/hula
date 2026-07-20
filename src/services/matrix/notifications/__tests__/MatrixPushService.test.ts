import type { IPusher } from 'matrix-js-sdk'
import { PushRuleActionName } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import { matrixPushService } from '../MatrixPushService'

const TEST_BASE_URL = 'https://matrix.example.com'
const PREFIX_V3 = '/_matrix/client/v3'

const server = setupMswServer(
  // getPushers
  http.get(`${TEST_BASE_URL}/_matrix/client/v3/pushers`, () => {
    return HttpResponse.json({ pushers: [{ pushkey: 'pk1', app_id: 'app' }] })
  }),
  // unregisterPusher / registerPusher
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/pushers/set`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(body as Record<string, unknown>)
  }),
  // muteRoom / addPushRule (general scope/kind/ruleId pattern)
  http.put(`${TEST_BASE_URL}/_matrix/client/v3/pushrules/:scope/:kind/:ruleId`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(body as Record<string, unknown>)
  }),
  // unmuteRoom / deletePushRule
  http.delete(`${TEST_BASE_URL}/_matrix/client/v3/pushrules/:scope/:kind/:ruleId`, () => {
    return HttpResponse.json({})
  }),
  // setPushRuleEnabled
  http.put(`${TEST_BASE_URL}/_matrix/client/v3/pushrules/:scope/:kind/:ruleId/enabled`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(body as Record<string, unknown>)
  }),
  // setPushRuleActions
  http.put(`${TEST_BASE_URL}/_matrix/client/v3/pushrules/:scope/:kind/:ruleId/actions`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json(body as Record<string, unknown>)
  })
)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const mockAuthedRequest = vi
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

describe('MatrixPushService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue({
      http: { authedRequest: mockAuthedRequest },
      getPushRules: vi.fn().mockResolvedValue({
        global: { room: [{ rule_id: '!room:server', enabled: true }] }
      }),
      getDeviceId: () => 'TEST_DEVICE_ID'
    })
  })

  describe('getPushers', () => {
    it('should get pushers list', async () => {
      const result = await matrixPushService.getPushers()
      expect(result).toHaveLength(1)
    })

    it('should return empty array when no pushers', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_matrix/client/v3/pushers`, () => {
          return HttpResponse.json({})
        })
      )
      const result = await matrixPushService.getPushers()
      expect(result).toEqual([])
    })

    it('should throw on error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_matrix/client/v3/pushers`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      await expect(matrixPushService.getPushers()).rejects.toThrow('HTTP 500')
    })
  })

  describe('getPushRules', () => {
    it('should get push rules', async () => {
      const result = await matrixPushService.getPushRules()
      expect(result.global.room).toHaveLength(1)
    })
  })

  describe('unregisterPusher', () => {
    it('should unregister pusher', async () => {
      await matrixPushService.unregisterPusher('pk1', 'app')
      expect(mockAuthedRequest).toHaveBeenCalled()
      const call = mockAuthedRequest.mock.calls[0]
      expect(call[0]).toBe('POST')
      expect(call[1]).toBe('/pushers/set')
    })
  })

  describe('registerPusher', () => {
    it('should register pusher', async () => {
      await matrixPushService.registerPusher({
        pushkey: 'pk1',
        kind: 'http',
        app_id: 'app',
        app_display_name: 'App',
        device_display_name: 'Dev',
        lang: 'en',
        data: { url: 'https://push.example.com' }
      } as IPusher)
      expect(mockAuthedRequest).toHaveBeenCalled()
      const call = mockAuthedRequest.mock.calls[0]
      expect(call[0]).toBe('POST')
      expect(call[1]).toBe('/pushers/set')
    })
  })

  describe('muteRoom / unmuteRoom', () => {
    it('should mute room', async () => {
      await matrixPushService.muteRoom('!room:server')
      expect(mockAuthedRequest).toHaveBeenCalled()
      const call = mockAuthedRequest.mock.calls[0]
      expect(call[0]).toBe('PUT')
      expect(call[1]).toContain('pushrules/global/room/')
    })

    it('should unmute room', async () => {
      await matrixPushService.unmuteRoom('!room:server')
      expect(mockAuthedRequest).toHaveBeenCalled()
      const call = mockAuthedRequest.mock.calls[0]
      expect(call[0]).toBe('DELETE')
      expect(call[1]).toContain('pushrules/global/room/')
    })
  })

  describe('isRoomMuted', () => {
    it('should return true for muted room', async () => {
      const result = await matrixPushService.isRoomMuted('!room:server')
      expect(result).toBe(true)
    })

    it('should return false for unmuted room', async () => {
      const result = await matrixPushService.isRoomMuted('!other:server')
      expect(result).toBe(false)
    })
  })

  describe('addPushRule / deletePushRule', () => {
    it('should add push rule', async () => {
      await matrixPushService.addPushRule('global', 'room', '!room:server', [PushRuleActionName.Notify])
      expect(mockAuthedRequest).toHaveBeenCalled()
      const call = mockAuthedRequest.mock.calls[0]
      expect(call[0]).toBe('PUT')
      expect(call[1]).toContain('pushrules/global/room/')
    })

    it('should delete push rule', async () => {
      await matrixPushService.deletePushRule('global', 'room', '!room:server')
      expect(mockAuthedRequest).toHaveBeenCalled()
      const call = mockAuthedRequest.mock.calls[0]
      expect(call[0]).toBe('DELETE')
      expect(call[1]).toContain('pushrules/global/room/')
    })
  })

  describe('setPushRuleEnabled / setPushRuleActions', () => {
    it('should set push rule enabled', async () => {
      await matrixPushService.setPushRuleEnabled('global', 'room', '!room:server', false)
      expect(mockAuthedRequest).toHaveBeenCalled()
      const call = mockAuthedRequest.mock.calls[0]
      expect(call[0]).toBe('PUT')
      expect(call[1]).toContain('/enabled')
    })

    it('should set push rule actions', async () => {
      await matrixPushService.setPushRuleActions('global', 'room', '!room:server', [PushRuleActionName.DontNotify])
      expect(mockAuthedRequest).toHaveBeenCalled()
      const call = mockAuthedRequest.mock.calls[0]
      expect(call[0]).toBe('PUT')
      expect(call[1]).toContain('/actions')
    })
  })
})
