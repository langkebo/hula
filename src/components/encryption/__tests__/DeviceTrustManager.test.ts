import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeviceTrust } from '@/composables/encryption/useDeviceTrust'
import { createI18nMock } from '~/tests/i18n-messages'
import DeviceTrustManager from '../DeviceTrustManager.vue'

vi.mock('naive-ui', async () => {
  const { defineComponent } = await import('vue')

  return {
    NModal: defineComponent({
      name: 'NModal',
      props: ['show', 'preset', 'title'],
      emits: ['update:show'],
      template: '<div v-if="show"><slot /><slot name="footer" /></div>'
    }),
    NSpin: defineComponent({
      name: 'NSpin',
      props: ['show'],
      template: '<div><slot /></div>'
    }),
    NTabs: defineComponent({
      name: 'NTabs',
      template: '<div><slot /></div>'
    }),
    NTabPane: defineComponent({
      name: 'NTabPane',
      props: ['name', 'tab'],
      template: '<div><slot /></div>'
    }),
    NSelect: defineComponent({
      name: 'NSelect',
      props: ['value', 'options', 'placeholder', 'filterable', 'clearable'],
      emits: ['update:value'],
      template: '<div data-test="room-select" />'
    }),
    NButton: defineComponent({
      name: 'NButton',
      props: ['size', 'type', 'ghost', 'loading'],
      template: '<button type="button"><slot /></button>'
    }),
    NTag: defineComponent({
      name: 'NTag',
      props: ['size', 'type'],
      template: '<span><slot /></span>'
    }),
    NSpace: defineComponent({
      name: 'NSpace',
      props: ['size'],
      template: '<div><slot /></div>'
    }),
    NFlex: defineComponent({
      name: 'NFlex',
      props: ['justify'],
      template: '<div><slot /></div>'
    }),
    NPopconfirm: defineComponent({
      name: 'NPopconfirm',
      emits: ['positive-click'],
      template: '<div><slot name="trigger" /><slot /></div>'
    })
  }
})

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', props: ['icon', 'width'], template: '<i data-test="icon" />' }
}))

vi.mock('vue-i18n', () => createI18nMock())

vi.mock('@/components/encryption/DeviceVerifyDialog.vue', () => ({
  default: { name: 'DeviceVerifyDialog', template: '<div />' }
}))

vi.mock('@/composables/encryption/useDeviceTrust', async () => {
  const { ref } = await import('vue')
  const state = {
    loading: ref(false),
    devices: ref<unknown[]>([]),
    unverifiedDevices: ref<unknown[]>([]),
    blockedDevices: ref<unknown[]>([]),
    error: ref<string | null>(null),
    loadDevices: vi.fn(),
    trustDevice: vi.fn(),
    untrustDevice: vi.fn(),
    blockDevice: vi.fn(),
    unblockDevice: vi.fn(),
    loadUnverifiedDevicesInRoom: vi.fn()
  }
  return { useDeviceTrust: () => state }
})

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

vi.mock('@/services/matrix/crypto/MatrixEncryptionService', () => ({
  matrixEncryptionService: {
    getCurrentDeviceId: () => 'DEV1',
    getClient: () => ({ getUserId: () => '@me:server' })
  }
}))

vi.mock('@/stores/domains/chat/room', () => ({
  useRoomStore: () => ({ roomList: [] })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

interface DeviceTrustState {
  loading: { value: boolean }
  devices: { value: Array<Record<string, unknown>> }
  unverifiedDevices: { value: Array<Record<string, unknown>> }
  blockedDevices: { value: Array<Record<string, unknown>> }
  error: { value: string | null }
  loadDevices: ReturnType<typeof vi.fn>
  loadUnverifiedDevicesInRoom: ReturnType<typeof vi.fn>
}

const trustState = () => useDeviceTrust() as unknown as DeviceTrustState

describe('DeviceTrustManager', () => {
  beforeEach(() => {
    const state = trustState()
    vi.clearAllMocks()
    state.loading.value = false
    state.devices.value = []
    state.unverifiedDevices.value = []
    state.blockedDevices.value = []
    state.error.value = null
  })

  it('设备读取失败时显示加载失败与重试，而不是「暂无设备」', async () => {
    const state = trustState()
    state.loadDevices.mockImplementation(async () => {
      state.error.value = 'device list failed'
      state.devices.value = []
    })

    const wrapper = mount(DeviceTrustManager, { props: { show: false } })
    await wrapper.setProps({ show: true })
    await flushPromises()

    expect(state.loadDevices).toHaveBeenCalledWith('@me:server')
    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.text()).not.toContain('暂无设备')
    const retryButton = wrapper.find('[data-testid="error-retry"]')
    expect(retryButton.exists()).toBe(true)

    state.loadDevices.mockImplementation(async () => {
      state.error.value = null
      state.devices.value = [{ userId: '@me:server', deviceId: 'DEV1', displayName: '我的手机', isVerified: true }]
    })
    await retryButton.trigger('click')
    await flushPromises()

    expect(state.loadDevices).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('我的手机')
    expect(wrapper.find('[data-testid="error-retry"]').exists()).toBe(false)
  })

  it('有缓存设备时保留旧列表，不因刷新失败清空', async () => {
    const state = trustState()
    state.devices.value = [{ userId: '@me:server', deviceId: 'DEV1', displayName: '旧设备', isVerified: true }]
    state.loadDevices.mockImplementation(async () => {
      state.error.value = 'refresh failed'
    })

    const wrapper = mount(DeviceTrustManager, { props: { show: false } })
    await wrapper.setProps({ show: true })
    await flushPromises()

    expect(wrapper.text()).toContain('旧设备')
    expect(wrapper.text()).not.toContain('暂无设备')
  })
})
