import type { IPusher, MatrixClient, PushRuleAction } from 'matrix-js-sdk'
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

describe('MatrixPushService - Extended Features', () => {
  let mockClient: Partial<MatrixClient>
  let mockHttp: { authedRequest: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockHttp = {
      authedRequest: vi.fn()
    }

    mockClient = {
      http: mockHttp as unknown as MatrixClient['http'],
      getPushers: vi.fn(),
      setPusher: vi.fn(),
      getPushRules: vi.fn()
    }

    vi.mocked(matrixClientService.getClient).mockReset()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)
  })

  describe('registerPusher', () => {
    it('should register a pusher via HTTP', async () => {
      mockHttp.authedRequest.mockResolvedValue({})

      await matrixPushService.registerPusher({
        pushkey: 'pk123',
        kind: 'http',
        app_id: 'com.hula.app',
        app_display_name: 'HuLa',
        device_display_name: 'Desktop',
        lang: 'zh',
        data: { url: 'https://push.example.com' }
      } as IPusher)

      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'POST',
        '/_matrix/client/v3/pushers/set',
        undefined,
        expect.objectContaining({
          pushkey: 'pk123',
          kind: 'http',
          app_id: 'com.hula.app'
        })
      )
    })

    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixPushService.registerPusher({} as unknown as IPusher)).rejects.toThrow()
    })
  })

  describe('addPushRule', () => {
    it('should create a push rule via HTTP', async () => {
      mockHttp.authedRequest.mockResolvedValue({})

      await matrixPushService.addPushRule('global', 'room', 'room123', [
        'notify',
        { set_tweak: 'sound', value: 'default' }
      ] as PushRuleAction[])

      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'PUT',
        expect.stringContaining('/_matrix/client/v3/pushrules/global/room/room123'),
        undefined,
        expect.objectContaining({
          actions: ['notify', { set_tweak: 'sound', value: 'default' }]
        })
      )
    })

    it('should include conditions and pattern when provided', async () => {
      mockHttp.authedRequest.mockResolvedValue({})

      await matrixPushService.addPushRule(
        'global',
        'content',
        'rule1',
        ['notify'] as PushRuleAction[],
        [{ kind: 'event_match', key: 'content.body', pattern: 'hello' }],
        'hello'
      )

      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'PUT',
        expect.any(String),
        undefined,
        expect.objectContaining({
          actions: ['notify'],
          conditions: [{ kind: 'event_match', key: 'content.body', pattern: 'hello' }],
          pattern: 'hello'
        })
      )
    })
  })

  describe('deletePushRule', () => {
    it('should delete a push rule via HTTP', async () => {
      mockHttp.authedRequest.mockResolvedValue({})

      await matrixPushService.deletePushRule('global', 'room', 'room123')

      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'DELETE',
        expect.stringContaining('/_matrix/client/v3/pushrules/global/room/room123')
      )
    })
  })

  describe('isRoomMuted', () => {
    it('should return true when room has mute rule', async () => {
      vi.mocked(mockClient.getPushRules!).mockResolvedValue({
        global: {
          room: [{ rule_id: 'room123', default: false, enabled: true, actions: ['dont_notify'] }]
        }
      })

      const result = await matrixPushService.isRoomMuted('room123')

      expect(result).toBe(true)
    })

    it('should return false when no mute rule exists', async () => {
      vi.mocked(mockClient.getPushRules!).mockResolvedValue({
        global: { room: [] }
      })

      const result = await matrixPushService.isRoomMuted('room123')

      expect(result).toBe(false)
    })

    it('should return false on error', async () => {
      vi.mocked(mockClient.getPushRules!).mockRejectedValue(new Error('Network error'))

      const result = await matrixPushService.isRoomMuted('room123')

      expect(result).toBe(false)
    })
  })
})
