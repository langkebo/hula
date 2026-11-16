import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ThreePidSection from '../ThreePidSection.vue'

const {
  getThreePidsMock,
  requestThreePidEmailTokenMock,
  submitThreePidEmailTokenMock,
  addThreePidWithPasswordMock,
  deleteThreePidMock,
  showFeedbackMock,
  reportFailureMock,
  dialogWarningMock
} = vi.hoisted(() => ({
  getThreePidsMock: vi.fn(),
  requestThreePidEmailTokenMock: vi.fn(),
  submitThreePidEmailTokenMock: vi.fn(),
  addThreePidWithPasswordMock: vi.fn(),
  deleteThreePidMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  reportFailureMock: vi.fn(),
  dialogWarningMock: vi.fn()
}))

vi.mock('@/services/matrix', () => ({
  matrixAccountService: {
    getThreePids: () => getThreePidsMock(),
    requestThreePidEmailToken: (...args: unknown[]) => requestThreePidEmailTokenMock(...args),
    submitThreePidEmailToken: (...args: unknown[]) => submitThreePidEmailTokenMock(...args),
    addThreePidWithPassword: (...args: unknown[]) => addThreePidWithPasswordMock(...args),
    deleteThreePid: (...args: unknown[]) => deleteThreePidMock(...args)
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/composables/common/useOperationFeedback', () => ({
  useOperationFeedback: () => ({ reportFailure: reportFailureMock })
}))

vi.mock('@iconify/vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    Icon: defineComponent({
      name: 'Icon',
      props: { icon: { type: String, default: '' }, width: { type: Number, default: 16 } },
      setup(props) {
        return () => h('i', { 'data-test': 'Icon', 'data-icon': props.icon })
      }
    })
  }
})

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string, props: string[] = []) =>
    defineComponent({
      name,
      props,
      setup(_, { slots, attrs }) {
        return () => h('div', { ...attrs, 'data-test': name }, slots.default?.())
      }
    })

  return {
    useDialog: () => ({ warning: dialogWarningMock }),
    NButton: defineComponent({
      name: 'NButton',
      props: {
        loading: { type: Boolean, default: false },
        size: String,
        type: String,
        secondary: Boolean,
        quaternary: Boolean
      },
      emits: ['click'],
      setup(_, { slots, emit, attrs }) {
        return () => h('button', { ...attrs, type: 'button', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: { type: String, default: '' },
        disabled: { type: Boolean, default: false },
        placeholder: String,
        type: String
      },
      emits: ['update:value'],
      setup(props, { emit, attrs }) {
        return () =>
          h('input', {
            ...attrs,
            value: props.value,
            disabled: props.disabled,
            placeholder: props.placeholder,
            onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
          })
      }
    }),
    NModal: defineComponent({
      name: 'NModal',
      props: { show: { type: Boolean, default: false }, title: String, preset: String, maskClosable: Boolean },
      emits: ['update:show'],
      setup(props, { slots }) {
        return () => (props.show ? h('div', { 'data-test': 'NModal' }, [slots.default?.(), slots.footer?.()]) : null)
      }
    }),
    NSpin: passthrough('NSpin', ['size']),
    NEmpty: passthrough('NEmpty', ['description', 'size'])
  }
})

function mountSection() {
  return mount(ThreePidSection, {
    global: {
      plugins: [createPinia()]
    }
  })
}

describe('ThreePidSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getThreePidsMock.mockResolvedValue({ threepids: [], pending3pids: [] })
    requestThreePidEmailTokenMock.mockResolvedValue({
      sid: 'sid-1',
      clientSecret: 'secret',
      submitUrl: null
    })
    submitThreePidEmailTokenMock.mockResolvedValue(undefined)
    addThreePidWithPasswordMock.mockResolvedValue(undefined)
    deleteThreePidMock.mockResolvedValue(undefined)
  })

  it('挂载后加载并展示已绑定 3PID（地址 + 类型 + 验证状态）', async () => {
    getThreePidsMock.mockResolvedValue({
      threepids: [{ medium: 'email', address: 'alice@example.com', validated: true, addedAt: 1, validatedAt: 2 }],
      pending3pids: []
    })

    const wrapper = mountSection()
    await flushPromises()

    expect(getThreePidsMock).toHaveBeenCalledTimes(1)
    const item = wrapper.find('[data-test="three-pid-item-alice@example.com"]')
    expect(item.exists()).toBe(true)
    expect(item.text()).toContain('alice@example.com')
    expect(item.text()).toContain('setting.security.three_pid_email')
    expect(item.text()).toContain('setting.security.three_pid_validated')
  })

  it('未绑定任何 3PID 时展示空状态', async () => {
    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.find('[data-test="three-pid-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="three-pid-list"]').exists()).toBe(false)
  })

  it('加载失败时降级为空列表并上报错误', async () => {
    getThreePidsMock.mockRejectedValue(new Error('offline'))

    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.find('[data-test="three-pid-empty"]').exists()).toBe(true)
    expect(reportFailureMock).toHaveBeenCalledWith(expect.any(Error), 'setting.security.three_pid_load_failed')
  })

  it('解绑需二次确认，确认后调用服务并移除条目', async () => {
    getThreePidsMock.mockResolvedValue({
      threepids: [{ medium: 'email', address: 'alice@example.com', validated: true, addedAt: 1, validatedAt: 2 }],
      pending3pids: []
    })

    const wrapper = mountSection()
    await flushPromises()

    await wrapper.find('[data-test="three-pid-unbind-alice@example.com"]').trigger('click')

    expect(dialogWarningMock).toHaveBeenCalledTimes(1)
    expect(deleteThreePidMock).not.toHaveBeenCalled()

    const options = dialogWarningMock.mock.calls[0][0] as { onPositiveClick: () => Promise<void> }
    await options.onPositiveClick()
    await flushPromises()

    expect(deleteThreePidMock).toHaveBeenCalledWith('email', 'alice@example.com')
    expect(wrapper.find('[data-test="three-pid-item-alice@example.com"]').exists()).toBe(false)
    expect(showFeedbackMock).toHaveBeenCalledWith('setting.security.three_pid_unbind_success', 'success')
  })

  it('解绑失败时保留条目并上报错误', async () => {
    getThreePidsMock.mockResolvedValue({
      threepids: [{ medium: 'email', address: 'alice@example.com', validated: true, addedAt: 1, validatedAt: 2 }],
      pending3pids: []
    })
    deleteThreePidMock.mockRejectedValue(new Error('M_UNAUTHORIZED'))

    const wrapper = mountSection()
    await flushPromises()

    await wrapper.find('[data-test="three-pid-unbind-alice@example.com"]').trigger('click')
    const options = dialogWarningMock.mock.calls[0][0] as { onPositiveClick: () => Promise<void> }
    await options.onPositiveClick()
    await flushPromises()

    expect(wrapper.find('[data-test="three-pid-item-alice@example.com"]').exists()).toBe(true)
    expect(reportFailureMock).toHaveBeenCalledWith(expect.any(Error), 'setting.security.three_pid_unbind_failed')
  })

  it('邮箱格式非法时不调用服务并提示错误', async () => {
    const wrapper = mountSection()
    await flushPromises()

    await wrapper.find('[data-test="three-pid-add"]').trigger('click')
    await wrapper.find('[data-test="three-pid-email-input"]').setValue('not-an-email')
    await wrapper.find('[data-test="three-pid-password-input"]').setValue('pwd')
    await wrapper.find('[data-test="three-pid-send-code"]').trigger('click')
    await flushPromises()

    expect(requestThreePidEmailTokenMock).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="three-pid-form-error"]').text()).toContain(
      'setting.security.three_pid_invalid_email'
    )
  })

  it('发送验证码成功后进入验证码输入步骤', async () => {
    const wrapper = mountSection()
    await flushPromises()

    await wrapper.find('[data-test="three-pid-add"]').trigger('click')
    await wrapper.find('[data-test="three-pid-email-input"]').setValue('alice@example.com')
    await wrapper.find('[data-test="three-pid-password-input"]').setValue('pwd')
    await wrapper.find('[data-test="three-pid-send-code"]').trigger('click')
    await flushPromises()

    expect(requestThreePidEmailTokenMock).toHaveBeenCalledWith('alice@example.com')
    expect(wrapper.find('[data-test="three-pid-token-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="three-pid-bind"]').exists()).toBe(true)
  })

  it('验证码为空时提交被拦截', async () => {
    const wrapper = mountSection()
    await flushPromises()

    await wrapper.find('[data-test="three-pid-add"]').trigger('click')
    await wrapper.find('[data-test="three-pid-email-input"]').setValue('alice@example.com')
    await wrapper.find('[data-test="three-pid-password-input"]').setValue('pwd')
    await wrapper.find('[data-test="three-pid-send-code"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-test="three-pid-bind"]').trigger('click')
    await flushPromises()

    expect(submitThreePidEmailTokenMock).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="three-pid-form-error"]').text()).toContain(
      'setting.security.three_pid_code_required'
    )
  })

  it('提交验证码并完成绑定后刷新列表并提示成功', async () => {
    const wrapper = mountSection()
    await flushPromises()

    getThreePidsMock.mockResolvedValue({
      threepids: [{ medium: 'email', address: 'alice@example.com', validated: true, addedAt: 1, validatedAt: 2 }],
      pending3pids: []
    })

    await wrapper.find('[data-test="three-pid-add"]').trigger('click')
    await wrapper.find('[data-test="three-pid-email-input"]').setValue('alice@example.com')
    await wrapper.find('[data-test="three-pid-password-input"]').setValue('pwd')
    await wrapper.find('[data-test="three-pid-send-code"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-test="three-pid-token-input"]').setValue('123456')
    await wrapper.find('[data-test="three-pid-bind"]').trigger('click')
    await flushPromises()

    expect(submitThreePidEmailTokenMock).toHaveBeenCalledWith('sid-1', 'secret', '123456')
    expect(addThreePidWithPasswordMock).toHaveBeenCalledWith('sid-1', 'secret', 'pwd')
    expect(getThreePidsMock).toHaveBeenCalledTimes(2)
    expect(showFeedbackMock).toHaveBeenCalledWith('setting.security.three_pid_bind_success', 'success')
    expect(wrapper.find('[data-test="three-pid-dialog"]').exists()).toBe(false)
  })

  it('绑定失败时保留弹窗并提示错误', async () => {
    const wrapper = mountSection()
    await flushPromises()

    addThreePidWithPasswordMock.mockRejectedValue(new Error('M_THREEPID_AUTH_FAILED'))

    await wrapper.find('[data-test="three-pid-add"]').trigger('click')
    await wrapper.find('[data-test="three-pid-email-input"]').setValue('alice@example.com')
    await wrapper.find('[data-test="three-pid-password-input"]').setValue('pwd')
    await wrapper.find('[data-test="three-pid-send-code"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-test="three-pid-token-input"]').setValue('123456')
    await wrapper.find('[data-test="three-pid-bind"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="three-pid-dialog"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="three-pid-form-error"]').text()).toContain(
      'setting.security.three_pid_bind_failed'
    )
    expect(reportFailureMock).toHaveBeenCalledWith(expect.any(Error), 'setting.security.three_pid_bind_failed')
  })
})
