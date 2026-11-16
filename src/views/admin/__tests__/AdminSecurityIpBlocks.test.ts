import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminSecurityIpBlocks from '../AdminSecurityIpBlocks.vue'

const { getIpBlocksMock, blockIpMock, unblockIpMock, showFeedbackMock, validateMock } = vi.hoisted(() => ({
  getIpBlocksMock: vi.fn(),
  blockIpMock: vi.fn(),
  unblockIpMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  validateMock: vi.fn()
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getIpBlocks: getIpBlocksMock,
    blockIp: blockIpMock,
    unblockIp: unblockIpMock
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('@/components/common/EmptyState.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'EmptyState',
      props: ['description'],
      setup(props) {
        return () => h('div', { 'data-test': 'EmptyState' }, String(props.description ?? ''))
      }
    })
  }
})

vi.mock('@iconify/vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    Icon: defineComponent({
      name: 'Icon',
      props: ['icon'],
      setup() {
        return () => h('span', { 'data-test': 'Icon' })
      }
    })
  }
})

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  return {
    NButton: defineComponent({
      name: 'NButton',
      props: ['loading', 'type', 'size'],
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NDataTable: defineComponent({
      name: 'NDataTable',
      props: ['data', 'columns', 'pagination', 'rowKey', 'striped'],
      setup(props) {
        return () => h('div', { 'data-test': 'NDataTable' }, JSON.stringify(props.data ?? []))
      }
    }),
    NForm: defineComponent({
      name: 'NForm',
      props: ['model', 'rules'],
      setup(_, { slots, expose }) {
        expose({ validate: validateMock })
        return () => h('div', { 'data-test': 'NForm' }, slots.default?.())
      }
    }),
    NFormItem: defineComponent({
      name: 'NFormItem',
      props: ['label', 'path'],
      setup(props, { slots }) {
        return () => h('div', { 'data-test': 'NFormItem' }, [h('label', String(props.label ?? '')), slots.default?.()])
      }
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: ['value', 'placeholder', 'type', 'rows'],
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            'data-test': 'NInput',
            value: props.value as string,
            onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
          })
      }
    }),
    NDrawer: defineComponent({
      name: 'NDrawer',
      props: ['show'],
      setup(props, { slots }) {
        return () => (props.show ? h('div', { 'data-test': 'NDrawer' }, slots.default?.()) : null)
      }
    }),
    NDrawerContent: defineComponent({
      name: 'NDrawerContent',
      props: ['title'],
      setup(_, { slots }) {
        return () => h('div', { 'data-test': 'NDrawerContent' }, [slots.default?.(), slots.footer?.()])
      }
    }),
    NIcon: passthrough('NIcon'),
    NPopconfirm: passthrough('NPopconfirm'),
    NSpin: passthrough('NSpin')
  }
})

describe('AdminSecurityIpBlocks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getIpBlocksMock.mockResolvedValue([])
    blockIpMock.mockResolvedValue(true)
    unblockIpMock.mockResolvedValue(undefined)
    validateMock.mockResolvedValue(undefined)
  })

  const mountComponent = () => mount(AdminSecurityIpBlocks)

  const loadBlocks = async (wrapper: ReturnType<typeof mountComponent>) => {
    await (wrapper.vm as unknown as { refresh: () => Promise<void> }).refresh()
    await flushPromises()
  }

  const openDrawer = async (wrapper: ReturnType<typeof mountComponent>) => {
    const toolbarButton = wrapper.findAll('button').find((b) => b.text().includes('admin.security.block_ip'))
    expect(toolbarButton).toBeTruthy()
    await toolbarButton!.trigger('click')
    await flushPromises()
  }

  const findSubmit = (wrapper: ReturnType<typeof mountComponent>) => {
    const buttons = wrapper.findAll('button').filter((b) => b.text().includes('admin.security.block_ip'))
    return buttons[buttons.length - 1]
  }

  it('挂载后刷新加载 IP 封禁列表', async () => {
    const wrapper = mountComponent()
    await loadBlocks(wrapper)

    expect(getIpBlocksMock).toHaveBeenCalledTimes(1)
  })

  it('封禁失败后保留输入与抽屉，再次点击原按钮可重试成功', async () => {
    blockIpMock.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountComponent()
    await loadBlocks(wrapper)

    await openDrawer(wrapper)
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('10.0.0.9')
    await inputs[1].setValue('probe')

    await findSubmit(wrapper).trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.security.block_failed', 'error')
    expect(wrapper.find('[data-test="NDrawer"]').exists()).toBe(true)
    const retained = wrapper.findAll('input')
    expect((retained[0].element as HTMLInputElement).value).toBe('10.0.0.9')
    expect((retained[1].element as HTMLInputElement).value).toBe('probe')

    await findSubmit(wrapper).trigger('click')
    await flushPromises()

    expect(blockIpMock).toHaveBeenCalledTimes(2)
    expect(blockIpMock).toHaveBeenLastCalledWith('10.0.0.9', { reason: 'probe' })
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.security.ip_blocked', 'success')
    expect(wrapper.find('[data-test="NDrawer"]').exists()).toBe(false)
    expect(getIpBlocksMock).toHaveBeenCalledTimes(2)

    await openDrawer(wrapper)
    const cleared = wrapper.findAll('input')
    expect((cleared[0].element as HTMLInputElement).value).toBe('')
    expect((cleared[1].element as HTMLInputElement).value).toBe('')
  })

  it('封禁接口返回 false 时不误报成功，输入保留可重试', async () => {
    blockIpMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const wrapper = mountComponent()
    await loadBlocks(wrapper)

    await openDrawer(wrapper)
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('10.0.0.10')

    await findSubmit(wrapper).trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.security.block_failed', 'error')
    expect(showFeedbackMock).not.toHaveBeenCalledWith('admin.security.ip_blocked', 'success')
    expect(wrapper.find('[data-test="NDrawer"]').exists()).toBe(true)
    expect((wrapper.findAll('input')[0].element as HTMLInputElement).value).toBe('10.0.0.10')

    await findSubmit(wrapper).trigger('click')
    await flushPromises()

    expect(blockIpMock).toHaveBeenCalledTimes(2)
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.security.ip_blocked', 'success')
  })
})
