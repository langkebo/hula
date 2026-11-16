import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import AdminUserActionsPane from '../AdminUserActionsPane.vue'

const { showFeedbackMock, dialogWarningMock, handleAdminErrorMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  dialogWarningMock: vi.fn(),
  handleAdminErrorMock: vi.fn().mockReturnValue(true)
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('../useAdminError', () => ({
  useAdminErrorHandler: () => ({ handleAdminError: handleAdminErrorMock })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string) =>
    defineComponent({
      name,
      props: ['name', 'tab', 'vertical', 'size', 'type', 'bordered', 'readonly', 'ariaLabel'],
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, [slots.default?.(), slots.trigger?.()])
      }
    })

  return {
    useDialog: () => ({ warning: dialogWarningMock }),
    NAlert: passthrough('NAlert'),
    NButton: defineComponent({
      name: 'NButton',
      props: ['size', 'type', 'loading', 'quaternary', 'readonly'],
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NDivider: passthrough('NDivider'),
    NInput: defineComponent({
      name: 'NInput',
      props: ['value', 'readonly', 'size', 'ariaLabel'],
      setup(props) {
        return () =>
          h('input', {
            'data-test': 'NInput',
            value: props.value as string,
            readonly: props.readonly
          })
      }
    }),
    NPopconfirm: defineComponent({
      name: 'NPopconfirm',
      emits: ['positive-click'],
      setup(_, { slots, emit }) {
        return () => h('div', { 'data-test': 'NPopconfirm', onClick: () => emit('positive-click') }, slots.trigger?.())
      }
    }),
    NSpace: passthrough('NSpace'),
    NTabPane: passthrough('NTabPane')
  }
})

const makeAdmin = (overrides: Record<string, unknown> = {}) => ({
  selectedUser: ref({ userId: '@x:s', admin: false, deactivated: false }),
  evicting: ref(false),
  loggingOutAll: ref(false),
  impersonating: ref(false),
  impersonationSession: ref(null),
  evictUser: vi.fn().mockResolvedValue(undefined),
  logoutUserAll: vi.fn().mockResolvedValue(undefined),
  loginUserAs: vi.fn().mockResolvedValue(null),
  clearImpersonation: vi.fn(),
  invalidateSession: vi.fn().mockResolvedValue(undefined),
  ...overrides
})

const mountPane = (admin: ReturnType<typeof makeAdmin>) =>
  mount(AdminUserActionsPane, {
    props: { admin: admin as never }
  })

const clickButton = async (wrapper: ReturnType<typeof mountPane>, text: string) => {
  const button = wrapper.findAll('button').find((b) => b.text().includes(text))
  expect(button, `button ${text}`).toBeTruthy()
  await button!.trigger('click')
  await flushPromises()
}

describe('AdminUserActionsPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handleAdminErrorMock.mockReturnValue(true)
  })

  it('点击踢出仅弹出二次确认，取消时不调用服务', async () => {
    const admin = makeAdmin()
    const wrapper = mountPane(admin)

    await clickButton(wrapper, 'admin.users.evictUser')

    expect(dialogWarningMock).toHaveBeenCalledTimes(1)
    expect(admin.evictUser).not.toHaveBeenCalled()
  })

  it('确认踢出后调用服务并展示成功反馈', async () => {
    const admin = makeAdmin()
    const wrapper = mountPane(admin)

    await clickButton(wrapper, 'admin.users.evictUser')
    const options = dialogWarningMock.mock.calls[0][0] as { onPositiveClick: () => Promise<void> }
    await options.onPositiveClick()
    await flushPromises()

    expect(admin.evictUser).toHaveBeenCalledWith('@x:s')
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.users.evictSuccess', 'success')
  })

  it('踢出失败时展示错误反馈', async () => {
    const admin = makeAdmin({ evictUser: vi.fn().mockRejectedValue(new Error('boom')) })
    const wrapper = mountPane(admin)

    await clickButton(wrapper, 'admin.users.evictUser')
    const options = dialogWarningMock.mock.calls[0][0] as { onPositiveClick: () => Promise<void> }
    await options.onPositiveClick()
    await flushPromises()

    expect(handleAdminErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.users.evictFailed', 'error')
  })

  it('点击注销全部会话需二次确认，取消时不调用服务', async () => {
    const admin = makeAdmin()
    const wrapper = mountPane(admin)

    await clickButton(wrapper, 'admin.users.logoutUserAll')

    expect(dialogWarningMock).toHaveBeenCalledTimes(1)
    expect(admin.logoutUserAll).not.toHaveBeenCalled()
  })

  it('确认注销全部会话后调用服务并展示成功反馈', async () => {
    const admin = makeAdmin()
    const wrapper = mountPane(admin)

    await clickButton(wrapper, 'admin.users.logoutUserAll')
    const options = dialogWarningMock.mock.calls[0][0] as { onPositiveClick: () => Promise<void> }
    await options.onPositiveClick()
    await flushPromises()

    expect(admin.logoutUserAll).toHaveBeenCalledWith('@x:s')
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.users.logoutAllSuccess', 'success')
  })

  it('点击模拟登录需二次确认，取消时不调用服务', async () => {
    const admin = makeAdmin()
    const wrapper = mountPane(admin)

    await clickButton(wrapper, 'admin.users.loginUserAs')

    expect(dialogWarningMock).toHaveBeenCalledTimes(1)
    expect(admin.loginUserAs).not.toHaveBeenCalled()
  })

  it('确认模拟登录成功时展示成功反馈', async () => {
    const admin = makeAdmin({
      loginUserAs: vi.fn().mockResolvedValue({ userId: '@x:s', accessToken: 'tok', deviceId: 'DEV' })
    })
    const wrapper = mountPane(admin)

    await clickButton(wrapper, 'admin.users.loginUserAs')
    const options = dialogWarningMock.mock.calls[0][0] as { onPositiveClick: () => Promise<void> }
    await options.onPositiveClick()
    await flushPromises()

    expect(admin.loginUserAs).toHaveBeenCalledWith('@x:s')
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.users.loginAsSuccess', 'success')
  })

  it('模拟登录无令牌时展示失败反馈', async () => {
    const admin = makeAdmin()
    const wrapper = mountPane(admin)

    await clickButton(wrapper, 'admin.users.loginUserAs')
    const options = dialogWarningMock.mock.calls[0][0] as { onPositiveClick: () => Promise<void> }
    await options.onPositiveClick()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.users.loginAsFailed', 'error')
  })

  it('模拟登录抛错时展示失败反馈', async () => {
    const admin = makeAdmin({ loginUserAs: vi.fn().mockRejectedValue(new Error('boom')) })
    const wrapper = mountPane(admin)

    await clickButton(wrapper, 'admin.users.loginUserAs')
    const options = dialogWarningMock.mock.calls[0][0] as { onPositiveClick: () => Promise<void> }
    await options.onPositiveClick()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.users.loginAsFailed', 'error')
  })

  it('存在模拟会话时展示令牌并支持复制与清除', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const clearImpersonation = vi.fn()
    const admin = makeAdmin({
      impersonationSession: ref({ userId: '@x:s', accessToken: 'tok-123', deviceId: 'DEV' }),
      clearImpersonation
    })
    const wrapper = mountPane(admin)

    const input = wrapper.find('[data-test="NInput"]')
    expect(input.attributes('value')).toBe('tok-123')

    await clickButton(wrapper, 'admin.users.copyToken')
    expect(writeText).toHaveBeenCalledWith('tok-123')
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.users.copyTokenSuccess', 'success')

    await clickButton(wrapper, 'admin.users.clearSession')
    expect(clearImpersonation).toHaveBeenCalledTimes(1)
  })

  it('复制令牌失败时展示错误反馈', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const admin = makeAdmin({
      impersonationSession: ref({ userId: '@x:s', accessToken: 'tok-123', deviceId: 'DEV' })
    })
    const wrapper = mountPane(admin)

    await clickButton(wrapper, 'admin.users.copyToken')

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.users.copyTokenFailed', 'error')
  })
})
