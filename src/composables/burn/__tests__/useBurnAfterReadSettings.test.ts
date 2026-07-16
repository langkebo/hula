import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetBurnSettings,
  mockGetPendingBurns,
  mockGetBurnStats,
  mockEnableBurn,
  mockDisableBurn,
  mockSetBurnConfig,
  mockCancelBurn,
  mockShowFeedback,
  mockLoggerError,
  mockLoggerInfo
} = vi.hoisted(() => ({
  mockGetBurnSettings: vi.fn(),
  mockGetPendingBurns: vi.fn(),
  mockGetBurnStats: vi.fn(),
  mockEnableBurn: vi.fn(),
  mockDisableBurn: vi.fn(),
  mockSetBurnConfig: vi.fn(),
  mockCancelBurn: vi.fn(),
  mockShowFeedback: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn()
}))

vi.mock('@/services/matrix/messaging/MatrixBurnAfterReadService', () => ({
  matrixBurnAfterReadService: {
    getBurnSettings: mockGetBurnSettings,
    getPendingBurns: mockGetPendingBurns,
    getBurnStats: mockGetBurnStats,
    enableBurn: mockEnableBurn,
    disableBurn: mockDisableBurn,
    setBurnConfig: mockSetBurnConfig,
    cancelBurn: mockCancelBurn
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: mockShowFeedback
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: mockLoggerError,
    info: mockLoggerInfo,
    warn: vi.fn()
  })
}))

import { useBurnAfterReadSettings } from '../useBurnAfterReadSettings'

describe('useBurnAfterReadSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetBurnSettings.mockResolvedValue({ enabled: false, burnAfterMs: 0 })
    mockGetPendingBurns.mockResolvedValue([])
    mockGetBurnStats.mockResolvedValue({ totalBurned: 0, totalPending: 0, roomsWithBurnEnabled: 0 })
    mockEnableBurn.mockResolvedValue({ enabled: true, burnAfterMs: 60000 })
    mockDisableBurn.mockResolvedValue({ enabled: false, burnAfterMs: 0 })
    mockSetBurnConfig.mockResolvedValue(60000)
    mockCancelBurn.mockResolvedValue(true)
  })

  describe('初始状态', () => {
    it('未提供 roomId 时 hasRoom 为 false', () => {
      const flow = useBurnAfterReadSettings()
      expect(flow.hasRoom.value).toBe(false)
    })

    it('提供 roomId 时 hasRoom 为 true', () => {
      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      expect(flow.hasRoom.value).toBe(true)
    })

    it('isRoomBurnEnabled 初始为 false', () => {
      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      expect(flow.isRoomBurnEnabled.value).toBe(false)
    })

    it('roomBurnAfterMs 初始为 0', () => {
      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      expect(flow.roomBurnAfterMs.value).toBe(0)
    })
  })

  describe('loadRoomSettings', () => {
    it('加载成功时填充 roomSettings 与 pendingBurns', async () => {
      mockGetBurnSettings.mockResolvedValueOnce({ enabled: true, burnAfterMs: 30000 })
      mockGetPendingBurns.mockResolvedValueOnce([
        { eventId: '$e1:server', createdAt: 1, deleteAt: 2 },
        { eventId: '$e2:server', createdAt: 3, deleteAt: 4 }
      ])

      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      await flow.loadRoomSettings()

      expect(mockGetBurnSettings).toHaveBeenCalledWith('!room:server')
      expect(mockGetPendingBurns).toHaveBeenCalledWith('!room:server')
      expect(flow.roomSettings.value).toEqual({ enabled: true, burnAfterMs: 30000 })
      expect(flow.pendingBurns.value).toHaveLength(2)
      expect(flow.loading.value).toBe(false)
      expect(flow.errorMessage.value).toBeNull()
    })

    it('未提供 roomId 时跳过加载并 warn', async () => {
      const flow = useBurnAfterReadSettings()
      await flow.loadRoomSettings()
      expect(mockGetBurnSettings).not.toHaveBeenCalled()
    })

    it('加载失败时设置 errorMessage 并显示错误反馈', async () => {
      mockGetBurnSettings.mockRejectedValueOnce(new Error('network'))

      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      await flow.loadRoomSettings()

      expect(flow.loading.value).toBe(false)
      expect(flow.errorMessage.value).toBe('mobile_burn.entry.apply_failed')
      expect(mockShowFeedback).toHaveBeenCalledWith('mobile_burn.entry.apply_failed', 'error')
      expect(mockLoggerError).toHaveBeenCalled()
    })
  })

  describe('loadStats', () => {
    it('加载成功时填充 burnStats', async () => {
      mockGetBurnStats.mockResolvedValueOnce({
        totalBurned: 100,
        totalPending: 5,
        roomsWithBurnEnabled: 3
      })

      const flow = useBurnAfterReadSettings()
      await flow.loadStats()

      expect(flow.burnStats.value).toEqual({
        totalBurned: 100,
        totalPending: 5,
        roomsWithBurnEnabled: 3
      })
    })

    it('加载失败时记录错误但不显示反馈(静默失败)', async () => {
      mockGetBurnStats.mockRejectedValueOnce(new Error('network'))
      const flow = useBurnAfterReadSettings()
      await flow.loadStats()
      expect(mockLoggerError).toHaveBeenCalled()
      expect(mockShowFeedback).not.toHaveBeenCalled()
    })
  })

  describe('load', () => {
    it('同时加载房间设置与统计', async () => {
      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      await flow.load()
      expect(mockGetBurnSettings).toHaveBeenCalledTimes(1)
      expect(mockGetBurnStats).toHaveBeenCalledTimes(1)
    })
  })

  describe('enableRoomBurn', () => {
    it('未提供 roomId 时返回 false 并显示错误', async () => {
      const flow = useBurnAfterReadSettings()
      const result = await flow.enableRoomBurn(60000)
      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('mobile_burn.entry.apply_failed', 'error')
    })

    it('启用成功时更新 roomSettings 并显示成功反馈', async () => {
      mockEnableBurn.mockResolvedValueOnce({ enabled: true, burnAfterMs: 60000 })

      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      const result = await flow.enableRoomBurn(60000)

      expect(result).toBe(true)
      expect(mockEnableBurn).toHaveBeenCalledWith('!room:server', 60000)
      expect(flow.roomSettings.value).toEqual({ enabled: true, burnAfterMs: 60000 })
      expect(flow.updating.value).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('mobile_burn.room_enabled', 'success')
    })

    it('服务返回 null 时显示错误反馈', async () => {
      mockEnableBurn.mockResolvedValueOnce(null)

      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      const result = await flow.enableRoomBurn()

      expect(result).toBe(false)
      expect(flow.errorMessage.value).toBe('mobile_burn.entry.apply_failed')
      expect(mockShowFeedback).toHaveBeenCalledWith('mobile_burn.entry.apply_failed', 'error')
    })

    it('服务抛错时显示错误反馈', async () => {
      mockEnableBurn.mockRejectedValueOnce(new Error('forbidden'))

      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      const result = await flow.enableRoomBurn()

      expect(result).toBe(false)
      expect(flow.updating.value).toBe(false)
      expect(mockLoggerError).toHaveBeenCalled()
    })

    it('updating 在操作期间为 true,结束后恢复', async () => {
      let resolveEnable: (value: { enabled: boolean; burnAfterMs: number }) => void = () => {}
      mockEnableBurn.mockImplementationOnce(
        () =>
          new Promise<{ enabled: boolean; burnAfterMs: number }>((resolve) => {
            resolveEnable = resolve
          })
      )

      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      const promise = flow.enableRoomBurn(60000)
      expect(flow.updating.value).toBe(true)

      resolveEnable({ enabled: true, burnAfterMs: 60000 })
      await promise
      expect(flow.updating.value).toBe(false)
    })
  })

  describe('disableRoomBurn', () => {
    it('禁用成功时更新 roomSettings、清空 pendingBurns 并显示成功反馈', async () => {
      mockDisableBurn.mockResolvedValueOnce({ enabled: false, burnAfterMs: 0 })

      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      // 预填充 pendingBurns
      flow.pendingBurns.value = [{ eventId: '$e1:server', createdAt: 1, deleteAt: 2 }]
      const result = await flow.disableRoomBurn()

      expect(result).toBe(true)
      expect(flow.roomSettings.value).toEqual({ enabled: false, burnAfterMs: 0 })
      expect(flow.pendingBurns.value).toEqual([])
      expect(mockShowFeedback).toHaveBeenCalledWith('mobile_burn.room_disabled', 'success')
    })

    it('未提供 roomId 时返回 false', async () => {
      const flow = useBurnAfterReadSettings()
      const result = await flow.disableRoomBurn()
      expect(result).toBe(false)
    })
  })

  describe('toggleRoomBurn', () => {
    it('enabled=true 时调用 enableRoomBurn', async () => {
      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      const result = await flow.toggleRoomBurn(true, 30000)
      expect(result).toBe(true)
      expect(mockEnableBurn).toHaveBeenCalledWith('!room:server', 30000)
    })

    it('enabled=false 时调用 disableRoomBurn', async () => {
      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      const result = await flow.toggleRoomBurn(false)
      expect(result).toBe(true)
      expect(mockDisableBurn).toHaveBeenCalledWith('!room:server')
    })
  })

  describe('updateDefaultDuration', () => {
    it('更新成功时显示成功反馈并返回 true', async () => {
      mockSetBurnConfig.mockResolvedValueOnce(120000)

      const flow = useBurnAfterReadSettings()
      const result = await flow.updateDefaultDuration(120000)

      expect(result).toBe(true)
      expect(mockSetBurnConfig).toHaveBeenCalledWith(120000)
      expect(mockShowFeedback).toHaveBeenCalledWith('mobile_burn.entry.apply_success', 'success')
    })

    it('服务返回 null 时显示错误反馈', async () => {
      mockSetBurnConfig.mockResolvedValueOnce(null)

      const flow = useBurnAfterReadSettings()
      const result = await flow.updateDefaultDuration(120000)

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('mobile_burn.entry.apply_failed', 'error')
    })

    it('服务抛错时显示错误反馈', async () => {
      mockSetBurnConfig.mockRejectedValueOnce(new Error('forbidden'))

      const flow = useBurnAfterReadSettings()
      const result = await flow.updateDefaultDuration(120000)

      expect(result).toBe(false)
      expect(flow.updating.value).toBe(false)
    })
  })

  describe('cancelBurn', () => {
    it('取消成功时从 pendingBurns 移除该事件', async () => {
      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      flow.pendingBurns.value = [
        { eventId: '$e1:server', createdAt: 1, deleteAt: 2 },
        { eventId: '$e2:server', createdAt: 3, deleteAt: 4 }
      ]

      const result = await flow.cancelBurn('$e1:server')

      expect(result).toBe(true)
      expect(mockCancelBurn).toHaveBeenCalledWith('!room:server', '$e1:server')
      expect(flow.pendingBurns.value).toHaveLength(1)
      expect(flow.pendingBurns.value[0].eventId).toBe('$e2:server')
    })

    it('未提供 roomId 时返回 false', async () => {
      const flow = useBurnAfterReadSettings()
      const result = await flow.cancelBurn('$e1:server')
      expect(result).toBe(false)
    })

    it('空 eventId 时返回 false', async () => {
      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      const result = await flow.cancelBurn('')
      expect(result).toBe(false)
    })

    it('取消失败时返回 false 但不抛错', async () => {
      mockCancelBurn.mockResolvedValueOnce(false)
      const flow = useBurnAfterReadSettings({ roomId: '!room:server' })
      const result = await flow.cancelBurn('$e1:server')
      expect(result).toBe(false)
    })
  })

  describe('setRoomId', () => {
    it('更新 roomId 并清空相关状态', () => {
      const flow = useBurnAfterReadSettings({ roomId: '!room1:server' })
      flow.roomSettings.value = { enabled: true, burnAfterMs: 1000 }
      flow.pendingBurns.value = [{ eventId: '$e1:server', createdAt: 1, deleteAt: 2 }]
      flow.errorMessage.value = 'some error'

      flow.setRoomId('!room2:server')

      expect(flow.hasRoom.value).toBe(true)
      expect(flow.roomSettings.value).toBeNull()
      expect(flow.pendingBurns.value).toEqual([])
      expect(flow.errorMessage.value).toBeNull()
    })

    it('传入 undefined 时 hasRoom 变为 false', () => {
      const flow = useBurnAfterReadSettings({ roomId: '!room1:server' })
      flow.setRoomId(undefined)
      expect(flow.hasRoom.value).toBe(false)
    })
  })
})
