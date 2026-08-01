import type { IPusherRequest, MatrixClient } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixNotificationService } from '../MatrixNotificationService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null as MatrixClient | null)
  }
}))

const mockPushManager = {
  getNotifications: vi.fn(),
  ackNotification: vi.fn(),
  getPushRules: vi.fn(),
  updatePushRule: vi.fn(),
  deletePushRule: vi.fn(),
  getPushers: vi.fn(),
  setPusher: vi.fn()
}

const mockClient = {
  getPushManager: vi.fn(() => mockPushManager),
  getPushRules: vi.fn(),
  setPushRule: vi.fn(),
  deletePushRule: vi.fn(),
  setPusher: vi.fn(),
  http: {
    authedRequest: vi.fn()
  }
}

describe('MatrixNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matrixNotificationService.clearAckCache()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initialize', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      await expect(matrixNotificationService.initialize()).rejects.toThrow('客户端未初始化')
    })

    it('should load push rules on initialization', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getPushRules: vi.fn().mockResolvedValue({
          global: { rule_id: 'global-rule' }
        })
      } as unknown as MatrixClient)

      await matrixNotificationService.initialize()
      expect(true).toBe(true)
    })
  })

  describe('setPushRule', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      const rule = {
        ruleId: 'test-rule',
        kind: 'override' as const,
        roomId: '!room:id',
        conditions: {},
        actions: ['notify'],
        enabled: true
      }

      await expect(matrixNotificationService.setPushRule(rule)).rejects.toThrow('客户端未初始化')
    })
  })

  describe('deletePushRule', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixNotificationService.deletePushRule('test-rule')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('setPusher', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixNotificationService.setPusher({ pushkey: 'test-push-key' } as IPusherRequest)).rejects.toThrow(
        '客户端未初始化'
      )
    })
  })

  describe('getPushRules', () => {
    it('should return rules from service', () => {
      const rules = matrixNotificationService.getPushRules()
      expect(Array.isArray(rules)).toBe(true)
    })

    it('should clear cached push rules when matrix client changes', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getPushRules: vi.fn().mockResolvedValue({
          global: {
            override: [{ rule_id: 'old-rule' }]
          }
        })
      } as unknown as MatrixClient)

      await matrixNotificationService.initialize()
      expect(matrixNotificationService.getPushRules()).toHaveLength(1)

      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getPushRules: vi.fn().mockResolvedValue({
          global: {
            override: [{ rule_id: 'new-rule' }]
          }
        })
      } as unknown as MatrixClient)

      expect(matrixNotificationService.getPushRules()).toEqual([])
    })
  })

  describe('getPushRule', () => {
    it('should return undefined for non-existent rule', () => {
      const rule = matrixNotificationService.getPushRule('non-existent')
      expect(rule).toBeUndefined()
    })

    it('should load push rules from new client after re-initialize', async () => {
      const oldClient = {
        getPushRules: vi.fn().mockResolvedValue({
          global: {
            override: [{ rule_id: 'old-rule' }]
          }
        })
      }
      const newClient = {
        getPushRules: vi.fn().mockResolvedValue({
          global: {
            override: [{ rule_id: 'new-rule' }]
          }
        })
      }

      vi.mocked(matrixClientService.getClient).mockReturnValue(oldClient as unknown as MatrixClient)
      await matrixNotificationService.initialize()
      expect(matrixNotificationService.getPushRule('old-rule')?.rule_id).toBe('old-rule')

      vi.mocked(matrixClientService.getClient).mockReturnValue(newClient as unknown as MatrixClient)
      await matrixNotificationService.initialize()
      expect(matrixNotificationService.getPushRule('new-rule')?.rule_id).toBe('new-rule')
      expect(matrixNotificationService.getPushRule('old-rule')).toBeUndefined()
    })
  })

  describe('updateConfig', () => {
    it('should update notification config', () => {
      matrixNotificationService.updateConfig({
        enableDesktop: false,
        enableSound: false
      })

      const config = matrixNotificationService.getConfig()
      expect(config.enableDesktop).toBe(false)
      expect(config.enableSound).toBe(false)
    })
  })

  describe('getConfig', () => {
    it('should return current config', () => {
      const config = matrixNotificationService.getConfig()

      expect(config).toHaveProperty('enableDesktop')
      expect(config).toHaveProperty('enableSound')
      expect(config).toHaveProperty('enableVibrate')
      expect(config).toHaveProperty('showPreview')
      expect(config).toHaveProperty('showSender')
      expect(config).toHaveProperty('showMessageContent')
    })
  })

  describe('requestNotificationPermission', () => {
    it('should return false when Notification API is not available', async () => {
      const originalNotification = window.Notification
      Object.defineProperty(window, 'Notification', {
        value: undefined,
        writable: true
      })

      const result = await matrixNotificationService.requestNotificationPermission()
      expect(result).toBe(false)

      Object.defineProperty(window, 'Notification', {
        value: originalNotification,
        writable: true
      })
    })
  })

  describe('showNotification', () => {
    it('should not show notification when desktop notifications are disabled', async () => {
      matrixNotificationService.updateConfig({ enableDesktop: false })
      await matrixNotificationService.showNotification('Test', 'Body')
    })
  })

  describe('playSound', () => {
    it('should not play sound when sound is disabled', async () => {
      matrixNotificationService.updateConfig({ enableSound: false })
      await matrixNotificationService.playSound('/notification.mp3')
    })
  })

  describe('vibrate', () => {
    it('should not vibrate when vibration is disabled', async () => {
      matrixNotificationService.updateConfig({ enableVibrate: false })
      await matrixNotificationService.vibrate()
    })
  })

  describe('successful operations', () => {
    beforeEach(() => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)
    })

    it('should set push rule successfully', async () => {
      mockClient.setPushRule.mockResolvedValueOnce(undefined)

      const rule = {
        ruleId: 'test-rule',
        kind: 'override' as const,
        roomId: '!room:id',
        conditions: {},
        actions: ['notify'],
        enabled: true
      }

      await matrixNotificationService.setPushRule(rule)
      expect(mockClient.setPushRule).toHaveBeenCalledWith('global', 'override', 'test-rule', ['notify'])
    })

    it('should delete push rule successfully', async () => {
      mockClient.deletePushRule.mockResolvedValueOnce(undefined)

      await matrixNotificationService.deletePushRule('test-rule')
      expect(mockClient.deletePushRule).toHaveBeenCalledWith('global', 'override', 'test-rule')
    })

    it('should set pusher successfully', async () => {
      mockClient.setPusher.mockResolvedValueOnce(undefined)

      const pusher = {
        app_id: 'hula',
        pushkey: 'device-token',
        kind: 'http'
      } as IPusherRequest

      await matrixNotificationService.setPusher(pusher)
      expect(mockClient.setPusher).toHaveBeenCalledWith(pusher)
    })
  })

  describe('SDK PushManager migrated methods', () => {
    beforeEach(() => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)
    })

    describe('getNotifications', () => {
      it('should fetch notifications via PushManager', async () => {
        mockPushManager.getNotifications.mockResolvedValueOnce({
          notifications: [{ event_id: 'evt1', room_id: '!r1' }],
          next_token: 'tok2'
        })

        const result = await matrixNotificationService.getNotifications('tok1', 10)

        expect(mockClient.getPushManager).toHaveBeenCalled()
        expect(mockPushManager.getNotifications).toHaveBeenCalledWith({ from: 'tok1', limit: 10 })
        expect(result.notifications).toHaveLength(1)
        expect(result.next_token).toBe('tok2')
      })

      it('should return empty array on error', async () => {
        mockPushManager.getNotifications.mockRejectedValueOnce(new Error('network error'))

        const result = await matrixNotificationService.getNotifications()

        expect(result.notifications).toEqual([])
        expect(result.next_token).toBeUndefined()
      })
    })

    describe('ackNotification', () => {
      it('should ack notification via PushManager', async () => {
        mockPushManager.ackNotification.mockResolvedValueOnce(undefined)

        const result = await matrixNotificationService.ackNotification('notif-123')

        expect(mockClient.getPushManager).toHaveBeenCalled()
        expect(mockPushManager.ackNotification).toHaveBeenCalledWith('notif-123')
        expect(result).toBe(true)
      })

      it('should return false on error', async () => {
        mockPushManager.ackNotification.mockRejectedValueOnce(new Error('not found'))

        const result = await matrixNotificationService.ackNotification('notif-123')

        expect(result).toBe(false)
      })
    })

    describe('fetchPushRules', () => {
      it('should fetch push rules via PushManager', async () => {
        const rules = { global: { override: [{ rule_id: 'r1' }] } }
        mockPushManager.getPushRules.mockResolvedValueOnce(rules)

        const result = await matrixNotificationService.fetchPushRules()

        expect(mockClient.getPushManager).toHaveBeenCalled()
        expect(mockPushManager.getPushRules).toHaveBeenCalled()
        expect(result).toEqual(rules)
      })
    })

    describe('setPushRuleByScope', () => {
      it('should update push rule via PushManager', async () => {
        mockPushManager.updatePushRule.mockResolvedValueOnce(undefined)

        const body = { actions: ['notify'] }
        await matrixNotificationService.setPushRuleByScope('global', 'override', 'rule1', body)

        expect(mockClient.getPushManager).toHaveBeenCalled()
        expect(mockPushManager.updatePushRule).toHaveBeenCalledWith('global', 'override', 'rule1', body)
      })
    })

    describe('deletePushRuleByScope', () => {
      it('should delete push rule via PushManager', async () => {
        mockPushManager.deletePushRule.mockResolvedValueOnce(undefined)

        await matrixNotificationService.deletePushRuleByScope('global', 'override', 'rule1')

        expect(mockClient.getPushManager).toHaveBeenCalled()
        expect(mockPushManager.deletePushRule).toHaveBeenCalledWith('global', 'override', 'rule1')
      })
    })

    describe('fetchPushers', () => {
      it('should fetch pushers via PushManager', async () => {
        const pushers = [{ pushkey: 'pk1', app_id: 'app1' }]
        mockPushManager.getPushers.mockResolvedValueOnce(pushers)

        const result = await matrixNotificationService.fetchPushers()

        expect(mockClient.getPushManager).toHaveBeenCalled()
        expect(mockPushManager.getPushers).toHaveBeenCalled()
        expect(result).toEqual(pushers)
      })
    })

    describe('setPusherByBody', () => {
      it('should set pusher via PushManager', async () => {
        mockPushManager.setPusher.mockResolvedValueOnce(undefined)

        const pusher = { pushkey: 'pk1', app_id: 'app1' }
        await matrixNotificationService.setPusherByBody(pusher)

        expect(mockClient.getPushManager).toHaveBeenCalled()
        expect(mockPushManager.setPusher).toHaveBeenCalledWith(pusher)
      })
    })

    describe('ackNotificationWithFallback', () => {
      it('should use ack when endpoint is available', async () => {
        mockPushManager.ackNotification.mockResolvedValueOnce(undefined)

        const result = await matrixNotificationService.ackNotificationWithFallback('n1', '!room', 'evt1')

        expect(result.success).toBe(true)
        expect(result.method).toBe('ack')
      })

      it('should fallback to receipt when ack fails', async () => {
        mockPushManager.ackNotification.mockRejectedValueOnce(new Error('404'))
        mockClient.http.authedRequest.mockResolvedValueOnce({})

        const result = await matrixNotificationService.ackNotificationWithFallback('n1', '!room', 'evt1')

        expect(result.success).toBe(true)
        expect(result.method).toBe('receipt')
      })
    })
  })
})
