import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixBeaconService } from '@/services/matrix/media/MatrixBeaconService'
import { matrixLocationService } from '@/services/matrix/media/MatrixLocationService'
import { useLocationStore } from '../index'

vi.mock('@/services/matrix/media/MatrixBeaconService', () => ({
  matrixBeaconService: {
    createBeacon: vi.fn(),
    updateBeaconLocation: vi.fn(),
    stopBeacon: vi.fn(),
    getActiveBeacons: vi.fn()
  }
}))

vi.mock('@/services/matrix/media/MatrixLocationService', () => ({
  matrixLocationService: {
    getCurrentPosition: vi.fn()
  }
}))

const BEACON = {
  event_id: '$beacon1',
  room_id: '!room:id',
  user_id: '@alice:example.com',
  description: '实时位置共享',
  timeout: 3600000,
  is_live: true,
  last_updated: 1700000000000
}

const LOCATION = {
  latitude: 39.9042,
  longitude: 116.4074,
  accuracy: 12,
  timestamp: 1700000001000
}

const LOCATION_EVENT = {
  event_id: '$loc1',
  beacon_info_id: '$beacon1',
  timestamp: 1700000001000,
  latitude: 39.9042,
  longitude: 116.4074
}

describe('useLocationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('初始状态为空且未在共享', () => {
    const store = useLocationStore()
    expect(store.activeBeacons.size).toBe(0)
    expect(store.sharing).toBe(false)
    expect(store.currentLocation).toBeNull()
  })

  describe('startLiveShare', () => {
    it('创建信标、取一次位置并发布首个 m.beacon', async () => {
      vi.mocked(matrixBeaconService.createBeacon).mockResolvedValue(BEACON)
      vi.mocked(matrixLocationService.getCurrentPosition).mockResolvedValue(LOCATION)
      vi.mocked(matrixBeaconService.updateBeaconLocation).mockResolvedValue(LOCATION_EVENT)

      const store = useLocationStore()
      const beaconId = await store.startLiveShare('!room:id', '实时位置共享')

      expect(beaconId).toBe('$beacon1')
      expect(matrixBeaconService.createBeacon).toHaveBeenCalledWith({
        roomId: '!room:id',
        description: '实时位置共享',
        timeout: undefined
      })
      expect(matrixLocationService.getCurrentPosition).toHaveBeenCalledTimes(1)
      expect(matrixBeaconService.updateBeaconLocation).toHaveBeenCalledWith({
        roomId: '!room:id',
        beaconInfoEventId: '$beacon1',
        latitude: 39.9042,
        longitude: 116.4074,
        uncertainty: 12
      })

      expect(store.sharing).toBe(true)
      expect(store.activeBeacons.get('$beacon1')).toEqual({
        roomId: '!room:id',
        owner: '@alice:example.com',
        description: '实时位置共享',
        timeout: 3600000,
        timestamp: expect.any(Number),
        isLive: true,
        latestUri: 'geo:39.9042,116.4074'
      })
      expect(store.currentLocation).toEqual(LOCATION)
    })

    it('定位失败时仍创建信标并开启共享（不发布位置）', async () => {
      vi.mocked(matrixBeaconService.createBeacon).mockResolvedValue(BEACON)
      vi.mocked(matrixLocationService.getCurrentPosition).mockRejectedValue(new Error('定位失败'))

      const store = useLocationStore()
      const beaconId = await store.startLiveShare('!room:id', '实时位置共享')

      expect(beaconId).toBe('$beacon1')
      expect(matrixBeaconService.updateBeaconLocation).not.toHaveBeenCalled()
      expect(store.sharing).toBe(true)
      expect(store.activeBeacons.get('$beacon1')?.latestUri).toBeUndefined()
      expect(store.currentLocation).toBeNull()
    })
  })

  describe('publishLocation', () => {
    it('对未知 beaconInfoEventId 不发布', async () => {
      const store = useLocationStore()

      await store.publishLocation('$missing', LOCATION)

      expect(matrixBeaconService.updateBeaconLocation).not.toHaveBeenCalled()
      expect(store.currentLocation).toBeNull()
    })

    it('发布位置并更新 latestUri / currentLocation', async () => {
      vi.mocked(matrixBeaconService.createBeacon).mockResolvedValue(BEACON)
      vi.mocked(matrixLocationService.getCurrentPosition).mockRejectedValue(new Error('跳过初始定位'))
      vi.mocked(matrixBeaconService.updateBeaconLocation).mockResolvedValue(LOCATION_EVENT)

      const store = useLocationStore()
      await store.startLiveShare('!room:id', '实时位置共享')

      await store.publishLocation('$beacon1', {
        latitude: 40.0,
        longitude: 117.0,
        accuracy: 5,
        timestamp: 1700000002000
      })

      expect(matrixBeaconService.updateBeaconLocation).toHaveBeenCalledWith({
        roomId: '!room:id',
        beaconInfoEventId: '$beacon1',
        latitude: 40.0,
        longitude: 117.0,
        uncertainty: 5
      })
      expect(store.activeBeacons.get('$beacon1')?.latestUri).toBe('geo:40,117')
      expect(store.currentLocation).toEqual({
        latitude: 40.0,
        longitude: 117.0,
        accuracy: 5,
        timestamp: 1700000002000
      })
    })

    it('信标已停止（isLive=false）时不发布位置（Blocker 1 守卫）', async () => {
      vi.mocked(matrixBeaconService.createBeacon).mockResolvedValue(BEACON)
      vi.mocked(matrixLocationService.getCurrentPosition).mockRejectedValue(new Error('跳过初始定位'))
      vi.mocked(matrixBeaconService.updateBeaconLocation).mockResolvedValue(LOCATION_EVENT)
      vi.mocked(matrixBeaconService.stopBeacon).mockResolvedValue(true)

      const store = useLocationStore()
      await store.startLiveShare('!room:id', '实时位置共享')
      await store.stopLiveShare('$beacon1')

      vi.mocked(matrixBeaconService.updateBeaconLocation).mockClear()

      await store.publishLocation('$beacon1', LOCATION)

      expect(matrixBeaconService.updateBeaconLocation).not.toHaveBeenCalled()
      expect(store.currentLocation).toBeNull()
    })
  })

  describe('stopLiveShare', () => {
    it('对未知 beaconInfoEventId 不调用 stopBeacon', async () => {
      const store = useLocationStore()

      await store.stopLiveShare('$missing')

      expect(matrixBeaconService.stopBeacon).not.toHaveBeenCalled()
    })

    it('停止信标并把共享态关闭', async () => {
      vi.mocked(matrixBeaconService.createBeacon).mockResolvedValue(BEACON)
      vi.mocked(matrixLocationService.getCurrentPosition).mockResolvedValue(LOCATION)
      vi.mocked(matrixBeaconService.updateBeaconLocation).mockResolvedValue(LOCATION_EVENT)
      vi.mocked(matrixBeaconService.stopBeacon).mockResolvedValue(true)

      const store = useLocationStore()
      await store.startLiveShare('!room:id', '实时位置共享')

      await store.stopLiveShare('$beacon1')

      expect(matrixBeaconService.stopBeacon).toHaveBeenCalledWith('!room:id', '$beacon1')
      expect(store.activeBeacons.get('$beacon1')?.isLive).toBe(false)
      expect(store.sharing).toBe(false)
      expect(store.currentLocation).toBeNull()
    })

    it('stopBeacon 返回 false 时抛错并保持共享态', async () => {
      vi.mocked(matrixBeaconService.createBeacon).mockResolvedValue(BEACON)
      vi.mocked(matrixLocationService.getCurrentPosition).mockResolvedValue(LOCATION)
      vi.mocked(matrixBeaconService.updateBeaconLocation).mockResolvedValue(LOCATION_EVENT)
      vi.mocked(matrixBeaconService.stopBeacon).mockResolvedValue(false)

      const store = useLocationStore()
      await store.startLiveShare('!room:id', '实时位置共享')

      await expect(store.stopLiveShare('$beacon1')).rejects.toThrow('停止信标失败')

      expect(matrixBeaconService.stopBeacon).toHaveBeenCalledWith('!room:id', '$beacon1')
      expect(store.activeBeacons.get('$beacon1')?.isLive).toBe(true)
      expect(store.sharing).toBe(true)
    })
  })

  describe('超时自动停止', () => {
    it('到期后自动停止信标并关闭共享态', async () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
      vi.mocked(matrixBeaconService.createBeacon).mockResolvedValue({
        ...BEACON,
        timeout: 60000,
        last_updated: Date.now()
      })
      vi.mocked(matrixLocationService.getCurrentPosition).mockRejectedValue(new Error('跳过初始定位'))
      vi.mocked(matrixBeaconService.stopBeacon).mockResolvedValue(true)

      const store = useLocationStore()
      await store.startLiveShare('!room:id', '实时位置共享', 60000)

      expect(store.sharing).toBe(true)
      expect(matrixBeaconService.stopBeacon).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(60000)

      expect(matrixBeaconService.stopBeacon).toHaveBeenCalledWith('!room:id', '$beacon1')
      expect(store.activeBeacons.get('$beacon1')?.isLive).toBe(false)
      expect(store.sharing).toBe(false)
    })

    it('手动停止后清除到期定时器（不重复停止）', async () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
      vi.mocked(matrixBeaconService.createBeacon).mockResolvedValue({
        ...BEACON,
        timeout: 60000,
        last_updated: Date.now()
      })
      vi.mocked(matrixLocationService.getCurrentPosition).mockRejectedValue(new Error('跳过初始定位'))
      vi.mocked(matrixBeaconService.stopBeacon).mockResolvedValue(true)

      const store = useLocationStore()
      await store.startLiveShare('!room:id', '实时位置共享', 60000)

      await vi.advanceTimersByTimeAsync(30000)
      await store.stopLiveShare('$beacon1')
      expect(matrixBeaconService.stopBeacon).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(120000)
      expect(matrixBeaconService.stopBeacon).toHaveBeenCalledTimes(1)
      expect(store.sharing).toBe(false)
    })

    it('到期自动停止失败后短暂退避重试，最终关闭共享态', async () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
      vi.mocked(matrixBeaconService.createBeacon).mockResolvedValue({
        ...BEACON,
        timeout: 60000,
        last_updated: Date.now()
      })
      vi.mocked(matrixLocationService.getCurrentPosition).mockRejectedValue(new Error('跳过初始定位'))
      vi.mocked(matrixBeaconService.stopBeacon).mockResolvedValueOnce(false).mockResolvedValueOnce(true)

      const store = useLocationStore()
      await store.startLiveShare('!room:id', '实时位置共享', 60000)

      await vi.advanceTimersByTimeAsync(60000)
      // 第一次到期停止失败：仍保持 live，但已调度退避重试（不再永久卡 live）
      expect(matrixBeaconService.stopBeacon).toHaveBeenCalledTimes(1)
      expect(store.activeBeacons.get('$beacon1')?.isLive).toBe(true)
      expect(store.sharing).toBe(true)

      await vi.advanceTimersByTimeAsync(5000)
      // 退避重试成功：关闭共享态
      expect(matrixBeaconService.stopBeacon).toHaveBeenCalledTimes(2)
      expect(store.activeBeacons.get('$beacon1')?.isLive).toBe(false)
      expect(store.sharing).toBe(false)
    })
  })

  describe('restoreActiveBeacons（会话恢复）', () => {
    it('从 getActiveBeacons 重建活跃信标并恢复共享态', async () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
      vi.mocked(matrixBeaconService.getActiveBeacons).mockResolvedValue([
        {
          event_id: '$beacon1',
          room_id: '!room:id',
          user_id: '@alice:example.com',
          description: '实时位置共享',
          timeout: 60000,
          is_live: true,
          last_updated: Date.now()
        }
      ])

      const store = useLocationStore()
      await store.restoreActiveBeacons('!room:id')

      expect(matrixBeaconService.getActiveBeacons).toHaveBeenCalledWith('!room:id')
      expect(store.activeBeacons.size).toBe(1)
      expect(store.activeBeacons.get('$beacon1')?.isLive).toBe(true)
      expect(store.activeBeacons.get('$beacon1')?.timestamp).toBe(Date.now())
      expect(store.sharing).toBe(true)
    })

    it('恢复后为仍 live 的信标重建到期定时器', async () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
      vi.mocked(matrixBeaconService.getActiveBeacons).mockResolvedValue([
        {
          event_id: '$beacon1',
          room_id: '!room:id',
          user_id: '@alice:example.com',
          description: '实时位置共享',
          timeout: 60000,
          is_live: true,
          last_updated: Date.now()
        }
      ])
      vi.mocked(matrixBeaconService.stopBeacon).mockResolvedValue(true)

      const store = useLocationStore()
      await store.restoreActiveBeacons('!room:id')

      await vi.advanceTimersByTimeAsync(60000)

      expect(matrixBeaconService.stopBeacon).toHaveBeenCalledWith('!room:id', '$beacon1')
      expect(store.activeBeacons.get('$beacon1')?.isLive).toBe(false)
      expect(store.sharing).toBe(false)
    })

    it('无活跃信标时保持未共享', async () => {
      vi.mocked(matrixBeaconService.getActiveBeacons).mockResolvedValue([])

      const store = useLocationStore()
      await store.restoreActiveBeacons('!room:id')

      expect(store.activeBeacons.size).toBe(0)
      expect(store.sharing).toBe(false)
    })

    it('恢复房间 B 不清房间 A 的信标与到期定时器（合并语义）', async () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
      const roomABeacon = {
        event_id: '$beacon-a',
        room_id: '!room:a',
        user_id: '@alice:example.com',
        description: 'A',
        timeout: 60000,
        is_live: true,
        last_updated: Date.now()
      }
      const roomBBeacon = {
        event_id: '$beacon-b',
        room_id: '!room:b',
        user_id: '@alice:example.com',
        description: 'B',
        timeout: 120000,
        is_live: true,
        last_updated: Date.now()
      }
      vi.mocked(matrixBeaconService.getActiveBeacons).mockResolvedValueOnce([roomABeacon])
      vi.mocked(matrixBeaconService.stopBeacon).mockResolvedValue(true)

      const store = useLocationStore()
      await store.restoreActiveBeacons('!room:a')
      expect(store.activeBeacons.size).toBe(1)
      expect(store.sharing).toBe(true)

      vi.mocked(matrixBeaconService.getActiveBeacons).mockResolvedValueOnce([roomBBeacon])
      await store.restoreActiveBeacons('!room:b')

      // 两个房间的信标并存，共享态保持 true
      expect(store.activeBeacons.size).toBe(2)
      expect(store.activeBeacons.get('$beacon-a')?.isLive).toBe(true)
      expect(store.activeBeacons.get('$beacon-b')?.isLive).toBe(true)
      expect(store.sharing).toBe(true)

      // 房间 A 的到期定时器未被清除：推进 60s 后 A 自动停止，B 仍 live，共享态仍为 true
      await vi.advanceTimersByTimeAsync(60000)
      expect(matrixBeaconService.stopBeacon).toHaveBeenCalledWith('!room:a', '$beacon-a')
      expect(store.activeBeacons.get('$beacon-a')?.isLive).toBe(false)
      expect(store.activeBeacons.get('$beacon-b')?.isLive).toBe(true)
      expect(store.sharing).toBe(true)
    })

    it('恢复同一房间会清除该房间旧信标并仅保留最新恢复结果', async () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
      const oldBeacon = {
        event_id: '$beacon-old',
        room_id: '!room:a',
        user_id: '@alice:example.com',
        description: '旧',
        timeout: 60000,
        is_live: true,
        last_updated: Date.now()
      }
      const newBeacon = {
        event_id: '$beacon-new',
        room_id: '!room:a',
        user_id: '@alice:example.com',
        description: '新',
        timeout: 60000,
        is_live: true,
        last_updated: Date.now()
      }
      vi.mocked(matrixBeaconService.getActiveBeacons).mockResolvedValueOnce([oldBeacon])
      vi.mocked(matrixBeaconService.stopBeacon).mockResolvedValue(true)

      const store = useLocationStore()
      await store.restoreActiveBeacons('!room:a')
      expect(store.activeBeacons.has('$beacon-old')).toBe(true)

      vi.mocked(matrixBeaconService.getActiveBeacons).mockResolvedValueOnce([newBeacon])
      await store.restoreActiveBeacons('!room:a')

      expect(store.activeBeacons.size).toBe(1)
      expect(store.activeBeacons.has('$beacon-old')).toBe(false)
      expect(store.activeBeacons.has('$beacon-new')).toBe(true)
      expect(store.sharing).toBe(true)
    })

    it('恢复后 sharing 依据「是否存在任一 live 信标」而非信标数量', async () => {
      // 房间 A 的信标已手动停止（仍留在 map，isLive=false）
      vi.mocked(matrixBeaconService.createBeacon).mockResolvedValue({ ...BEACON, room_id: '!room:a' })
      vi.mocked(matrixLocationService.getCurrentPosition).mockRejectedValue(new Error('跳过初始定位'))
      vi.mocked(matrixBeaconService.stopBeacon).mockResolvedValue(true)

      const store = useLocationStore()
      await store.startLiveShare('!room:a')
      await store.stopLiveShare('$beacon1')
      expect(store.sharing).toBe(false)
      expect(store.activeBeacons.size).toBe(1)

      // 恢复房间 B（无活跃信标）：A 的 stopped 信标仍留在 map，但无 live 信标，共享态应为 false
      vi.mocked(matrixBeaconService.getActiveBeacons).mockResolvedValue([])
      await store.restoreActiveBeacons('!room:b')

      expect(store.activeBeacons.size).toBe(1)
      expect(store.sharing).toBe(false)
    })
  })

  describe('reset', () => {
    it('清空所有状态', async () => {
      vi.mocked(matrixBeaconService.createBeacon).mockResolvedValue(BEACON)
      vi.mocked(matrixLocationService.getCurrentPosition).mockResolvedValue(LOCATION)
      vi.mocked(matrixBeaconService.updateBeaconLocation).mockResolvedValue(LOCATION_EVENT)

      const store = useLocationStore()
      await store.startLiveShare('!room:id', '实时位置共享')

      store.reset()

      expect(store.activeBeacons.size).toBe(0)
      expect(store.sharing).toBe(false)
      expect(store.currentLocation).toBeNull()
    })
  })
})
