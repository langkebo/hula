import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixBeaconService } from '@/services/matrix/media/MatrixBeaconService'
import { matrixLocationService } from '@/services/matrix/media/MatrixLocationService'
import { useLocationStore } from '../index'

vi.mock('@/services/matrix/media/MatrixBeaconService', () => ({
  matrixBeaconService: {
    createBeacon: vi.fn(),
    updateBeaconLocation: vi.fn(),
    stopBeacon: vi.fn()
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
