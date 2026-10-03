import type { MatrixClient, PresenceManager } from 'matrix-js-sdk'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { getLastSentPresence, recordSentPresence, resetSentPresence } from '@/utils/userStatus'
import matrixClientService from '../../MatrixClientService'
import { matrixPresenceService } from '../MatrixPresenceService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixPresenceService', () => {
  let mockClient: Partial<MatrixClient>
  let mockPresenceManager: {
    setPresence: ReturnType<typeof vi.fn>
    getPresence: ReturnType<typeof vi.fn>
    subscribeToPresence: ReturnType<typeof vi.fn>
    unsubscribeFromPresence: ReturnType<typeof vi.fn>
    getPresenceList: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    // setPresence 内部读取「显示在线状态」偏好，需要激活 Pinia
    setActivePinia(createPinia())
    vi.clearAllMocks()
    resetSentPresence()

    mockPresenceManager = {
      setPresence: vi.fn(),
      getPresence: vi.fn(),
      subscribeToPresence: vi.fn(),
      unsubscribeFromPresence: vi.fn(),
      getPresenceList: vi.fn()
    }

    mockClient = {
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

    it('should throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      vi.mocked(matrixClientService.waitForClientReady).mockRejectedValue(
        new Error('Matrix client initialization timeout')
      )

      await expect(matrixPresenceService.setPresence('online')).rejects.toThrow()
    })
  })

  // 门控唯一实现点：任何调用方传「意图」，由服务决定实际上报值并记账。
  describe('setPresence 门控（唯一写入点）', () => {
    beforeEach(() => {
      mockPresenceManager.setPresence.mockResolvedValue(undefined)
    })

    it('开关关闭时把 online 降级为 offline 上报，并返回生效值', async () => {
      useSettingStore().setShowOnlineStatusEnabled(false)

      const effective = await matrixPresenceService.setPresence('online')

      expect(mockPresenceManager.setPresence).toHaveBeenCalledWith('offline', undefined)
      expect(mockPresenceManager.setPresence).not.toHaveBeenCalledWith('online', undefined)
      expect(effective).toBe('offline')
      expect(getLastSentPresence()).toBe('offline')
    })

    it('开关开启时 online 原样上报，并返回 online', async () => {
      useSettingStore().setShowOnlineStatusEnabled(true)

      const effective = await matrixPresenceService.setPresence('online')

      expect(mockPresenceManager.setPresence).toHaveBeenCalledWith('online', undefined)
      expect(effective).toBe('online')
      expect(getLastSentPresence()).toBe('online')
    })

    it('开关关闭时 unavailable 原样上报（用户显式选择不受门控影响）', async () => {
      useSettingStore().setShowOnlineStatusEnabled(false)

      const effective = await matrixPresenceService.setPresence('unavailable')

      expect(mockPresenceManager.setPresence).toHaveBeenCalledWith('unavailable', undefined)
      expect(effective).toBe('unavailable')
      expect(getLastSentPresence()).toBe('unavailable')
    })

    it('开关关闭时 offline 原样上报（登出/teardown 语义不变）', async () => {
      useSettingStore().setShowOnlineStatusEnabled(false)

      const effective = await matrixPresenceService.setPresence('offline')

      expect(mockPresenceManager.setPresence).toHaveBeenCalledWith('offline', undefined)
      expect(effective).toBe('offline')
    })

    it('状态消息与生效值一起写入', async () => {
      useSettingStore().setShowOnlineStatusEnabled(false)

      await matrixPresenceService.setPresence('online', '工作中')

      expect(mockPresenceManager.setPresence).toHaveBeenCalledWith('offline', '工作中')
    })

    it('上报失败时不推进记账，避免心跳误判已降级', async () => {
      useSettingStore().setShowOnlineStatusEnabled(true)
      recordSentPresence('online')
      mockPresenceManager.setPresence.mockRejectedValue(new Error('boom'))

      await expect(matrixPresenceService.setPresence('offline')).rejects.toThrow('boom')

      expect(getLastSentPresence()).toBe('online')
    })
  })

  // status_msg 语义：省略 = 不动服务端状态文本（SDK 收到 undefined 时会省略该字段），
  // 传空串反而会清空它。这里钉住「只在调用方显式提供时才写入」。
  describe('setPresence status_msg 语义', () => {
    beforeEach(() => {
      mockPresenceManager.setPresence.mockResolvedValue(undefined)
      useSettingStore().setShowOnlineStatusEnabled(true)
    })

    it('未传状态消息时以 undefined 透传，不清空服务端状态文本', async () => {
      await matrixPresenceService.setPresence('online')

      expect(mockPresenceManager.setPresence).toHaveBeenCalledTimes(1)
      const [state, statusMsg] = mockPresenceManager.setPresence.mock.calls[0]
      expect(state).toBe('online')
      expect(statusMsg).toBeUndefined()
    })

    it('传入状态消息时更新服务端状态文本', async () => {
      await matrixPresenceService.setPresence('online', '远程办公')

      expect(mockPresenceManager.setPresence).toHaveBeenCalledWith('online', '远程办公')
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
    it('should subscribe using presenceManager', async () => {
      const mockResponse = { presences: [] }
      mockPresenceManager.subscribeToPresence.mockResolvedValue(mockResponse)

      const result = await matrixPresenceService.subscribeToPresence(['@a:example.com', '@b:example.com'])

      expect(mockPresenceManager.subscribeToPresence).toHaveBeenCalledWith(['@a:example.com', '@b:example.com'])
      expect(result).toEqual(mockResponse)
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
