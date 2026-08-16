import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

// 可控 mock：useGeolocation 的 getCurrentPosition / getLocationWithTransform / watchPosition
const { mockGetCurrentPosition, mockGetLocationWithTransform, mockWatchPosition } = vi.hoisted(() => {
  type WatchUpdate = (pos: {
    coords: { latitude: number; longitude: number; accuracy: number }
    timestamp: number
  }) => void
  return {
    mockGetCurrentPosition: vi.fn(),
    mockGetLocationWithTransform: vi.fn(),
    mockWatchPosition: vi.fn<(onUpdate: WatchUpdate, onError: (err: Error) => void) => () => void>(() => vi.fn())
  }
})

vi.mock('@/composables/common/useGeolocation', () => ({
  useGeolocation: () => ({
    getCurrentPosition: mockGetCurrentPosition,
    getLocationWithTransform: mockGetLocationWithTransform,
    watchPosition: mockWatchPosition,
    isLoading: { value: false }
  })
}))

// 地图组件用桩替代，避免引入腾讯静态图代理与 HTTP 客户端
vi.mock('@/components/rightBox/location/StaticProxyMap.vue', () => ({
  default: {
    name: 'StaticProxyMap',
    template: '<div class="static-map-stub" />',
    props: ['location', 'zoom', 'height', 'draggable', 'controls']
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

vi.mock('@/services/matrix/media/MatrixBeaconService', () => ({
  matrixBeaconService: {
    createBeacon: vi.fn(),
    updateBeaconLocation: vi.fn(),
    stopBeacon: vi.fn()
  }
}))

vi.mock('@/services/matrix/media/MatrixLocationService', () => ({
  matrixLocationService: {
    sendLocation: vi.fn(),
    getCurrentPosition: vi.fn(),
    getOpenStreetMapUrl: vi.fn()
  }
}))

import StaticProxyMap from '@/components/rightBox/location/StaticProxyMap.vue'
import { matrixBeaconService } from '@/services/matrix/media/MatrixBeaconService'
import { matrixLocationService } from '@/services/matrix/media/MatrixLocationService'

const VanButtonStub = {
  name: 'VanButton',
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
  props: ['loading', 'disabled', 'type', 'size', 'block', 'plain', 'round'],
  emits: ['click']
}

const POSITION = {
  coords: { latitude: 39.9042, longitude: 116.4074, accuracy: 12 },
  timestamp: 1700000001000
}

const LOCATION = { latitude: 39.9042, longitude: 116.4074, accuracy: 12, timestamp: 1700000001000 }

const BEACON = {
  event_id: '$beacon1',
  room_id: '!room:test',
  user_id: '@alice:example.com',
  description: undefined,
  timeout: 3600000,
  is_live: true,
  last_updated: 1700000000000
}

async function mountShare() {
  const LocationShare = (await import('#/views/chat-room/LocationShare.vue')).default
  return mount(LocationShare, {
    props: { show: false, roomId: '!room:test' },
    global: {
      renderStubDefaultSlot: true,
      stubs: {
        'van-popup': true,
        'van-cell-group': true,
        'van-cell': true,
        'van-button': VanButtonStub
      }
    }
  })
}

const findButtonByText = (wrapper: ReturnType<typeof mount>, text: string) =>
  wrapper.findAll('button').find((btn) => btn.text().includes(text))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mockGetCurrentPosition.mockResolvedValue(POSITION)
  mockGetLocationWithTransform.mockResolvedValue({
    original: { lat: 39.9042, lng: 116.4074 },
    transformed: { lat: 39.9085, lng: 116.4127 },
    position: POSITION,
    address: '',
    precision: 'high',
    timestamp: 1700000001000
  })
  vi.mocked(matrixLocationService.getCurrentPosition).mockResolvedValue(LOCATION)
  vi.mocked(matrixLocationService.sendLocation).mockResolvedValue('$event-1')
  vi.mocked(matrixBeaconService.createBeacon).mockResolvedValue(BEACON)
  vi.mocked(matrixBeaconService.updateBeaconLocation).mockResolvedValue({
    event_id: '$loc1',
    beacon_info_id: '$beacon1',
    timestamp: 1,
    latitude: 39.9042,
    longitude: 116.4074
  })
  vi.mocked(matrixBeaconService.stopBeacon).mockResolvedValue(true)
})

/** 打开面板并等待自动定位完成 */
async function openAndLocate(wrapper: ReturnType<typeof mount>) {
  await wrapper.setProps({ show: true })
  await flushPromises()
  expect(mockGetLocationWithTransform).toHaveBeenCalled()
}

/** 点击开始共享并等待完整开链（startLiveShare → startLiveWatch）完成 */
async function startShare(wrapper: ReturnType<typeof mount>) {
  await findButtonByText(wrapper, 'location_share.start_share')?.trigger('click')
  await flushPromises()
}

describe('LocationShare - store + watchPosition 闭环', () => {
  it('开启共享:接入 store.startLiveShare 并建立 watchPosition 监听', async () => {
    const wrapper = await mountShare()
    await openAndLocate(wrapper)
    await startShare(wrapper)

    expect(mockWatchPosition).toHaveBeenCalledTimes(1)
    expect(matrixBeaconService.createBeacon).toHaveBeenCalledWith({
      roomId: '!room:test',
      description: undefined,
      timeout: 3600000
    })
    wrapper.unmount()
  })

  it('watchPosition 位置更新时发布 m.beacon 位置', async () => {
    const wrapper = await mountShare()
    await openAndLocate(wrapper)
    await startShare(wrapper)

    // 取 watchPosition 注册的 onUpdate 回调并模拟一次位置更新
    const onUpdate = mockWatchPosition.mock.calls[0][0]
    onUpdate(POSITION)
    await flushPromises()

    // 初始发布 1 次 + 位置更新发布 1 次
    expect(matrixBeaconService.updateBeaconLocation).toHaveBeenCalledTimes(2)
    expect(matrixBeaconService.updateBeaconLocation).toHaveBeenLastCalledWith({
      roomId: '!room:test',
      beaconInfoEventId: '$beacon1',
      latitude: 39.9042,
      longitude: 116.4074,
      uncertainty: 12
    })
    wrapper.unmount()
  })

  it('停止共享:清理 watchPosition 并调用 store.stopLiveShare', async () => {
    const cleanup = vi.fn()
    mockWatchPosition.mockReturnValue(cleanup)

    const wrapper = await mountShare()
    await openAndLocate(wrapper)
    await startShare(wrapper)
    await nextTick()

    await findButtonByText(wrapper, 'location_share.stop_share')?.trigger('click')
    await flushPromises()

    expect(matrixBeaconService.stopBeacon).toHaveBeenCalledWith('!room:test', '$beacon1')
    expect(cleanup).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('发送当前位置:调用 matrixLocationService.sendLocation', async () => {
    const wrapper = await mountShare()
    await openAndLocate(wrapper)

    await findButtonByText(wrapper, 'location_share.share_once')?.trigger('click')
    await flushPromises()

    expect(matrixLocationService.sendLocation).toHaveBeenCalledWith('!room:test', LOCATION)
    wrapper.unmount()
  })

  it('地图预览使用 getLocationWithTransform 的 GCJ-02 转换坐标', async () => {
    const wrapper = await mountShare()
    await openAndLocate(wrapper)

    const map = wrapper.findComponent(StaticProxyMap)
    expect(map.exists()).toBe(true)

    const loc = map.props('location') as { latitude: number; longitude: number }
    expect(loc.latitude).toBeCloseTo(39.9085, 5)
    expect(loc.longitude).toBeCloseTo(116.4127, 5)
    wrapper.unmount()
  })
})
