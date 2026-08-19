import type { IPusher } from 'matrix-js-sdk'
import { PushRuleActionName } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatrixRequestDeduper } from '../../MatrixRequestDeduper'
import { matrixPushService } from '../MatrixPushService'

describe('MatrixPushService', () => {
  let mockPushManager: {
    getPushers: ReturnType<typeof vi.fn>
    setPusher: ReturnType<typeof vi.fn>
    removePusher: ReturnType<typeof vi.fn>
    getPushRules: ReturnType<typeof vi.fn>
    setPushRuleEnabled: ReturnType<typeof vi.fn>
    setPushRuleActions: ReturnType<typeof vi.fn>
    createPushRule: ReturnType<typeof vi.fn>
    deletePushRule: ReturnType<typeof vi.fn>
    muteRoom: ReturnType<typeof vi.fn>
    unmuteRoom: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // FT-132: 清理 MatrixRequestDeduper 静态缓存，避免测试间状态泄漏
    MatrixRequestDeduper.clear()
    mockPushManager = {
      getPushers: vi.fn().mockResolvedValue([]),
      setPusher: vi.fn().mockResolvedValue(undefined),
      removePusher: vi.fn().mockResolvedValue(undefined),
      getPushRules: vi.fn().mockResolvedValue({
        global: { room: [{ rule_id: '!room:server', enabled: true }] }
      }),
      setPushRuleEnabled: vi.fn().mockResolvedValue(undefined),
      setPushRuleActions: vi.fn().mockResolvedValue(undefined),
      createPushRule: vi.fn().mockResolvedValue(undefined),
      deletePushRule: vi.fn().mockResolvedValue(undefined),
      muteRoom: vi.fn().mockResolvedValue(undefined),
      unmuteRoom: vi.fn().mockResolvedValue(undefined)
    }
    // 故意不提供 http.authedRequest —— 服务已改为直接调用 getPushManager()，不再依赖 HTTP 兜底
    // getPushRules 由 PushManager 提供（client.getPushManager().getPushRules()），不放在 client 上
    vi.spyOn(matrixPushService as any, 'getClient').mockReturnValue({
      getPushManager: () => mockPushManager,
      getDeviceId: () => 'TEST_DEVICE_ID'
    })
  })

  describe('getPushers', () => {
    it('should get pushers list', async () => {
      mockPushManager.getPushers.mockResolvedValue([{ pushkey: 'pk1', app_id: 'app' }])
      const result = await matrixPushService.getPushers()
      expect(result).toHaveLength(1)
      expect(mockPushManager.getPushers).toHaveBeenCalledTimes(1)
    })

    it('should return empty array when no pushers', async () => {
      const result = await matrixPushService.getPushers()
      expect(result).toEqual([])
    })

    // FT-132: 并发调用去重，两次 getPushers 只调用一次 getPushManager().getPushers
    it('并发调用去重：两次 getPushers 只调用一次 (FT-132)', async () => {
      mockPushManager.getPushers.mockResolvedValue([{ pushkey: 'pk1', app_id: 'app' }])
      const [r1, r2] = await Promise.all([matrixPushService.getPushers(), matrixPushService.getPushers()])
      expect(r1).toEqual(r2)
      expect(mockPushManager.getPushers).toHaveBeenCalledTimes(1)
    })

    it('should throw on error', async () => {
      mockPushManager.getPushers.mockRejectedValue(new Error('HTTP 500'))
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
    it('should unregister pusher via PushManager', async () => {
      await matrixPushService.unregisterPusher('pk1', 'app')
      expect(mockPushManager.removePusher).toHaveBeenCalledWith('pk1', 'app', 'TEST_DEVICE_ID')
    })
  })

  describe('registerPusher', () => {
    it('should register pusher with device_id and profile_tag', async () => {
      await matrixPushService.registerPusher({
        pushkey: 'pk1',
        kind: 'http',
        app_id: 'app',
        app_display_name: 'App',
        device_display_name: 'Dev',
        lang: 'en',
        data: { url: 'https://push.example.com' },
        profile_tag: 'web'
      } as IPusher)
      expect(mockPushManager.setPusher).toHaveBeenCalledWith({
        pushkey: 'pk1',
        kind: 'http',
        app_id: 'app',
        app_display_name: 'App',
        device_display_name: 'Dev',
        lang: 'en',
        data: { url: 'https://push.example.com' },
        device_id: 'TEST_DEVICE_ID',
        profile_tag: 'web'
      })
    })
  })

  describe('muteRoom / unmuteRoom', () => {
    it('should mute room', async () => {
      await matrixPushService.muteRoom('!room:server')
      expect(mockPushManager.muteRoom).toHaveBeenCalledWith('!room:server')
    })

    it('should unmute room', async () => {
      await matrixPushService.unmuteRoom('!room:server')
      expect(mockPushManager.unmuteRoom).toHaveBeenCalledWith('!room:server')
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

    // FT-124: getPushRules 失败时应抛出错误，不能静默返回 false（掩盖鉴权失败/网络错误）
    it('getPushRules 失败时抛出错误而非静默返回 false (FT-124)', async () => {
      mockPushManager.getPushRules.mockRejectedValue(new Error('HTTP 401'))

      await expect(matrixPushService.isRoomMuted('!room:server')).rejects.toThrow('HTTP 401')
    })
  })

  describe('addPushRule / deletePushRule', () => {
    it('should add push rule', async () => {
      await matrixPushService.addPushRule('global', 'room', '!room:server', [PushRuleActionName.Notify])
      expect(mockPushManager.createPushRule).toHaveBeenCalledWith('global', 'room', '!room:server', {
        actions: [PushRuleActionName.Notify]
      })
    })

    it('should delete push rule', async () => {
      await matrixPushService.deletePushRule('global', 'room', '!room:server')
      expect(mockPushManager.deletePushRule).toHaveBeenCalledWith('global', 'room', '!room:server')
    })
  })

  describe('setPushRuleEnabled / setPushRuleActions', () => {
    it('should set push rule enabled', async () => {
      await matrixPushService.setPushRuleEnabled('global', 'room', '!room:server', false)
      expect(mockPushManager.setPushRuleEnabled).toHaveBeenCalledWith('global', 'room', '!room:server', false)
    })

    it('should set push rule actions', async () => {
      await matrixPushService.setPushRuleActions('global', 'room', '!room:server', [PushRuleActionName.DontNotify])
      expect(mockPushManager.setPushRuleActions).toHaveBeenCalledWith('global', 'room', '!room:server', [
        PushRuleActionName.DontNotify
      ])
    })
  })
})
