import type { IPusher } from 'matrix-js-sdk'
import { PushRuleActionName } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixPushService } from '../MatrixPushService'

const mockGetPushers = vi.fn().mockResolvedValue([{ pushkey: 'pk1', app_id: 'app' }])
const mockRemovePusher = vi.fn().mockResolvedValue(undefined)
const mockSetPusher = vi.fn().mockResolvedValue(undefined)
const mockSetPushRuleEnabled = vi.fn().mockResolvedValue(undefined)
const mockSetPushRuleActions = vi.fn().mockResolvedValue(undefined)
const mockCreatePushRule = vi.fn().mockResolvedValue(undefined)
const mockDeletePushRule = vi.fn().mockResolvedValue(undefined)
const mockMuteRoom = vi.fn().mockResolvedValue(undefined)
const mockUnmuteRoom = vi.fn().mockResolvedValue(undefined)
const mockGetPushRules = vi.fn().mockResolvedValue({
  global: { room: [{ rule_id: '!room:server', enabled: true }] }
})

const mockAuthedRequest = vi
  .fn()
  .mockImplementation(async (method: string, path: string, _queryParams?: unknown, _body?: unknown) => {
    // Fallback HTTP mock - should not be called when PushManager is available
    throw new Error(`Unexpected HTTP fallback call: ${method} ${path}`)
  })

const mockPushManager = {
  getPushers: mockGetPushers,
  removePusher: mockRemovePusher,
  setPusher: mockSetPusher,
  setPushRuleEnabled: mockSetPushRuleEnabled,
  setPushRuleActions: mockSetPushRuleActions,
  createPushRule: mockCreatePushRule,
  deletePushRule: mockDeletePushRule,
  muteRoom: mockMuteRoom,
  unmuteRoom: mockUnmuteRoom
}

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixPushService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue({
      http: { authedRequest: mockAuthedRequest },
      getPushRules: mockGetPushRules,
      getDeviceId: () => 'TEST_DEVICE_ID',
      getPushManager: () => mockPushManager
    })
  })

  describe('getPushers', () => {
    it('should get pushers list via PushManager', async () => {
      const result = await matrixPushService.getPushers()
      expect(result).toHaveLength(1)
      expect(mockGetPushers).toHaveBeenCalledTimes(1)
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })

    it('should return empty array when no pushers', async () => {
      mockGetPushers.mockResolvedValueOnce([])
      const result = await matrixPushService.getPushers()
      expect(result).toEqual([])
      expect(mockGetPushers).toHaveBeenCalledTimes(1)
    })

    it('should throw on error', async () => {
      mockGetPushers.mockRejectedValueOnce(new Error('PushManager error'))
      await expect(matrixPushService.getPushers()).rejects.toThrow('PushManager error')
    })
  })

  describe('getPushRules', () => {
    it('should get push rules via client.getPushRules', async () => {
      const result = await matrixPushService.getPushRules()
      expect(result.global.room).toHaveLength(1)
      expect(mockGetPushRules).toHaveBeenCalledTimes(1)
    })
  })

  describe('unregisterPusher', () => {
    it('should unregister pusher via PushManager.removePusher', async () => {
      await matrixPushService.unregisterPusher('pk1', 'app')
      expect(mockRemovePusher).toHaveBeenCalledTimes(1)
      expect(mockRemovePusher).toHaveBeenCalledWith('pk1', 'app', 'TEST_DEVICE_ID')
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })
  })

  describe('registerPusher', () => {
    it('should register pusher via PushManager.setPusher', async () => {
      await matrixPushService.registerPusher({
        pushkey: 'pk1',
        kind: 'http',
        app_id: 'app',
        app_display_name: 'App',
        device_display_name: 'Dev',
        lang: 'en',
        data: { url: 'https://push.example.com' }
      } as IPusher)
      expect(mockSetPusher).toHaveBeenCalledTimes(1)
      expect(mockSetPusher).toHaveBeenCalledWith(
        expect.objectContaining({
          pushkey: 'pk1',
          kind: 'http',
          app_id: 'app',
          device_id: 'TEST_DEVICE_ID'
        })
      )
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })
  })

  describe('muteRoom / unmuteRoom', () => {
    it('should mute room via PushManager.muteRoom', async () => {
      await matrixPushService.muteRoom('!room:server')
      expect(mockMuteRoom).toHaveBeenCalledTimes(1)
      expect(mockMuteRoom).toHaveBeenCalledWith('!room:server')
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })

    it('should unmute room via PushManager.unmuteRoom', async () => {
      await matrixPushService.unmuteRoom('!room:server')
      expect(mockUnmuteRoom).toHaveBeenCalledTimes(1)
      expect(mockUnmuteRoom).toHaveBeenCalledWith('!room:server')
      expect(mockAuthedRequest).not.toHaveBeenCalled()
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
    it('should add push rule via PushManager.createPushRule', async () => {
      await matrixPushService.addPushRule('global', 'room', '!room:server', [PushRuleActionName.Notify])
      expect(mockCreatePushRule).toHaveBeenCalledTimes(1)
      expect(mockCreatePushRule).toHaveBeenCalledWith('global', 'room', '!room:server', {
        actions: [PushRuleActionName.Notify]
      })
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })

    it('should delete push rule via PushManager.deletePushRule', async () => {
      await matrixPushService.deletePushRule('global', 'room', '!room:server')
      expect(mockDeletePushRule).toHaveBeenCalledTimes(1)
      expect(mockDeletePushRule).toHaveBeenCalledWith('global', 'room', '!room:server')
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })
  })

  describe('setPushRuleEnabled / setPushRuleActions', () => {
    it('should set push rule enabled via PushManager.setPushRuleEnabled', async () => {
      await matrixPushService.setPushRuleEnabled('global', 'room', '!room:server', false)
      expect(mockSetPushRuleEnabled).toHaveBeenCalledTimes(1)
      expect(mockSetPushRuleEnabled).toHaveBeenCalledWith('global', 'room', '!room:server', false)
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })

    it('should set push rule actions via PushManager.setPushRuleActions', async () => {
      await matrixPushService.setPushRuleActions('global', 'room', '!room:server', [PushRuleActionName.DontNotify])
      expect(mockSetPushRuleActions).toHaveBeenCalledTimes(1)
      expect(mockSetPushRuleActions).toHaveBeenCalledWith('global', 'room', '!room:server', [
        PushRuleActionName.DontNotify
      ])
      expect(mockAuthedRequest).not.toHaveBeenCalled()
    })
  })

  describe('fallback to HTTP when PushManager is unavailable', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue({
        http: { authedRequest: mockAuthedRequest },
        getPushRules: mockGetPushRules,
        getDeviceId: () => 'TEST_DEVICE_ID',
        getPushManager: () => undefined
      })
    })

    it('getPushers should fallback to HTTP when no PushManager', async () => {
      mockAuthedRequest.mockResolvedValueOnce({ pushers: [{ pushkey: 'pk2', app_id: 'app2' }] })
      const result = await matrixPushService.getPushers()
      expect(result).toHaveLength(1)
      expect(mockAuthedRequest).toHaveBeenCalledWith('GET', '/pushers')
    })

    it('setPushRuleEnabled should fallback to HTTP when no PushManager', async () => {
      mockAuthedRequest.mockResolvedValueOnce({})
      await matrixPushService.setPushRuleEnabled('global', 'room', '!room:server', false)
      expect(mockAuthedRequest).toHaveBeenCalledWith(
        'PUT',
        '/pushrules/global/room/!room%3Aserver/enabled',
        undefined,
        { enabled: false }
      )
    })

    it('setPushRuleActions should fallback to HTTP when no PushManager', async () => {
      mockAuthedRequest.mockResolvedValueOnce({})
      await matrixPushService.setPushRuleActions('global', 'room', '!room:server', [PushRuleActionName.DontNotify])
      expect(mockAuthedRequest).toHaveBeenCalledWith(
        'PUT',
        '/pushrules/global/room/!room%3Aserver/actions',
        undefined,
        { actions: [PushRuleActionName.DontNotify] }
      )
    })

    it('muteRoom should fallback to HTTP when no PushManager', async () => {
      mockAuthedRequest.mockResolvedValueOnce({})
      await matrixPushService.muteRoom('!room:server')
      expect(mockAuthedRequest).toHaveBeenCalledWith('PUT', '/pushrules/global/room/!room%3Aserver', undefined, {
        actions: ['dont_notify'],
        enabled: true
      })
    })

    it('unmuteRoom should fallback to HTTP when no PushManager', async () => {
      mockAuthedRequest.mockResolvedValueOnce({})
      await matrixPushService.unmuteRoom('!room:server')
      expect(mockAuthedRequest).toHaveBeenCalledWith('DELETE', '/pushrules/global/room/!room%3Aserver')
    })

    it('addPushRule should fallback to HTTP when no PushManager', async () => {
      mockAuthedRequest.mockResolvedValueOnce({})
      await matrixPushService.addPushRule('global', 'room', '!room:server', [PushRuleActionName.Notify])
      expect(mockAuthedRequest).toHaveBeenCalledWith('PUT', '/pushrules/global/room/!room%3Aserver', undefined, {
        actions: [PushRuleActionName.Notify]
      })
    })

    it('deletePushRule should fallback to HTTP when no PushManager', async () => {
      mockAuthedRequest.mockResolvedValueOnce({})
      await matrixPushService.deletePushRule('global', 'room', '!room:server')
      expect(mockAuthedRequest).toHaveBeenCalledWith('DELETE', '/pushrules/global/room/!room%3Aserver')
    })
  })
})
