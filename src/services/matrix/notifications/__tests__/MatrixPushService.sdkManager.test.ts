import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type IPusher, PushRuleActionName } from '@/services/matrix/sdk'
import { matrixPushService } from '../MatrixPushService'

/**
 * FT-112: Push operations must go through the SDK PushManager via client.getPushManager(),
 * never through client.http.authedRequest.
 *
 * These tests verify the SDK-direct contract for the 9 push methods that previously
 * either bypassed the SDK Manager or fell back to HTTP when the manager was unavailable.
 * The mock client deliberately omits `http.authedRequest` — any fallback would throw.
 */
describe('MatrixPushService — SDK PushManager (FT-112)', () => {
  let pushManagerMocks: Record<string, ReturnType<typeof vi.fn>>

  function buildMockClient() {
    const client: Record<string, unknown> = {
      getDeviceId: () => 'TEST_DEVICE_ID',
      getPushRules: vi.fn().mockResolvedValue({
        global: { room: [{ rule_id: '!room:server', enabled: true }] }
      }),
      getPushManager: () => pushManagerMocks
    }
    return client
  }

  beforeEach(() => {
    vi.clearAllMocks()
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

  // ---- getPushers ----
  describe('getPushers', () => {
    it('getPushers 仅依赖 getPushManager，不依赖 http.authedRequest', async () => {
      pushManagerMocks.getPushers.mockResolvedValue([{ app_id: 'a', pushkey: 'k', kind: 'http' }])
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient())

      const result = await matrixPushService.getPushers()
      expect(result).toHaveLength(1)
      expect(pushManagerMocks.getPushers).toHaveBeenCalledTimes(1)
    })
  })

  // ---- setPushRuleEnabled ----
  describe('setPushRuleEnabled', () => {
    it('直接调用 getPushManager().setPushRuleEnabled，不依赖 http.authedRequest', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient())
      await matrixPushService.setPushRuleEnabled('global', 'room', '!room:server', false)
      expect(pushManagerMocks.setPushRuleEnabled).toHaveBeenCalledWith('global', 'room', '!room:server', false)
    })

    it('getPushManager 缺失时不再回退到 http.authedRequest（直接抛出）', async () => {
      const mockAuthedRequest = vi.fn().mockResolvedValue({})
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue({
        getPushManager: () => undefined,
        http: { authedRequest: mockAuthedRequest },
        getDeviceId: () => 'TEST_DEVICE_ID'
      })

      await expect(matrixPushService.setPushRuleEnabled('global', 'room', '!room:server', false)).rejects.toThrow()
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })
  })

  // ---- setPushRuleActions ----
  describe('setPushRuleActions', () => {
    it('直接调用 getPushManager().setPushRuleActions，不依赖 http.authedRequest', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient())
      const actions = [PushRuleActionName.DontNotify]
      await matrixPushService.setPushRuleActions('global', 'room', '!room:server', actions)
      expect(pushManagerMocks.setPushRuleActions).toHaveBeenCalledWith('global', 'room', '!room:server', actions)
    })
  })

  // ---- muteRoom ----
  describe('muteRoom', () => {
    it('直接调用 getPushManager().muteRoom，不依赖 http.authedRequest', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient())
      await matrixPushService.muteRoom('!room:server')
      expect(pushManagerMocks.muteRoom).toHaveBeenCalledWith('!room:server')
    })
  })

  // ---- unmuteRoom ----
  describe('unmuteRoom', () => {
    it('直接调用 getPushManager().unmuteRoom，不依赖 http.authedRequest', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient())
      await matrixPushService.unmuteRoom('!room:server')
      expect(pushManagerMocks.unmuteRoom).toHaveBeenCalledWith('!room:server')
    })
  })

  // ---- addPushRule ----
  describe('addPushRule', () => {
    it('直接调用 getPushManager().createPushRule，组装 conditions/pattern', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient())
      const actions = [PushRuleActionName.Notify]
      const conditions = [{ kind: 'event_match', key: 'content.body', pattern: 'foo' }]
      await matrixPushService.addPushRule('global', 'override', '!rule:server', actions, conditions, 'foo')
      expect(pushManagerMocks.createPushRule).toHaveBeenCalledWith('global', 'override', '!rule:server', {
        actions,
        conditions,
        pattern: 'foo'
      })
    })
  })

  // ---- deletePushRule ----
  describe('deletePushRule', () => {
    it('直接调用 getPushManager().deletePushRule，不依赖 http.authedRequest', async () => {
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue(buildMockClient())
      await matrixPushService.deletePushRule('global', 'room', '!room:server')
      expect(pushManagerMocks.deletePushRule).toHaveBeenCalledWith('global', 'room', '!room:server')
    })
  })
})
