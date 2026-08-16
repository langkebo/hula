import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LocationMessage from '../Location.vue'

const { wgs84ToGcj02Mock, staticMapLocationMock, isWindowsMock } = vi.hoisted(() => ({
  wgs84ToGcj02Mock: vi.fn(),
  staticMapLocationMock: vi.fn(),
  isWindowsMock: vi.fn(() => false)
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/utils/CoordinateTransform', () => ({
  wgs84ToGcj02: wgs84ToGcj02Mock
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isWindows: isWindowsMock
}))

vi.mock('@/components/rightBox/location/StaticProxyMap.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'StaticProxyMap',
      props: ['location', 'zoom', 'height', 'draggable', 'controls'],
      setup(props) {
        staticMapLocationMock(props.location)
        return () => h('div', { 'data-test': 'static-map' })
      }
    })
  }
})

vi.mock('@/components/rightBox/location/LocationModal.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'LocationModal',
      props: ['show'],
      emits: ['update:show', 'location-selected', 'cancel'],
      setup() {
        return () => h('div', { 'data-test': 'location-modal' })
      }
    })
  }
})

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    NFlex: defineComponent({
      name: 'NFlex',
      setup(_, { slots }) {
        return () => h('div', slots.default?.())
      }
    })
  }
})

describe('renderMessage/Location', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('converts received WGS-84 to GCJ-02 before rendering the static map', () => {
    wgs84ToGcj02Mock.mockImplementation((lat: number, lng: number) => ({ lat: lat + 0.01, lng: lng + 0.01 }))

    mount(LocationMessage, {
      props: {
        body: {
          latitude: '39.9042',
          longitude: '116.4074',
          address: 'Beijing',
          precision: '高精度',
          timestamp: '1700000000000'
        }
      }
    })

    // 收到的坐标是 WGS-84
    expect(wgs84ToGcj02Mock).toHaveBeenCalledWith(39.9042, 116.4074)
    // 地图显示收到 GCJ-02 转换后的坐标
    expect(staticMapLocationMock).toHaveBeenCalledWith({
      latitude: 39.9142,
      longitude: 116.4174,
      address: 'Beijing',
      timestamp: 1700000000000
    })
  })
})
