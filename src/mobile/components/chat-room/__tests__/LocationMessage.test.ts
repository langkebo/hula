import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

// 地图组件用桩替代，避免引入腾讯静态图代理与 HTTP 客户端
vi.mock('@/components/rightBox/location/StaticProxyMap.vue', () => ({
  default: {
    name: 'StaticProxyMap',
    template: '<div class="static-map-stub" />',
    props: ['location', 'zoom', 'height', 'draggable', 'controls']
  }
}))

vi.mock('@/composables/common/useLinkSegments', () => ({
  openExternalUrl: vi.fn()
}))

vi.mock('@/services/matrix/media/MatrixLocationService', () => ({
  matrixLocationService: {
    getOpenStreetMapUrl: vi.fn(() => 'https://osm.example')
  }
}))

import StaticProxyMap from '@/components/rightBox/location/StaticProxyMap.vue'
import { wgs84ToGcj02 } from '@/utils/CoordinateTransform'

const VanButtonStub = {
  name: 'VanButton',
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
  props: ['loading', 'disabled', 'type', 'size', 'block', 'plain', 'round'],
  emits: ['click']
}

describe('LocationMessage（移动端位置消息渲染）', () => {
  it('渲染标题/地址，并将 WGS-84 转 GCJ-02 后传给地图', async () => {
    const LocationMessage = (await import('../LocationMessage.vue')).default
    const wrapper = mount(LocationMessage, {
      props: {
        body: {
          latitude: '39.9042',
          longitude: '116.4074',
          address: '北京',
          precision: '高精度',
          timestamp: '1700000000000'
        }
      }
    })

    expect(wrapper.text()).toContain('chat.location.title')
    expect(wrapper.text()).toContain('北京')

    const map = wrapper.findComponent(StaticProxyMap)
    expect(map.exists()).toBe(true)

    const expected = wgs84ToGcj02(39.9042, 116.4074)
    const locationProp = map.props('location') as { latitude: number; longitude: number }
    expect(locationProp.latitude).toBeCloseTo(expected.lat, 5)
    expect(locationProp.longitude).toBeCloseTo(expected.lng, 5)
  })

  it('无 body 时显示无法展示占位', async () => {
    const LocationMessage = (await import('../LocationMessage.vue')).default
    const wrapper = mount(LocationMessage, { props: { body: undefined } })

    expect(wrapper.text()).toContain('chat.location.cannot_display')
  })
})

describe('BeaconMessage（移动端实时位置消息渲染）', () => {
  it('实时共享中显示剩余时间与查看按钮', async () => {
    const BeaconMessage = (await import('../BeaconMessage.vue')).default
    const wrapper = mount(BeaconMessage, {
      props: {
        body: {
          description: '一起走',
          timeout: 3600000,
          isLive: true,
          lastUpdateTs: Date.now(),
          uri: 'geo:39.9042,116.4074'
        }
      },
      global: { stubs: { 'van-button': VanButtonStub } }
    })

    expect(wrapper.text()).toContain('chat.beacon.live_location')
    expect(wrapper.text()).toContain('chat.beacon.remaining_time')
    expect(wrapper.text()).toContain('chat.beacon.view_location')
    wrapper.unmount()
  })

  it('已结束的 beacon 显示结束文案', async () => {
    const BeaconMessage = (await import('../BeaconMessage.vue')).default
    const wrapper = mount(BeaconMessage, {
      props: {
        body: { description: '一起走', timeout: 3600000, isLive: false }
      },
      global: { stubs: { 'van-button': VanButtonStub } }
    })

    expect(wrapper.text()).toContain('chat.beacon.ended')
  })
})
