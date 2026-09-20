import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DeviceVerifyDialog from '../DeviceVerifyDialog.vue'

/**
 * DeviceVerifyDialog 跨用户验证路径
 *
 * 覆盖：
 * - `userId` prop 决定 targetUserId；跨用户时去拉取对方设备列表
 * - 跨用户时**不得**把本机 deviceId 兜底成目标设备（否则发出 (对方, 我的设备) 无效事务）
 * - 未选设备时 startVerification 必须被阻断，不得发起空 deviceId 请求
 * - 自验证（不传 userId）行为与历史一致：不拉设备列表、回退会话 deviceId
 * - 入站请求的 userId/deviceId 优先于 userId prop
 *
 * 不覆盖：对话框渲染细节（DeviceVerifyDialog.test.ts）、SAS 状态机分支
 */

type DialogVm = {
  step: string
  targetUserId: string
  targetDeviceId: string
  targetDevices: Array<{ deviceId: string; displayName?: string }>
  isVerifyingOtherUser: boolean
  startVerification: () => Promise<void>
}

const {
  getCurrentSessionContextMock,
  getDeviceFingerprintMock,
  startSasVerificationMock,
  acceptVerificationMock,
  getPendingVerificationsMock,
  getUserDevicesMock,
  showFeedbackMock
} = vi.hoisted(() => ({
  getCurrentSessionContextMock: vi.fn(),
  getDeviceFingerprintMock: vi.fn(),
  startSasVerificationMock: vi.fn(),
  acceptVerificationMock: vi.fn(),
  getPendingVerificationsMock: vi.fn(),
  getUserDevicesMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    NModal: defineComponent({
      name: 'NModal',
      props: { show: { type: Boolean, default: false } },
      emits: ['update:show'],
      setup(props, { slots }) {
        return () => (props.show ? h('div', { 'data-test': 'modal' }, slots.default?.()) : null)
      }
    }),
    NSpin: defineComponent({
      name: 'NSpin',
      props: { show: { type: Boolean, default: false } },
      setup(_, { slots }) {
        return () => h('div', slots.default?.())
      }
    }),
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NSteps: defineComponent({
      name: 'NSteps',
      setup(_, { slots }) {
        return () => h('div', slots.default?.())
      }
    }),
    NStep: defineComponent({ name: 'NStep', setup: () => () => h('div') }),
    NList: defineComponent({
      name: 'NList',
      setup(_, { slots }) {
        return () => h('div', slots.default?.())
      }
    }),
    NListItem: defineComponent({
      name: 'NListItem',
      setup(_, { slots }) {
        return () => h('div', slots.default?.())
      }
    }),
    NSpace: defineComponent({
      name: 'NSpace',
      setup(_, { slots }) {
        return () => h('div', slots.default?.())
      }
    }),
    // 渲染成真实 <select> 以便用 DOM 事件驱动 v-model 全链路
    NSelect: defineComponent({
      name: 'NSelect',
      props: {
        value: { type: String, default: null },
        options: { type: Array, default: () => [] },
        placeholder: { type: String, default: '' }
      },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h(
            'select',
            {
              value: props.value ?? '',
              onChange: (event: Event) => emit('update:value', (event.target as HTMLSelectElement).value)
            },
            (props.options as Array<{ label: string; value: string }>).map((option) =>
              h('option', { key: option.value, value: option.value }, option.label)
            )
          )
      }
    }),
    NQrCode: defineComponent({
      name: 'NQrCode',
      props: { value: { type: String, default: '' } },
      setup(props) {
        return () => h('div', props.value)
      }
    })
  }
})

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />' }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/composables/encryption', () => ({
  useEncryption: () => ({
    getCurrentSessionContext: getCurrentSessionContextMock,
    getDeviceFingerprint: getDeviceFingerprintMock,
    startSasVerification: startSasVerificationMock,
    acceptVerification: acceptVerificationMock,
    getPendingVerifications: getPendingVerificationsMock
  })
}))

vi.mock('@/services/matrix/user/MatrixDeviceService', () => ({
  matrixDeviceService: {
    getUserDevices: getUserDevicesMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'setting.encryption.device_verify_dialog.select_device_required': '请先选择要验证的设备',
        'setting.encryption.device_verify_dialog.select_device_label': '选择要验证的设备',
        'setting.encryption.device_verify_dialog.select_device_placeholder': '请选择设备',
        'setting.encryption.device_verify_dialog.no_device_available': '该用户暂无可验证的设备',
        'setting.encryption.device_verify_dialog.verify_user_label': '目标用户'
      }
      return map[key] ?? key
    }
  })
}))

const SELF_USER = '@alice:example.com'
const SELF_DEVICE = 'CURRENT_DEVICE'
const PEER_USER = '@bob:example.com'

const mountDialog = (props: Record<string, unknown> = {}) =>
  mount(DeviceVerifyDialog, { props: { show: true, ...props } })

const vmOf = (wrapper: ReturnType<typeof mountDialog>) => wrapper.vm as unknown as DialogVm

describe('DeviceVerifyDialog 跨用户验证', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getCurrentSessionContextMock.mockReturnValue({
      userId: SELF_USER,
      deviceId: SELF_DEVICE,
      isCryptoEnabled: true
    })
    getDeviceFingerprintMock.mockResolvedValue('ABCD1234EFGH5678')
    startSasVerificationMock.mockResolvedValue('txn-123')
    acceptVerificationMock.mockResolvedValue(undefined)
    getPendingVerificationsMock.mockResolvedValue([])
    getUserDevicesMock.mockResolvedValue([
      { device_id: 'BOB_PHONE', display_name: 'Bob Phone' },
      { device_id: 'BOB_DESKTOP', display_name: 'Bob Desktop' }
    ])
  })

  it('传入 userId 时标记为跨用户验证并拉取对方设备列表', async () => {
    const wrapper = mountDialog({ userId: PEER_USER })
    await flushPromises()

    expect(vmOf(wrapper).isVerifyingOtherUser).toBe(true)
    expect(vmOf(wrapper).targetUserId).toBe(PEER_USER)
    expect(getUserDevicesMock).toHaveBeenCalledWith(PEER_USER)
    expect(vmOf(wrapper).targetDevices).toEqual([
      { deviceId: 'BOB_PHONE', displayName: 'Bob Phone' },
      { deviceId: 'BOB_DESKTOP', displayName: 'Bob Desktop' }
    ])
  })

  it('跨用户时不得把本机 deviceId 当作目标设备', async () => {
    const wrapper = mountDialog({ userId: PEER_USER })
    await flushPromises()

    // 关键回归点：历史实现会兜底成会话 deviceId，拼出 (对方 userId, 我的 deviceId)
    expect(vmOf(wrapper).targetDeviceId).toBe('')
  })

  it('对方只有一台设备时自动选中，省掉一次无意义选择', async () => {
    getUserDevicesMock.mockResolvedValue([{ device_id: 'BOB_PHONE', display_name: 'Bob Phone' }])

    const wrapper = mountDialog({ userId: PEER_USER })
    await flushPromises()

    expect(vmOf(wrapper).targetDeviceId).toBe('BOB_PHONE')

    await vmOf(wrapper).startVerification()

    expect(startSasVerificationMock).toHaveBeenCalledWith(PEER_USER, 'BOB_PHONE')
    expect(getDeviceFingerprintMock).toHaveBeenCalledWith(PEER_USER, 'BOB_PHONE')
  })

  it('对方多台设备且未选择时阻断发起，避免空 deviceId 请求', async () => {
    const wrapper = mountDialog({ userId: PEER_USER })
    await flushPromises()

    await vmOf(wrapper).startVerification()

    expect(startSasVerificationMock).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('请先选择要验证的设备', 'warning')
    expect(vmOf(wrapper).step).toBe('intro')
  })

  it('通过设备选择器选中后可正常发起，并对该设备取指纹', async () => {
    const wrapper = mountDialog({ userId: PEER_USER })
    await flushPromises()

    const select = wrapper.find('[data-testid="device-verify-device-select"]')
    expect(select.exists()).toBe(true)

    await select.setValue('BOB_DESKTOP')
    expect(vmOf(wrapper).targetDeviceId).toBe('BOB_DESKTOP')

    await vmOf(wrapper).startVerification()

    expect(startSasVerificationMock).toHaveBeenCalledWith(PEER_USER, 'BOB_DESKTOP')
    expect(getDeviceFingerprintMock).toHaveBeenCalledWith(PEER_USER, 'BOB_DESKTOP')
    expect(vmOf(wrapper).step).toBe('showKey')
  })

  it('对方无设备时给出提示且不渲染选择器', async () => {
    getUserDevicesMock.mockResolvedValue([])

    const wrapper = mountDialog({ userId: PEER_USER })
    await flushPromises()

    expect(wrapper.find('[data-testid="device-verify-device-select"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('该用户暂无可验证的设备')
  })

  it('不传 userId 时行为与历史一致：不拉设备列表、回退会话 deviceId', async () => {
    const wrapper = mountDialog()
    await flushPromises()

    expect(vmOf(wrapper).isVerifyingOtherUser).toBe(false)
    expect(getUserDevicesMock).not.toHaveBeenCalled()
    expect(vmOf(wrapper).targetUserId).toBe(SELF_USER)
    expect(vmOf(wrapper).targetDeviceId).toBe(SELF_DEVICE)
    expect(wrapper.find('[data-testid="device-verify-device-select"]').exists()).toBe(false)
  })

  it('入站请求的 userId/deviceId 优先于 userId prop', async () => {
    const wrapper = mountDialog({
      userId: PEER_USER,
      inboundRequest: {
        transactionId: 'txn-inbound',
        userId: '@carol:example.com',
        deviceId: 'CAROL_TABLET',
        methods: ['m.sas.v1'],
        timestamp: Date.now()
      }
    })
    await flushPromises()

    expect(vmOf(wrapper).targetUserId).toBe('@carol:example.com')
    expect(vmOf(wrapper).targetDeviceId).toBe('CAROL_TABLET')

    await vmOf(wrapper).startVerification()

    expect(acceptVerificationMock).toHaveBeenCalledWith('txn-inbound')
    expect(startSasVerificationMock).not.toHaveBeenCalled()
  })
})
