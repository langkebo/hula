import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RtcTransportsPanel from '../RtcTransportsPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const getRtcTransportsMock = vi.fn()

vi.mock('@/services/matrix/media/MatrixVoiceService', () => ({
  matrixVoiceService: {
    getRtcTransports: (...args: unknown[]) => getRtcTransportsMock(...args)
  }
}))

const naiveStubs = {
  Card: {
    template:
      '<div class="n-card"><div class="n-card-header"><slot name="header" /></div><div class="n-card-body"><slot /></div></div>',
    props: ['size', 'bordered']
  },
  Spin: { template: '<div class="n-spin"><slot /></div>', props: ['size', 'show'] },
  Empty: { template: '<div class="n-empty"><slot /></div>', props: ['description', 'size'] },
  Tag: { template: '<span class="n-tag"><slot /></span>', props: ['type', 'size', 'round'] }
}

describe('RtcTransportsPanel — P2-7 RTC 传输协议信息面板', () => {
  beforeEach(() => {
    getRtcTransportsMock.mockReset()
  })

  const mountPanel = async () => {
    const wrapper = mount(RtcTransportsPanel, {
      global: { stubs: naiveStubs }
    })
    await Promise.resolve()
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it('挂载时调用 getRtcTransports 加载传输协议', async () => {
    getRtcTransportsMock.mockResolvedValue({ transports: [] })
    await mountPanel()
    expect(getRtcTransportsMock).toHaveBeenCalled()
  })

  it('加载中显示 loading 状态', () => {
    getRtcTransportsMock.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(RtcTransportsPanel, {
      global: { stubs: naiveStubs }
    })
    expect(wrapper.find('.n-spin').exists()).toBe(true)
  })

  it('空列表显示空状态提示', async () => {
    getRtcTransportsMock.mockResolvedValue({ transports: [] })
    const wrapper = await mountPanel()
    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })

  it('渲染 RTC 传输协议列表', async () => {
    getRtcTransportsMock.mockResolvedValue({
      transports: [
        { transport: 'webrtc', version: '1.0' },
        { transport: 'livekit', version: '0.2' }
      ]
    })
    const wrapper = await mountPanel()
    const items = wrapper.findAll('.rtc-transport-item')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('webrtc')
    expect(wrapper.text()).toContain('livekit')
  })
})
