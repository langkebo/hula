import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18nMock } from '~/tests/i18n-messages'
import DeviceVerifyDialog from '../DeviceVerifyDialog.vue'

// 真实语言表驱动：源码引用了不存在的 key 会渲染成裸 key，断言立刻暴露
vi.mock('vue-i18n', () => createI18nMock())

type DeviceVerifyDialogVm = {
  step: 'intro' | 'showKey' | 'success' | 'rejected'
  sasReady: boolean
  sasConfirmed: boolean
  sasEmojis: Array<{ emoji: string; description: string }>
  startVerification: () => Promise<void>
  handleConfirm: () => Promise<void>
  handleReject: () => Promise<void>
  handleClose: () => void
  handleCancel: () => Promise<void>
}

const mocks = vi.hoisted(() => ({
  getCurrentSessionContext: vi.fn(),
  waitForSasView: vi.fn(),
  startSasVerification: vi.fn(),
  acceptVerification: vi.fn(),
  confirmSas: vi.fn(),
  cancelVerification: vi.fn(),
  getPendingVerifications: vi.fn(),
  showFeedback: vi.fn()
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const buttonStub = defineComponent({
    name: 'NButton',
    props: { disabled: { type: Boolean, default: false } },
    emits: ['click'],
    setup(props, { slots, emit }) {
      return () =>
        h('button', { type: 'button', disabled: props.disabled, onClick: () => emit('click') }, slots.default?.())
    }
  })

  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', slots.default?.())
      }
    })

  return {
    NModal: defineComponent({
      name: 'NModal',
      props: {
        show: { type: Boolean, default: false },
        title: { type: String, default: '' }
      },
      emits: ['update:show'],
      setup(props, { slots }) {
        return () => (props.show ? h('div', { 'data-test': 'modal' }, slots.default?.()) : null)
      }
    }),
    NButton: buttonStub,
    NSpin: passthrough('NSpin'),
    NSteps: passthrough('NSteps'),
    NStep: defineComponent({ name: 'NStep', setup: () => () => h('div') }),
    NInput: defineComponent({
      name: 'NInput',
      props: { value: { type: String, default: '' } },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            value: props.value,
            onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
          })
      }
    })
  }
})

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i data-test="icon" />' }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: mocks.showFeedback })
}))

// 注意：这里**不提供** getDeviceFingerprint。若被测代码回退到指纹比对，
// 调用会直接抛 TypeError，测试即失败——这是「不得降级」的机械保证。
vi.mock('@/composables/encryption', () => ({
  useEncryption: () => ({
    getCurrentSessionContext: mocks.getCurrentSessionContext,
    waitForSasView: mocks.waitForSasView,
    startSasVerification: mocks.startSasVerification,
    acceptVerification: mocks.acceptVerification,
    confirmSas: mocks.confirmSas,
    cancelVerification: mocks.cancelVerification,
    getPendingVerifications: mocks.getPendingVerifications
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

const SAS_VIEW = {
  emoji: [
    ['🐶', 'Dog'],
    ['🐱', 'Cat'],
    ['🦊', 'Fox']
  ] as Array<readonly [string, string]>,
  decimal: [1234, 5678, 9012]
}

const mountComponent = (props?: Record<string, unknown>) =>
  mount(DeviceVerifyDialog, { props: { show: true, ...props } })

const vmOf = (wrapper: ReturnType<typeof mountComponent>) => wrapper.vm as unknown as DeviceVerifyDialogVm

describe('DeviceVerifyDialog（SAS 比对）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentSessionContext.mockReturnValue({
      userId: '@alice:example.com',
      deviceId: 'CURRENT_DEVICE',
      isCryptoEnabled: true
    })
    mocks.waitForSasView.mockResolvedValue(SAS_VIEW)
    mocks.startSasVerification.mockResolvedValue('txn-123')
    mocks.acceptVerification.mockResolvedValue(undefined)
    mocks.confirmSas.mockResolvedValue(undefined)
    mocks.cancelVerification.mockResolvedValue(undefined)
    mocks.getPendingVerifications.mockResolvedValue([])
  })

  it('发起验证后等待并载入真实 SAS（emoji + decimal）', async () => {
    const wrapper = mountComponent({ deviceId: 'OTHER_DEVICE', deviceName: 'Alice iPhone' })
    await flushPromises()

    await vmOf(wrapper).startVerification()

    expect(mocks.startSasVerification).toHaveBeenCalledWith('@alice:example.com', 'OTHER_DEVICE')
    expect(mocks.waitForSasView).toHaveBeenCalledWith('txn-123', expect.any(Object))
    expect(vmOf(wrapper).step).toBe('showKey')
    expect(vmOf(wrapper).sasReady).toBe(true)
    expect(vmOf(wrapper).sasEmojis).toEqual([
      { emoji: '🐶', description: 'Dog' },
      { emoji: '🐱', description: 'Cat' },
      { emoji: '🦊', description: 'Fox' }
    ])
    expect(wrapper.text()).toContain('Dog')
    expect(wrapper.text()).toContain('1234 5678 9012')
  })

  it('SAS 未就绪时只显示等待态，且不渲染可确认内容', async () => {
    mocks.waitForSasView.mockResolvedValue(new Promise(() => {}))
    const wrapper = mountComponent({ deviceId: 'OTHER_DEVICE' })
    await flushPromises()

    // 不 await：模拟「对方尚未接受」，此时必须停在等待态
    void vmOf(wrapper).startVerification()
    await flushPromises()

    expect(vmOf(wrapper).step).toBe('showKey')
    expect(vmOf(wrapper).sasReady).toBe(false)
    expect(wrapper.text()).toContain('等待对方接受验证')
    expect(wrapper.find('[data-testid="sas-confirm-checkbox"]').exists()).toBe(false)
  })

  it('未勾选「emoji 一致」时 confirm 不调用 confirmSas（假安全信号回归）', async () => {
    const wrapper = mountComponent({ deviceId: 'OTHER_DEVICE' })
    await flushPromises()
    await vmOf(wrapper).startVerification()

    await vmOf(wrapper).handleConfirm()

    expect(mocks.confirmSas).not.toHaveBeenCalled()
    expect(vmOf(wrapper).step).toBe('showKey')
    expect(wrapper.emitted('success')).toBeFalsy()
  })

  it('勾选后确认才真正调用 confirmSas 并发成功事件', async () => {
    const wrapper = mountComponent({ deviceId: 'OTHER_DEVICE' })
    await flushPromises()
    await vmOf(wrapper).startVerification()

    const checkbox = wrapper.find('[data-testid="sas-confirm-checkbox"]')
    expect(checkbox.exists()).toBe(true)
    await checkbox.setValue(true)
    expect(vmOf(wrapper).sasConfirmed).toBe(true)

    await vmOf(wrapper).handleConfirm()

    expect(mocks.confirmSas).toHaveBeenCalledWith('txn-123')
    expect(vmOf(wrapper).step).toBe('success')
    expect(wrapper.emitted('success')).toBeTruthy()
  })

  it('拿不到 SAS 时进入失败态，绝不降级为指纹比对', async () => {
    mocks.waitForSasView.mockRejectedValue(new Error('no SAS yet'))
    const wrapper = mountComponent({ deviceId: 'OTHER_DEVICE' })
    await flushPromises()

    await vmOf(wrapper).startVerification()

    expect(vmOf(wrapper).step).toBe('rejected')
    expect(vmOf(wrapper).sasReady).toBe(false)
    expect(mocks.confirmSas).not.toHaveBeenCalled()
    // 失败态下不能再确认
    await vmOf(wrapper).handleConfirm()
    expect(mocks.confirmSas).not.toHaveBeenCalled()
  })

  it('接受入站请求后同样要等 SAS 就绪', async () => {
    const wrapper = mountComponent({
      inboundRequest: {
        transactionId: 'txn-inbound',
        userId: '@alice:example.com',
        deviceId: 'OTHER_DEVICE',
        methods: ['m.sas.v1'],
        timestamp: Date.now()
      }
    })
    await flushPromises()

    await vmOf(wrapper).startVerification()

    expect(mocks.acceptVerification).toHaveBeenCalledWith('txn-inbound')
    expect(mocks.waitForSasView).toHaveBeenCalledWith('txn-inbound', expect.any(Object))
    expect(mocks.startSasVerification).not.toHaveBeenCalled()
    expect(vmOf(wrapper).sasReady).toBe(true)
  })

  it('确认匹配后发出成功事件', async () => {
    const wrapper = mountComponent({ deviceId: 'OTHER_DEVICE' })
    await flushPromises()
    await vmOf(wrapper).startVerification()
    await vmOf(wrapper).handleConfirm()
    // 未勾选 → 上面那次不生效；勾选后重试
    await wrapper.find('[data-testid="sas-confirm-checkbox"]').setValue(true)
    await vmOf(wrapper).handleConfirm()

    expect(wrapper.emitted('success')).toBeTruthy()
    expect(vmOf(wrapper).step).toBe('success')
  })

  it('拒绝或取消验证时会调用取消接口', async () => {
    const wrapper = mountComponent({ deviceId: 'OTHER_DEVICE' })
    await flushPromises()
    await vmOf(wrapper).startVerification()

    await vmOf(wrapper).handleReject()
    expect(mocks.cancelVerification).toHaveBeenCalledWith('txn-123', 'User rejected verification')
    expect(vmOf(wrapper).step).toBe('rejected')

    await vmOf(wrapper).handleCancel()
    expect(mocks.cancelVerification).toHaveBeenCalledWith('txn-123', 'User cancelled verification')
    expect(wrapper.emitted('update:show')).toContainEqual([false])
  })

  it('缺少会话上下文时给出错误反馈且不进入比对', async () => {
    mocks.getCurrentSessionContext.mockReturnValue({
      userId: null,
      deviceId: null,
      isCryptoEnabled: true
    })

    const wrapper = mountComponent()
    await flushPromises()
    await vmOf(wrapper).startVerification()

    expect(mocks.showFeedback).toHaveBeenCalledWith('获取设备密钥失败', 'error')
    expect(vmOf(wrapper).step).toBe('rejected')
  })
})
