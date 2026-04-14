/**
 * MatrixPushService 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixPushService } from '../MatrixPushService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixPushService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialize', () => {
    it('should initialize with client', () => {
      const mockManager = {}
      const mockClient = {
        getPushManager: vi.fn().mockReturnValue(mockManager)
      }

      matrixPushService.initialize(mockClient as any)

      expect(mockClient.getPushManager).toHaveBeenCalled()
    })
  })

  describe('getPushRules', () => {
    it('should get push rules preserving IPushRules structure', async () => {
      const mockRules = {
        global: {
          override: [{ rule_id: 'override1', default: false, enabled: true, actions: ['notify'] }],
          content: [{ rule_id: 'content1', default: false, enabled: false, pattern: 'test', actions: ['dont_notify'] }],
          room: [],
          sender: [],
          underride: [
            {
              rule_id: 'underride1',
              default: true,
              enabled: true,
              conditions: [{ kind: 'room_member_count', is: '2' }],
              actions: ['notify']
            }
          ]
        }
      }
      const mockManager = {
        getPushRules: vi.fn().mockResolvedValue(mockRules)
      }
      const mockClient = {
        getPushManager: vi.fn().mockReturnValue(mockManager)
      }

      matrixPushService.initialize(mockClient as any)
      const result = await matrixPushService.getPushRules()

      expect(result.global).toBeDefined()
      expect(result.global.override).toHaveLength(1)
      expect(result.global.override![0].rule_id).toBe('override1')
      expect(result.global.content).toHaveLength(1)
      expect(result.global.content![0].pattern).toBe('test')
      expect(result.global.underride).toHaveLength(1)
      expect(result.global.underride![0].default).toBe(true)
    })
  })

  describe('getRulesByKind', () => {
    it('should get rules by kind from SDK', async () => {
      const mockRules = [{ rule_id: 'override1', default: false, enabled: true, actions: ['notify'] }]
      const mockManager = {
        getPushRulesByKind: vi.fn().mockResolvedValue(mockRules)
      }
      const mockClient = {
        getPushManager: vi.fn().mockReturnValue(mockManager)
      }

      matrixPushService.initialize(mockClient as any)
      const result = await matrixPushService.getRulesByKind('override')

      expect(mockManager.getPushRulesByKind).toHaveBeenCalledWith('global', 'override')
      expect(result).toHaveLength(1)
      expect(result[0].rule_id).toBe('override1')
    })
  })

  describe('getPushers', () => {
    it('should get pushers in SDK IPusher format', async () => {
      const mockPushers = [
        {
          pushkey: 'key1',
          kind: 'http',
          app_id: 'app1',
          app_display_name: 'App1',
          device_display_name: 'Dev1',
          enabled: true
        }
      ]
      const mockManager = {
        getPushers: vi.fn().mockResolvedValue(mockPushers)
      }
      const mockClient = {
        getPushManager: vi.fn().mockReturnValue(mockManager)
      }

      matrixPushService.initialize(mockClient as any)
      const result = await matrixPushService.getPushers()

      expect(result).toHaveLength(1)
      expect(result[0].pushkey).toBe('key1')
      expect(result[0].kind).toBe('http')
      expect(result[0].app_id).toBe('app1')
      expect(result[0].app_display_name).toBe('App1')
      expect(result[0].device_display_name).toBe('Dev1')
    })
  })

  describe('addPusher', () => {
    it('should add pusher via setPusher', async () => {
      const mockManager = {
        setPusher: vi.fn().mockResolvedValue(undefined)
      }
      const mockClient = {
        getPushManager: vi.fn().mockReturnValue(mockManager)
      }

      matrixPushService.initialize(mockClient as any)

      await expect(
        matrixPushService.addPusher({
          appId: 'test_app',
          appDisplayName: 'Test App',
          deviceDisplayName: 'Test Device',
          pushkey: 'test_key',
          data: { url: 'https://example.com/push' }
        })
      ).resolves.not.toThrow()

      expect(mockManager.setPusher).toHaveBeenCalledWith(
        expect.objectContaining({
          app_id: 'test_app',
          app_display_name: 'Test App',
          device_display_name: 'Test Device',
          pushkey: 'test_key',
          append: true
        })
      )
    })
  })

  describe('muteRoom', () => {
    it('should mute room successfully', async () => {
      const mockManager = {
        muteRoom: vi.fn().mockResolvedValue(undefined)
      }
      const mockClient = {
        getPushManager: vi.fn().mockReturnValue(mockManager)
      }

      matrixPushService.initialize(mockClient as any)
      await expect(matrixPushService.muteRoom('!room:example.com')).resolves.not.toThrow()
    })
  })

  describe('isRoomMuted', () => {
    it('should check if room is muted', async () => {
      const mockManager = {
        isRoomMuted: vi.fn().mockResolvedValue(true)
      }
      const mockClient = {
        getPushManager: vi.fn().mockReturnValue(mockManager)
      }

      matrixPushService.initialize(mockClient as any)
      const result = await matrixPushService.isRoomMuted('!room:example.com')

      expect(result).toBe(true)
    })
  })
})
