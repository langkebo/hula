import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type IPusher, PushRuleActionName } from '@/services/matrix/sdk'
import { matrixPushService } from '../MatrixPushService'

/**
 * FT-112: Push rule operations must use SDK PushManager when available,
 * falling back to direct HTTP only when the manager is unavailable.
 *
 * These tests verify the SDK-first contract for the 6 push rule methods
 * that previously bypassed the SDK Manager by calling client.http.authedRequest.
 */
describe('MatrixPushService — SDK PushManager (FT-112)', () => {
  let mockAuthedRequest: ReturnType<typeof vi.fn>
  let pushManagerMocks: Record<string, ReturnType<typeof vi.fn>>

  function buildMockClient(withPushManager: boolean) {
    const client: Record<string, unknown> = {
      http: { authedRequest: mockAuthedRequest },
      getDeviceId: () => 'TEST_DEVICE_ID',
      getPushRules: vi.fn().mockResolvedValue({
        global: { room: [{ rule_id: '!room:server', enabled: true }] }
      })
    }
    if (withPushManager) {
      client.getPushManager = () => pushManagerMocks
    }
    return client
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthedRequest = vi.fn().mockResolvedValue({})
    pushManagerMocks = {
      getPushers: vi.fn().mockResolvedValue([] as IPusher[]),
      setPusher: vi.fn().mockResolvedValue(undefined),
      removePusher: vi.fn().mockResolvedValue(undefined),
      setPushRuleEnabled: vi.fn().mockResolvedValue(undefined),
      setPushRuleActions: vi.fn().mockResolvedValue(undefined),
      createPushRule: vi.fn().mockResolvedValue(undefined),
      deletePushRule: vi.fn().mockResolvedValue(undefined),
      muteRoom: vi.fn().mockResolvedValue(undefined),
      unmuteRoom: vi.fn().mockResolvedValue(undefined)
    }
  })

  // ---- setPushRuleEnabled ----
  describe('setPushRuleEnabled', () => {
    it('uses SDK PushManager.setPushRuleEnabled when manager is available', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient(true))
      await matrixPushService.setPushRuleEnabled('global', 'room', '!room:server', false)
      expect(pushManagerMocks.setPushRuleEnabled).toHaveBeenCalledWith('global', 'room', '!room:server', false)
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })

    it('falls back to HTTP when PushManager is unavailable', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient(false))
      await matrixPushService.setPushRuleEnabled('global', 'room', '!room:server', false)
      expect(mockAuthedRequest).toHaveBeenCalledTimes(1)
      expect(mockAuthedRequest.mock.calls[0][0]).toBe('PUT')
      expect(mockAuthedRequest.mock.calls[0][1]).toContain('/enabled')
    })
  })

  // ---- setPushRuleActions ----
  describe('setPushRuleActions', () => {
    it('uses SDK PushManager.setPushRuleActions when manager is available', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient(true))
      const actions = [PushRuleActionName.DontNotify]
      await matrixPushService.setPushRuleActions('global', 'room', '!room:server', actions)
      expect(pushManagerMocks.setPushRuleActions).toHaveBeenCalledWith('global', 'room', '!room:server', actions)
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })

    it('falls back to HTTP when PushManager is unavailable', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient(false))
      await matrixPushService.setPushRuleActions('global', 'room', '!room:server', [PushRuleActionName.DontNotify])
      expect(mockAuthedRequest).toHaveBeenCalledTimes(1)
      expect(mockAuthedRequest.mock.calls[0][0]).toBe('PUT')
      expect(mockAuthedRequest.mock.calls[0][1]).toContain('/actions')
    })
  })

  // ---- muteRoom ----
  describe('muteRoom', () => {
    it('uses SDK PushManager.muteRoom when manager is available', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient(true))
      await matrixPushService.muteRoom('!room:server')
      expect(pushManagerMocks.muteRoom).toHaveBeenCalledWith('!room:server')
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })

    it('falls back to HTTP when PushManager is unavailable', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient(false))
      await matrixPushService.muteRoom('!room:server')
      expect(mockAuthedRequest).toHaveBeenCalledTimes(1)
      expect(mockAuthedRequest.mock.calls[0][0]).toBe('PUT')
      expect(mockAuthedRequest.mock.calls[0][1]).toContain('pushrules/global/room/')
    })
  })

  // ---- unmuteRoom ----
  describe('unmuteRoom', () => {
    it('uses SDK PushManager.unmuteRoom when manager is available', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient(true))
      await matrixPushService.unmuteRoom('!room:server')
      expect(pushManagerMocks.unmuteRoom).toHaveBeenCalledWith('!room:server')
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })

    it('falls back to HTTP when PushManager is unavailable', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient(false))
      await matrixPushService.unmuteRoom('!room:server')
      expect(mockAuthedRequest).toHaveBeenCalledTimes(1)
      expect(mockAuthedRequest.mock.calls[0][0]).toBe('DELETE')
      expect(mockAuthedRequest.mock.calls[0][1]).toContain('pushrules/global/room/')
    })
  })

  // ---- addPushRule ----
  describe('addPushRule', () => {
    it('uses SDK PushManager.createPushRule when manager is available', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient(true))
      const actions = [PushRuleActionName.Notify]
      const conditions = [{ kind: 'event_match', key: 'content.body', pattern: 'foo' }]
      await matrixPushService.addPushRule('global', 'override', '!rule:server', actions, conditions, 'foo')
      expect(pushManagerMocks.createPushRule).toHaveBeenCalledWith('global', 'override', '!rule:server', {
        actions,
        conditions,
        pattern: 'foo'
      })
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })

    it('falls back to HTTP when PushManager is unavailable', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient(false))
      await matrixPushService.addPushRule('global', 'room', '!room:server', [PushRuleActionName.Notify])
      expect(mockAuthedRequest).toHaveBeenCalledTimes(1)
      expect(mockAuthedRequest.mock.calls[0][0]).toBe('PUT')
      expect(mockAuthedRequest.mock.calls[0][1]).toContain('pushrules/global/room/')
    })
  })

  // ---- deletePushRule ----
  describe('deletePushRule', () => {
    it('uses SDK PushManager.deletePushRule when manager is available', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient(true))
      await matrixPushService.deletePushRule('global', 'room', '!room:server')
      expect(pushManagerMocks.deletePushRule).toHaveBeenCalledWith('global', 'room', '!room:server')
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })

    it('falls back to HTTP when PushManager is unavailable', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient(false))
      await matrixPushService.deletePushRule('global', 'room', '!room:server')
      expect(mockAuthedRequest).toHaveBeenCalledTimes(1)
      expect(mockAuthedRequest.mock.calls[0][0]).toBe('DELETE')
      expect(mockAuthedRequest.mock.calls[0][1]).toContain('pushrules/global/room/')
    })
  })
})
