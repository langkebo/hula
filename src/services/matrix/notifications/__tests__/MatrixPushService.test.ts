import type { IPusher, MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixPushService } from '../MatrixPushService'

vi.mock('../../MatrixClientService', () => {
  const getClient = vi.fn(() => null as MatrixClient | null)
  return {
    default: { getClient },
    matrixClientService: { getClient }
  }
})

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixPushService', () => {
  let mockHttp: { authedRequest: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockHttp = { authedRequest: vi.fn().mockResolvedValue({}) }
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      http: mockHttp as unknown as MatrixClient['http'],
      getPushRules: vi.fn().mockResolvedValue({
        global: { room: [{ rule_id: '!room:server', enabled: true }] }
      })
    } as unknown as MatrixClient)
  })

  describe('getPushers', () => {
    it('should get pushers list', async () => {
      mockHttp.authedRequest.mockResolvedValue({ pushers: [{ pushkey: 'pk1', app_id: 'app' }] })
      const result = await matrixPushService.getPushers()
      expect(result).toHaveLength(1)
    })

    it('should return empty array when no pushers', async () => {
      mockHttp.authedRequest.mockResolvedValue({})
      const result = await matrixPushService.getPushers()
      expect(result).toEqual([])
    })

    it('should throw on error', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('fail'))
      await expect(matrixPushService.getPushers()).rejects.toThrow('fail')
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
      expect(mockHttp.authedRequest).toHaveBeenCalled()
      const call = mockHttp.authedRequest.mock.calls[0]
      expect(call[0]).toBe('POST')
      expect(call[1]).toBe('/_matrix/client/v3/pushers/set')
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
      expect(mockHttp.authedRequest).toHaveBeenCalled()
      const call = mockHttp.authedRequest.mock.calls[0]
      expect(call[0]).toBe('POST')
      expect(call[1]).toBe('/_matrix/client/v3/pushers/set')
    })
  })

  describe('muteRoom / unmuteRoom', () => {
    it('should mute room', async () => {
      await matrixPushService.muteRoom('!room:server')
      expect(mockHttp.authedRequest).toHaveBeenCalled()
      const call = mockHttp.authedRequest.mock.calls[0]
      expect(call[0]).toBe('PUT')
      expect(call[1]).toContain('pushrules/global/room/')
    })

    it('should unmute room', async () => {
      await matrixPushService.unmuteRoom('!room:server')
      expect(mockHttp.authedRequest).toHaveBeenCalled()
      const call = mockHttp.authedRequest.mock.calls[0]
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
      await matrixPushService.addPushRule('global', 'room', '!room:server', ['notify'])
      expect(mockHttp.authedRequest).toHaveBeenCalled()
      const call = mockHttp.authedRequest.mock.calls[0]
      expect(call[0]).toBe('PUT')
      expect(call[1]).toContain('pushrules/global/room/')
    })

    it('should delete push rule', async () => {
      await matrixPushService.deletePushRule('global', 'room', '!room:server')
      expect(mockHttp.authedRequest).toHaveBeenCalled()
      const call = mockHttp.authedRequest.mock.calls[0]
      expect(call[0]).toBe('DELETE')
      expect(call[1]).toContain('pushrules/global/room/')
    })
  })

  describe('setPushRuleEnabled / setPushRuleActions', () => {
    it('should set push rule enabled', async () => {
      await matrixPushService.setPushRuleEnabled('global', 'room', '!room:server', false)
      expect(mockHttp.authedRequest).toHaveBeenCalled()
      const call = mockHttp.authedRequest.mock.calls[0]
      expect(call[0]).toBe('PUT')
      expect(call[1]).toContain('/enabled')
    })

    it('should set push rule actions', async () => {
      await matrixPushService.setPushRuleActions('global', 'room', '!room:server', ['dont_notify'])
      expect(mockHttp.authedRequest).toHaveBeenCalled()
      const call = mockHttp.authedRequest.mock.calls[0]
      expect(call[0]).toBe('PUT')
      expect(call[1]).toContain('/actions')
    })
  })
})
