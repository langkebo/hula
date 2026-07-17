import { beforeEach, describe, expect, it, vi } from 'vitest'

// 提前声明 mock,便于在测试用例中访问
const { mockSendLocation, mockCreateBeacon, mockStopBeacon, mockShowFeedback } = vi.hoisted(() => ({
  mockSendLocation: vi.fn(),
  mockCreateBeacon: vi.fn(),
  mockStopBeacon: vi.fn(),
  mockShowFeedback: vi.fn()
}))

vi.mock('@/services/matrix/media/MatrixLocationService', () => ({
  matrixLocationService: {
    sendLocation: mockSendLocation
  }
}))

vi.mock('@/services/matrix/media/MatrixBeaconService', () => ({
  matrixBeaconService: {
    createBeacon: mockCreateBeacon,
    stopBeacon: mockStopBeacon
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

import { useLocationShare } from '../useLocationShare'

// navigator.geolocation 的可控 mock
type GeoSuccessCb = (pos: {
  coords: { latitude: number; longitude: number; accuracy: number }
  timestamp: number
}) => void
type GeoErrorCb = (err: { code: number; message: string; PERMISSION_DENIED?: number }) => void

interface GeoMock {
  getCurrentPosition: ReturnType<typeof vi.fn>
}

let geoMock: GeoMock
let geoSuccess: GeoSuccessCb | null
let geoError: GeoErrorCb | null

const POSITION_DENIED = 1

beforeEach(() => {
  vi.clearAllMocks()
  geoSuccess = null
  geoError = null
  geoMock = {
    getCurrentPosition: vi.fn((success: GeoSuccessCb, error?: GeoErrorCb) => {
      geoSuccess = success
      geoError = error ?? null
    })
  }
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    configurable: true,
    value: geoMock
  })
})

describe('useLocationShare', () => {
  describe('initial state', () => {
    it('初始状态:sharing/currentLocation/error/beaconInfoEventId 均为空,loading 为 false', () => {
      const composable = useLocationShare({ roomId: '!room:server' })
      expect(composable.sharing.value).toBe(false)
      expect(composable.currentLocation.value).toBeNull()
      expect(composable.error.value).toBeNull()
      expect(composable.beaconInfoEventId.value).toBeNull()
      expect(composable.loading.value).toBe(false)
    })
  })

  describe('getCurrentPosition', () => {
    it('成功获取位置时更新 currentLocation 并返回 LocationData', async () => {
      const composable = useLocationShare({ roomId: '!room:server' })
      const promise = composable.getCurrentPosition()

      expect(composable.loading.value).toBe(true)
      geoSuccess?.({
        coords: { latitude: 30.1, longitude: 120.2, accuracy: 15 },
        timestamp: 1700000000000
      })

      const result = await promise
      expect(result).toEqual({
        latitude: 30.1,
        longitude: 120.2,
        accuracy: 15,
        timestamp: 1700000000000
      })
      expect(composable.currentLocation.value).toEqual(result)
      expect(composable.loading.value).toBe(false)
      expect(composable.error.value).toBeNull()
    })

    it('浏览器不支持 geolocation 时返回 null 并显示错误', async () => {
      // 暂时移除 geolocation
      Object.defineProperty(globalThis.navigator, 'geolocation', {
        configurable: true,
        value: undefined
      })

      const composable = useLocationShare({ roomId: '!room:server' })
      const result = await composable.getCurrentPosition()

      expect(result).toBeNull()
      expect(composable.error.value).toBe('location_share.permission_failed')
      expect(mockShowFeedback).toHaveBeenCalledWith('location_share.permission_failed', 'error')
      expect(composable.loading.value).toBe(false)

      // 还原 geolocation 给后续用例
      Object.defineProperty(globalThis.navigator, 'geolocation', {
        configurable: true,
        value: geoMock
      })
    })

    it('PERMISSION_DENIED 错误时显示权限拒绝提示', async () => {
      const composable = useLocationShare({ roomId: '!room:server' })
      const promise = composable.getCurrentPosition()

      geoError?.({ code: POSITION_DENIED, message: 'User denied', PERMISSION_DENIED: POSITION_DENIED })

      const result = await promise
      expect(result).toBeNull()
      expect(composable.error.value).toBe('location_share.permission_denied')
      expect(mockShowFeedback).toHaveBeenCalledWith('location_share.permission_denied', 'error')
      expect(composable.loading.value).toBe(false)
    })

    it('非 PERMISSION_DENIED 错误显示 permission_failed', async () => {
      const composable = useLocationShare({ roomId: '!room:server' })
      const promise = composable.getCurrentPosition()

      // code=2 (POSITION_UNAVAILABLE)
      geoError?.({ code: 2, message: 'Unavailable' })

      const result = await promise
      expect(result).toBeNull()
      expect(composable.error.value).toBe('location_share.permission_failed')
      expect(mockShowFeedback).toHaveBeenCalledWith('location_share.permission_failed', 'error')
    })

    it('调用时传入 enableHighAccuracy/timeout/maximumAge 选项', async () => {
      const composable = useLocationShare({ roomId: '!room:server' })
      const promise = composable.getCurrentPosition()
      geoSuccess?.({
        coords: { latitude: 1, longitude: 2, accuracy: 3 },
        timestamp: 1
      })
      await promise

      expect(geoMock.getCurrentPosition).toHaveBeenCalledTimes(1)
      const optionsArg = geoMock.getCurrentPosition.mock.calls[0]?.[2]
      expect(optionsArg).toMatchObject({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      })
    })
  })

  describe('sendLocation', () => {
    it('roomId 为空且 options.roomId 也为空时返回 false 并显示错误', async () => {
      const composable = useLocationShare({ roomId: null })
      const location = { latitude: 1, longitude: 2, timestamp: 1 }
      const result = await composable.sendLocation('', location)

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('location_share.send_failed', 'error')
      expect(mockSendLocation).not.toHaveBeenCalled()
    })

    it('roomId 入参为空时回退到 options.roomId', async () => {
      mockSendLocation.mockResolvedValueOnce('$event-1')
      const composable = useLocationShare({ roomId: '!room:server' })
      const location = { latitude: 1, longitude: 2, timestamp: 1 }
      const result = await composable.sendLocation('', location)

      expect(result).toBe(true)
      expect(mockSendLocation).toHaveBeenCalledWith('!room:server', location)
    })

    it('成功发送位置时显示成功反馈并返回 true', async () => {
      mockSendLocation.mockResolvedValueOnce('$event-1')
      const composable = useLocationShare({ roomId: '!room:server' })
      const location = { latitude: 30.1, longitude: 120.2, timestamp: 1700000000000 }
      const result = await composable.sendLocation('!room:server', location)

      expect(result).toBe(true)
      expect(mockSendLocation).toHaveBeenCalledWith('!room:server', location)
      expect(mockShowFeedback).toHaveBeenCalledWith('location_share.send_success', 'success')
    })

    it('sendLocation 抛错时返回 false 并显示错误', async () => {
      mockSendLocation.mockRejectedValueOnce(new Error('network'))
      const composable = useLocationShare({ roomId: '!room:server' })
      const location = { latitude: 1, longitude: 2, timestamp: 1 }
      const result = await composable.sendLocation('!room:server', location)

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('location_share.send_failed', 'error')
    })
  })

  describe('startBeacon', () => {
    it('成功开启共享时设置 sharing/beaconInfoEventId 并显示成功反馈', async () => {
      mockCreateBeacon.mockResolvedValueOnce({
        event_id: '$beacon-1',
        room_id: '!room:server',
        user_id: '@u:s',
        is_live: true,
        last_updated: 1
      })
      const composable = useLocationShare({ roomId: '!room:server' })
      const result = await composable.startBeacon('!room:server')

      expect(result).toBe(true)
      expect(composable.sharing.value).toBe(true)
      expect(composable.beaconInfoEventId.value).toBe('$beacon-1')
      expect(mockCreateBeacon).toHaveBeenCalledWith({
        roomId: '!room:server',
        timeout: 3600000
      })
      expect(mockShowFeedback).toHaveBeenCalledWith('location_share.start_success', 'success')
    })

    it('支持自定义 duration 透传给 createBeacon', async () => {
      mockCreateBeacon.mockResolvedValueOnce({
        event_id: '$beacon-2',
        room_id: '!room:server',
        user_id: '@u:s',
        is_live: true,
        last_updated: 1
      })
      const composable = useLocationShare({ roomId: '!room:server' })
      await composable.startBeacon('!room:server', 900000)

      expect(mockCreateBeacon).toHaveBeenCalledWith({
        roomId: '!room:server',
        timeout: 900000
      })
    })

    it('roomId 入参与 options.roomId 均为空时返回 false 并显示错误', async () => {
      const composable = useLocationShare({ roomId: null })
      const result = await composable.startBeacon('')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('location_share.start_failed', 'error')
      expect(mockCreateBeacon).not.toHaveBeenCalled()
      expect(composable.sharing.value).toBe(false)
    })

    it('createBeacon 抛错时返回 false 并显示错误,sharing 保持 false', async () => {
      mockCreateBeacon.mockRejectedValueOnce(new Error('boom'))
      const composable = useLocationShare({ roomId: '!room:server' })
      const result = await composable.startBeacon('!room:server')

      expect(result).toBe(false)
      expect(composable.sharing.value).toBe(false)
      expect(composable.beaconInfoEventId.value).toBeNull()
      expect(mockShowFeedback).toHaveBeenCalledWith('location_share.start_failed', 'error')
    })
  })

  describe('stopBeacon', () => {
    it('未开启共享(beaconInfoEventId 为空)时返回 false 并显示错误', async () => {
      const composable = useLocationShare({ roomId: '!room:server' })
      const result = await composable.stopBeacon('!room:server')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('location_share.stop_failed', 'error')
      expect(mockStopBeacon).not.toHaveBeenCalled()
    })

    it('roomId 入参与 options.roomId 均为空时返回 false 并显示错误', async () => {
      const composable = useLocationShare({ roomId: null })
      composable.beaconInfoEventId.value = '$beacon-1'
      const result = await composable.stopBeacon('')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('location_share.stop_failed', 'error')
      expect(mockStopBeacon).not.toHaveBeenCalled()
    })

    it('成功停止时重置 sharing/beaconInfoEventId 并显示成功反馈', async () => {
      mockStopBeacon.mockResolvedValueOnce(true)
      const composable = useLocationShare({ roomId: '!room:server' })
      composable.beaconInfoEventId.value = '$beacon-1'
      composable.sharing.value = true

      const result = await composable.stopBeacon('!room:server')

      expect(result).toBe(true)
      expect(mockStopBeacon).toHaveBeenCalledWith('!room:server', '$beacon-1')
      expect(composable.sharing.value).toBe(false)
      expect(composable.beaconInfoEventId.value).toBeNull()
      expect(mockShowFeedback).toHaveBeenCalledWith('location_share.stop_success', 'success')
    })

    it('stopBeacon 返回 false 时显示错误且不重置状态', async () => {
      mockStopBeacon.mockResolvedValueOnce(false)
      const composable = useLocationShare({ roomId: '!room:server' })
      composable.beaconInfoEventId.value = '$beacon-1'
      composable.sharing.value = true

      const result = await composable.stopBeacon('!room:server')

      expect(result).toBe(false)
      expect(composable.sharing.value).toBe(true)
      expect(composable.beaconInfoEventId.value).toBe('$beacon-1')
      expect(mockShowFeedback).toHaveBeenCalledWith('location_share.stop_failed', 'error')
    })

    it('stopBeacon 抛错时返回 false 并显示错误', async () => {
      mockStopBeacon.mockRejectedValueOnce(new Error('network'))
      const composable = useLocationShare({ roomId: '!room:server' })
      composable.beaconInfoEventId.value = '$beacon-1'
      composable.sharing.value = true

      const result = await composable.stopBeacon('!room:server')

      expect(result).toBe(false)
      expect(composable.sharing.value).toBe(true)
      expect(mockShowFeedback).toHaveBeenCalledWith('location_share.stop_failed', 'error')
    })
  })

  describe('reset', () => {
    it('重置后所有状态恢复初始值', async () => {
      mockCreateBeacon.mockResolvedValueOnce({
        event_id: '$beacon-1',
        room_id: '!room:server',
        user_id: '@u:s',
        is_live: true,
        last_updated: 1
      })
      mockStopBeacon.mockResolvedValueOnce(true)
      const composable = useLocationShare({ roomId: '!room:server' })

      // 制造一些状态
      await composable.startBeacon('!room:server')
      composable.currentLocation.value = { latitude: 1, longitude: 2, timestamp: 1 }
      composable.error.value = 'something'

      composable.reset()

      expect(composable.sharing.value).toBe(false)
      expect(composable.currentLocation.value).toBeNull()
      expect(composable.error.value).toBeNull()
      expect(composable.beaconInfoEventId.value).toBeNull()
      expect(composable.loading.value).toBe(false)
    })

    it('reset 时若有在途 beacon 则调用 stopBeacon', async () => {
      mockCreateBeacon.mockResolvedValueOnce({ event_id: '$beacon2' })
      mockStopBeacon.mockResolvedValueOnce(true)
      const composable = useLocationShare({ roomId: '!room:hs' })

      await composable.startBeacon('!room:hs')
      composable.reset()
      await Promise.resolve()

      expect(mockStopBeacon).toHaveBeenCalledWith('!room:hs', '$beacon2')
      expect(composable.sharing.value).toBe(false)
    })
  })

  describe('startBeacon reentry guard', () => {
    it('sharing 中再次 startBeacon 直接返回 false 且不重复创建', async () => {
      mockCreateBeacon.mockResolvedValueOnce({ event_id: '$beacon1' })
      const composable = useLocationShare({ roomId: '!room:hs' })

      expect(await composable.startBeacon('!room:hs')).toBe(true)
      expect(await composable.startBeacon('!room:hs')).toBe(false)
      expect(mockCreateBeacon).toHaveBeenCalledTimes(1)
    })
  })
})
