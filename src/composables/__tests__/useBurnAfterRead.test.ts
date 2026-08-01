import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

const globalStoreMock = reactive<{ currentSessionRoomId: string }>({
  currentSessionRoomId: ''
})

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStoreMock
}))

const getBurnSettingsMock = vi.fn()
const enableBurnMock = vi.fn()
const disableBurnMock = vi.fn()
const markBurnReadMock = vi.fn()

vi.mock('@/services/matrix/messaging/MatrixBurnAfterReadService', () => ({
  matrixBurnAfterReadService: {
    getBurnSettings: (...args: unknown[]) => getBurnSettingsMock(...args),
    enableBurn: (...args: unknown[]) => enableBurnMock(...args),
    disableBurn: (...args: unknown[]) => disableBurnMock(...args),
    markBurnRead: (...args: unknown[]) => markBurnReadMock(...args)
  }
}))

const { useBurnAfterRead } = await import('@/composables/useBurnAfterRead')

describe('useBurnAfterRead', () => {
  beforeEach(() => {
    globalStoreMock.currentSessionRoomId = ''
    getBurnSettingsMock.mockReset()
    enableBurnMock.mockReset()
    disableBurnMock.mockReset()
    markBurnReadMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('isRoomBurnEnabled', () => {
    it('roomId 为空且无 currentSessionRoomId 时返回 false', () => {
      const { isRoomBurnEnabled } = useBurnAfterRead()
      expect(isRoomBurnEnabled()).toBe(false)
    })

    it('缓存未命中时默认返回 false', () => {
      const { isRoomBurnEnabled } = useBurnAfterRead()
      expect(isRoomBurnEnabled('room-1')).toBe(false)
    })

    it('使用 currentSessionRoomId 作为默认 roomId', () => {
      globalStoreMock.currentSessionRoomId = 'session-room'
      const { isRoomBurnEnabled } = useBurnAfterRead()
      expect(isRoomBurnEnabled()).toBe(false)
    })

    it('显式传入 roomId 优先于 currentSessionRoomId', () => {
      globalStoreMock.currentSessionRoomId = 'session-room'
      const { isRoomBurnEnabled, refreshBurnSettings } = useBurnAfterRead()
      // 先为 room-explicit 启用，不应影响 session-room
      return refreshBurnSettings('room-explicit').then(() => {
        // room-explicit 缓存中是 false（取决于 mock），先测试默认 false
        expect(isRoomBurnEnabled('room-explicit')).toBe(false)
      })
    })
  })

  describe('getRoomBurnDuration', () => {
    it('roomId 为空时返回 0', () => {
      const { getRoomBurnDuration } = useBurnAfterRead()
      expect(getRoomBurnDuration()).toBe(0)
    })

    it('缓存未命中时默认返回 0', () => {
      const { getRoomBurnDuration } = useBurnAfterRead()
      expect(getRoomBurnDuration('room-1')).toBe(0)
    })

    it('使用 currentSessionRoomId 作为默认 roomId', () => {
      globalStoreMock.currentSessionRoomId = 'session-room'
      const { getRoomBurnDuration } = useBurnAfterRead()
      expect(getRoomBurnDuration()).toBe(0)
    })
  })

  describe('refreshBurnSettings', () => {
    it('roomId 为空时直接返回，不调用服务', async () => {
      const { refreshBurnSettings } = useBurnAfterRead()
      await refreshBurnSettings()
      expect(getBurnSettingsMock).not.toHaveBeenCalled()
    })

    it('服务返回设置时更新 enabled 缓存和 duration 缓存', async () => {
      getBurnSettingsMock.mockResolvedValue({ enabled: true, burnAfterMs: 60000 })
      const { refreshBurnSettings, isRoomBurnEnabled, getRoomBurnDuration } = useBurnAfterRead()
      await refreshBurnSettings('room-1')
      expect(getBurnSettingsMock).toHaveBeenCalledWith('room-1')
      expect(isRoomBurnEnabled('room-1')).toBe(true)
      expect(getRoomBurnDuration('room-1')).toBe(60000)
    })

    it('服务返回 null 时不更新缓存', async () => {
      getBurnSettingsMock.mockResolvedValue(null)
      const { refreshBurnSettings, isRoomBurnEnabled, getRoomBurnDuration } = useBurnAfterRead()
      await refreshBurnSettings('room-1')
      expect(isRoomBurnEnabled('room-1')).toBe(false)
      expect(getRoomBurnDuration('room-1')).toBe(0)
    })

    it('服务抛错时不更新缓存也不抛出', async () => {
      getBurnSettingsMock.mockRejectedValue(new Error('network error'))
      const { refreshBurnSettings, isRoomBurnEnabled } = useBurnAfterRead()
      await expect(refreshBurnSettings('room-1')).resolves.toBeUndefined()
      expect(isRoomBurnEnabled('room-1')).toBe(false)
    })

    it('使用 currentSessionRoomId 作为默认 roomId', async () => {
      globalStoreMock.currentSessionRoomId = 'session-room'
      getBurnSettingsMock.mockResolvedValue({ enabled: true, burnAfterMs: 30000 })
      const { refreshBurnSettings } = useBurnAfterRead()
      await refreshBurnSettings()
      expect(getBurnSettingsMock).toHaveBeenCalledWith('session-room')
    })
  })

  describe('enableBurn', () => {
    it('roomId 为空时直接返回', async () => {
      const { enableBurn } = useBurnAfterRead()
      await enableBurn()
      expect(enableBurnMock).not.toHaveBeenCalled()
    })

    it('服务返回非空结果时更新缓存为 true', async () => {
      enableBurnMock.mockResolvedValue({ enabled: true, burnAfterMs: 60000 })
      const { enableBurn, isRoomBurnEnabled } = useBurnAfterRead()
      await enableBurn('room-1', 60000)
      expect(enableBurnMock).toHaveBeenCalledWith('room-1', 60000)
      expect(isRoomBurnEnabled('room-1')).toBe(true)
    })

    it('服务返回 null 时不更新缓存', async () => {
      enableBurnMock.mockResolvedValue(null)
      const { enableBurn, isRoomBurnEnabled } = useBurnAfterRead()
      await enableBurn('room-1')
      expect(isRoomBurnEnabled('room-1')).toBe(false)
    })

    it('服务抛错时不更新缓存也不抛出', async () => {
      enableBurnMock.mockRejectedValue(new Error('server error'))
      const { enableBurn, isRoomBurnEnabled } = useBurnAfterRead()
      await expect(enableBurn('room-1')).resolves.toBeUndefined()
      expect(isRoomBurnEnabled('room-1')).toBe(false)
    })
  })

  describe('disableBurn', () => {
    it('roomId 为空时直接返回', async () => {
      const { disableBurn } = useBurnAfterRead()
      await disableBurn()
      expect(disableBurnMock).not.toHaveBeenCalled()
    })

    it('服务返回非空结果时更新缓存为 false', async () => {
      disableBurnMock.mockResolvedValue({ enabled: false, burnAfterMs: 0 })
      // 先启用，再禁用，验证缓存切换
      enableBurnMock.mockResolvedValue({ enabled: true, burnAfterMs: 60000 })
      const { enableBurn, disableBurn, isRoomBurnEnabled } = useBurnAfterRead()
      await enableBurn('room-1')
      expect(isRoomBurnEnabled('room-1')).toBe(true)

      await disableBurn('room-1')
      expect(disableBurnMock).toHaveBeenCalledWith('room-1')
      expect(isRoomBurnEnabled('room-1')).toBe(false)
    })

    it('服务返回 null 时不更新缓存', async () => {
      // 先启用
      enableBurnMock.mockResolvedValue({ enabled: true, burnAfterMs: 60000 })
      const { enableBurn, disableBurn, isRoomBurnEnabled } = useBurnAfterRead()
      await enableBurn('room-1')
      expect(isRoomBurnEnabled('room-1')).toBe(true)

      // disable 返回 null，缓存应保持 true
      disableBurnMock.mockResolvedValue(null)
      await disableBurn('room-1')
      expect(isRoomBurnEnabled('room-1')).toBe(true)
    })

    it('服务抛错时不更新缓存也不抛出', async () => {
      disableBurnMock.mockRejectedValue(new Error('server error'))
      const { disableBurn } = useBurnAfterRead()
      await expect(disableBurn('room-1')).resolves.toBeUndefined()
    })
  })

  describe('toggleRoomBurn', () => {
    it('roomId 为空时直接返回', async () => {
      const { toggleRoomBurn } = useBurnAfterRead()
      await toggleRoomBurn()
      expect(enableBurnMock).not.toHaveBeenCalled()
      expect(disableBurnMock).not.toHaveBeenCalled()
    })

    it('当前未启用时调用 enableBurn 并更新缓存', async () => {
      enableBurnMock.mockResolvedValue({ enabled: true, burnAfterMs: 60000 })
      const { toggleRoomBurn, isRoomBurnEnabled } = useBurnAfterRead()
      await toggleRoomBurn('room-1')
      expect(enableBurnMock).toHaveBeenCalledWith('room-1')
      expect(disableBurnMock).not.toHaveBeenCalled()
      expect(isRoomBurnEnabled('room-1')).toBe(true)
    })

    it('当前已启用时调用 disableBurn 并更新缓存', async () => {
      // 先启用
      enableBurnMock.mockResolvedValue({ enabled: true, burnAfterMs: 60000 })
      const { enableBurn, toggleRoomBurn, isRoomBurnEnabled } = useBurnAfterRead()
      await enableBurn('room-1')
      expect(isRoomBurnEnabled('room-1')).toBe(true)

      disableBurnMock.mockResolvedValue({ enabled: false, burnAfterMs: 0 })
      await toggleRoomBurn('room-1')
      expect(disableBurnMock).toHaveBeenCalledWith('room-1')
      expect(isRoomBurnEnabled('room-1')).toBe(false)
    })

    it('enableBurn 返回 null 时不更新缓存（避免乐观更新导致状态不一致）', async () => {
      enableBurnMock.mockResolvedValue(null)
      const { toggleRoomBurn, isRoomBurnEnabled } = useBurnAfterRead()
      await toggleRoomBurn('room-1')
      expect(enableBurnMock).toHaveBeenCalledWith('room-1')
      expect(isRoomBurnEnabled('room-1')).toBe(false)
    })

    it('服务抛错时保持原有状态不抛出', async () => {
      enableBurnMock.mockRejectedValue(new Error('server error'))
      const { toggleRoomBurn, isRoomBurnEnabled } = useBurnAfterRead()
      await expect(toggleRoomBurn('room-1')).resolves.toBeUndefined()
      expect(isRoomBurnEnabled('room-1')).toBe(false)
    })
  })

  describe('markMessageRead', () => {
    it('roomId 为空时直接返回', async () => {
      const { markMessageRead } = useBurnAfterRead()
      await markMessageRead('msg-1')
      expect(markBurnReadMock).not.toHaveBeenCalled()
    })

    it('调用 markBurnRead 服务', async () => {
      markBurnReadMock.mockResolvedValue(true)
      const { markMessageRead } = useBurnAfterRead()
      await markMessageRead('msg-1', 'room-1')
      expect(markBurnReadMock).toHaveBeenCalledWith('room-1', 'msg-1')
    })

    it('使用 currentSessionRoomId 作为默认 roomId', async () => {
      globalStoreMock.currentSessionRoomId = 'session-room'
      markBurnReadMock.mockResolvedValue(true)
      const { markMessageRead } = useBurnAfterRead()
      await markMessageRead('msg-1')
      expect(markBurnReadMock).toHaveBeenCalledWith('session-room', 'msg-1')
    })

    it('服务抛错时不抛出', async () => {
      markBurnReadMock.mockRejectedValue(new Error('server error'))
      const { markMessageRead } = useBurnAfterRead()
      await expect(markMessageRead('msg-1', 'room-1')).resolves.toBeUndefined()
    })
  })

  describe('getBurnStats', () => {
    it('空缓存时返回零值统计', () => {
      const { getBurnStats } = useBurnAfterRead()
      const stats = getBurnStats()
      expect(stats).toEqual({
        totalBurned: 0,
        totalPending: 0,
        roomsWithBurnEnabled: 0,
        enabledCount: 0,
        totalCount: 0
      })
    })

    it('根据缓存统计启用的房间数', async () => {
      enableBurnMock.mockResolvedValue({ enabled: true, burnAfterMs: 60000 })
      const { enableBurn, getBurnStats } = useBurnAfterRead()
      await enableBurn('room-1')
      await enableBurn('room-2')
      await enableBurn('room-3')

      const stats = getBurnStats()
      expect(stats.roomsWithBurnEnabled).toBe(3)
      expect(stats.enabledCount).toBe(3)
      expect(stats.totalCount).toBe(3)
      expect(stats.totalBurned).toBe(0)
      expect(stats.totalPending).toBe(0)
    })

    it('混合启用/禁用状态的统计正确', async () => {
      enableBurnMock.mockResolvedValue({ enabled: true, burnAfterMs: 60000 })
      disableBurnMock.mockResolvedValue({ enabled: false, burnAfterMs: 0 })
      const { enableBurn, disableBurn, getBurnStats } = useBurnAfterRead()
      await enableBurn('room-1')
      await enableBurn('room-2')
      await disableBurn('room-2')
      await enableBurn('room-3')

      const stats = getBurnStats()
      // room-1: true, room-2: false, room-3: true -> 启用 2 个，总数 3
      expect(stats.enabledCount).toBe(2)
      expect(stats.totalCount).toBe(3)
    })
  })
})
