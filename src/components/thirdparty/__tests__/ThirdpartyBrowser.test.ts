import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ThirdpartyBrowser from '../ThirdpartyBrowser.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const getProtocolsMock = vi.fn()
const getLocationMock = vi.fn()
const getUserMock = vi.fn()

vi.mock('@/services/matrix/SynapseRustExtensionsService', () => ({
  synapseRustExtensionsService: {
    getThirdpartyProtocols: (...args: unknown[]) => getProtocolsMock(...args),
    getThirdpartyLocation: (...args: unknown[]) => getLocationMock(...args),
    getThirdpartyUser: (...args: unknown[]) => getUserMock(...args)
  }
}))

const naiveStubs = {
  Card: {
    template:
      '<div class="n-card"><div class="n-card-header">{{ title }}</div><div class="n-card-body"><slot /></div></div>',
    props: ['title', 'size', 'bordered']
  },
  Spin: { template: '<div class="n-spin"><slot /></div>', props: ['size', 'show'] },
  Empty: { template: '<div class="n-empty">{{ description }}</div>', props: ['description', 'size'] },
  Select: {
    template:
      '<select class="n-select" v-bind="$attrs" :value="value" @change="$emit(\'update:value\', $event.target.value)"><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>',
    props: ['value', 'options', 'placeholder', 'disabled'],
    emits: ['update:value']
  },
  Button: {
    template: '<button class="n-button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled', 'loading', 'type', 'size'],
    emits: ['click']
  },
  Tag: { template: '<span class="n-tag"><slot /></span>', props: ['type', 'size'] },
  Input: {
    template:
      '<input class="n-input" v-bind="$attrs" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
    props: ['value', 'placeholder'],
    emits: ['update:value']
  }
}

const sampleProtocols = {
  telegram: { location_fields: ['channel'], user_fields: ['username'] },
  irc: { location_fields: ['network', 'channel'], user_fields: ['nick'] }
}

describe('ThirdpartyBrowser — P2-5 第三方协议浏览', () => {
  beforeEach(() => {
    getProtocolsMock.mockReset()
    getLocationMock.mockReset()
    getUserMock.mockReset()
  })

  const mountBrowser = () =>
    mount(ThirdpartyBrowser, {
      global: { stubs: naiveStubs }
    })

  it('挂载时加载协议列表', async () => {
    getProtocolsMock.mockResolvedValue(sampleProtocols)

    const wrapper = mountBrowser()
    await flushPromises()

    expect(getProtocolsMock).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="thirdparty-browser"]').exists()).toBe(true)
  })

  it('显示协议列表选项', async () => {
    getProtocolsMock.mockResolvedValue(sampleProtocols)

    const wrapper = mountBrowser()
    await flushPromises()

    const select = wrapper.find('[data-testid="protocol-select"]')
    expect(select.exists()).toBe(true)
    const options = select.findAll('option')
    expect(options.length).toBeGreaterThanOrEqual(2)
  })

  it('选择协议并查询位置调用 getThirdpartyLocation', async () => {
    getProtocolsMock.mockResolvedValue(sampleProtocols)
    getLocationMock.mockResolvedValue([{ alias: '#chan', protocol: 'irc' }])

    const wrapper = mountBrowser()
    await flushPromises()

    await wrapper.find('[data-testid="protocol-select"]').setValue('irc')
    await wrapper.find('[data-testid="query-location-btn"]').trigger('click')
    await flushPromises()

    expect(getLocationMock).toHaveBeenCalledWith('irc', expect.anything())
    expect(wrapper.find('[data-testid="location-results"]').exists()).toBe(true)
  })

  it('选择协议并查询用户调用 getThirdpartyUser', async () => {
    getProtocolsMock.mockResolvedValue(sampleProtocols)
    getUserMock.mockResolvedValue([{ userid: '@alice', protocol: 'irc' }])

    const wrapper = mountBrowser()
    await flushPromises()

    await wrapper.find('[data-testid="protocol-select"]').setValue('irc')
    await wrapper.find('[data-testid="query-user-btn"]').trigger('click')
    await flushPromises()

    expect(getUserMock).toHaveBeenCalledWith('irc', expect.anything())
    expect(wrapper.find('[data-testid="user-results"]').exists()).toBe(true)
  })

  it('协议列表为空时显示空状态', async () => {
    getProtocolsMock.mockResolvedValue({})

    const wrapper = mountBrowser()
    await flushPromises()

    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })
})
