import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BeaconBody } from '@/services/types'
import BeaconMessage from '../Beacon.vue'

const {
  showFeedbackMock,
  openExternalUrlMock,
  getOpenStreetMapUrlMock,
  setIntervalMock,
  clearIntervalMock,
  wgs84ToGcj02Mock
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  openExternalUrlMock: vi.fn(),
  getOpenStreetMapUrlMock: vi.fn(),
  setIntervalMock: vi.fn(() => 1),
  clearIntervalMock: vi.fn(),
  wgs84ToGcj02Mock: vi.fn()
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/composables/common/useLinkSegments', () => ({
  openExternalUrl: openExternalUrlMock
}))

vi.mock('@/utils/CoordinateTransform', () => ({
  wgs84ToGcj02: wgs84ToGcj02Mock
}))

vi.mock('@/services/matrix/media/MatrixLocationService', () => ({
  matrixLocationService: {
    getOpenStreetMapUrl: getOpenStreetMapUrlMock
  }
}))

vi.mock('@/utils/TimerManager', () => ({
  useTimerManager: () => ({
    setInterval: setIntervalMock,
    clearInterval: clearIntervalMock
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    NFlex: defineComponent({
      name: 'NFlex',
      setup(_, { slots }) {
        return () => h('div', slots.default?.())
      }
    }),
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () =>
          h(
            'button',
            {
              type: 'button',
              onClick: () => emit('click')
            },
            slots.default?.()
          )
      }
    })
  }
})

const mountBeacon = (body?: BeaconBody) =>
  mount(BeaconMessage, {
    props: {
      body
    }
  })

describe('Beacon render message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOpenStreetMapUrlMock.mockReturnValue('https://map.example.com')
    wgs84ToGcj02Mock.mockImplementation((lat: number, lng: number) => ({ lat: lat + 0.01, lng: lng + 0.01 }))
  })

  it('uses action feedback when the beacon is inactive', () => {
    const wrapper = mountBeacon({
      description: 'ended beacon',
      isLive: false,
      timeout: 0
    })

    ;(wrapper.vm as unknown as { handleBeaconClick: () => void }).handleBeaconClick()

    expect(showFeedbackMock).toHaveBeenCalledWith('位置共享已结束，无法查看', 'info')
  })

  it('uses action feedback when beacon uri is missing or invalid', () => {
    const activeBody = {
      description: 'active beacon',
      isLive: true,
      lastUpdateTs: Date.now(),
      timeout: 60_000
    }

    const missingUriWrapper = mountBeacon(activeBody)
    ;(missingUriWrapper.vm as unknown as { handleBeaconClick: () => void }).handleBeaconClick()
    expect(showFeedbackMock).toHaveBeenCalledWith('无法获取位置信息', 'info')

    const invalidUriWrapper = mountBeacon({
      ...activeBody,
      uri: 'invalid-uri'
    })
    ;(invalidUriWrapper.vm as unknown as { handleBeaconClick: () => void }).handleBeaconClick()
    expect(showFeedbackMock).toHaveBeenCalledWith('位置信息格式无效', 'info')
  })

  it('opens external map when beacon data is valid', () => {
    const wrapper = mountBeacon({
      description: 'live beacon',
      isLive: true,
      lastUpdateTs: Date.now(),
      timeout: 60_000,
      uri: 'geo:39.9,116.3'
    })

    ;(wrapper.vm as unknown as { handleBeaconClick: () => void }).handleBeaconClick()

    // OSM 为 WGS-84：URL 收到原始 WGS-84，不调用 wgs84ToGcj02
    expect(wgs84ToGcj02Mock).not.toHaveBeenCalled()
    expect(getOpenStreetMapUrlMock).toHaveBeenCalledWith({
      latitude: 39.9,
      longitude: 116.3,
      timestamp: expect.any(Number)
    })
    expect(openExternalUrlMock).toHaveBeenCalledWith('https://map.example.com')
  })

  it('does not transform coordinates to GCJ-02 for OSM (WGS-84 passthrough)', () => {
    const wrapper = mountBeacon({
      description: 'live beacon',
      isLive: true,
      lastUpdateTs: Date.now(),
      timeout: 60_000,
      uri: 'geo:31.2304,121.4737'
    })

    ;(wrapper.vm as unknown as { handleBeaconClick: () => void }).handleBeaconClick()

    expect(wgs84ToGcj02Mock).not.toHaveBeenCalled()
    expect(getOpenStreetMapUrlMock).toHaveBeenCalledWith({
      latitude: 31.2304,
      longitude: 121.4737,
      timestamp: expect.any(Number)
    })
  })
})
