import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import AdminNotices from '../AdminNotices.vue'

const { loadNoticesMock, sendNoticeMock, showFeedbackMock, state } = vi.hoisted(() => ({
  loadNoticesMock: vi.fn(),
  sendNoticeMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  state: {
    notices: [] as Array<{ userId: string; sentTs?: number; content?: Record<string, unknown> }>,
    loading: false,
    sending: false
  }
}))

vi.mock('@/composables/admin', () => {
  // ref 在静态导入后可用；mock 工厂每次调用时基于 hoisted state 生成响应式引用
  return {
    useAdminNotices: () => ({
      notices: ref(state.notices),
      loading: ref(state.loading),
      sending: ref(state.sending),
      loadNotices: loadNoticesMock,
      sendNotice: sendNoticeMock
    })
  }
})

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

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      props: [
        'show',
        'data',
        'columns',
        'loading',
        'pagination',
        'rowKey',
        'striped',
        'title',
        'subtitle',
        'model',
        'labelPlacement',
        'labelWidth',
        'preset'
      ],
      setup(props, { slots }) {
        return () =>
          h(tag, { 'data-test': name }, [
            slots.default?.(),
            slots.extra?.(),
            slots.action?.(),
            props.title ? h('span', { 'data-test': `${name}-title` }, String(props.title)) : null
          ])
      }
    })

  return {
    NButton: defineComponent({
      name: 'NButton',
      props: ['loading', 'type'],
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NDataTable: defineComponent({
      name: 'NDataTable',
      props: ['data', 'columns', 'loading', 'pagination', 'rowKey', 'striped'],
      setup(props) {
        return () => h('div', { 'data-test': 'NDataTable' }, JSON.stringify(props.data ?? []))
      }
    }),
    NForm: passthrough('NForm'),
    NFormItem: defineComponent({
      name: 'NFormItem',
      props: ['label'],
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
    NModal: defineComponent({
      name: 'NModal',
      props: ['show', 'preset', 'title'],
      setup(props, { slots }) {
        return () => (props.show ? h('div', { 'data-test': 'NModal' }, [slots.default?.(), slots.action?.()]) : null)
      }
    }),
    NPageHeader: passthrough('NPageHeader'),
    NSpace: passthrough('NSpace')
  }
})

describe('AdminNotices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.notices = [
      { userId: '@alice:server.test', sentTs: 1700000000000, content: { msgtype: 'm.text', body: 'hello' } }
    ]
    state.loading = false
    state.sending = false
    loadNoticesMock.mockResolvedValue(undefined)
    sendNoticeMock.mockResolvedValue(undefined)
  })

  const mountComponent = () => mount(AdminNotices)

  it('挂载时加载公告列表', async () => {
    mountComponent()
    await flushPromises()

    expect(loadNoticesMock).toHaveBeenCalledTimes(1)
  })

  it('渲染公告数据到表格', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const table = wrapper.findComponent({ name: 'NDataTable' })
    expect(table.exists()).toBe(true)
    expect(table.text()).toContain('@alice:server.test')
  })

  it('点击刷新按钮重新加载', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    loadNoticesMock.mockClear()

    const refreshButton = wrapper.findAll('button').find((b) => b.text().includes('common.refresh'))
    expect(refreshButton).toBeDefined()
    await refreshButton!.trigger('click')
    await flushPromises()

    expect(loadNoticesMock).toHaveBeenCalledTimes(1)
  })

  it('表单为空时点击确认提示填充必填项', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    // 打开发送对话框
    const sendButton = wrapper.findAll('button').find((b) => b.text().includes('admin.notices.send'))
    await sendButton!.trigger('click')
    await flushPromises()

    // 直接点击确认（表单为空）
    const modal = wrapper.findComponent({ name: 'NModal' })
    expect(modal.exists()).toBe(true)
    const confirmButton = wrapper.findAll('button').find((b) => b.text().includes('common.confirm'))
    await confirmButton!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.notices.fill_required', 'warning')
    expect(sendNoticeMock).not.toHaveBeenCalled()
  })

  it('填写表单后发送公告成功', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    // 打开对话框
    const sendButton = wrapper.findAll('button').find((b) => b.text().includes('admin.notices.send'))
    await sendButton!.trigger('click')
    await flushPromises()

    // 填写表单
    const inputs = wrapper.findAll('input')
    expect(inputs.length).toBeGreaterThanOrEqual(2)
    await inputs[0].setValue('@bob:server.test')
    await inputs[1].setValue('system maintenance')

    // 点击确认
    const confirmButton = wrapper.findAll('button').find((b) => b.text().includes('common.confirm'))
    await confirmButton!.trigger('click')
    await flushPromises()

    expect(sendNoticeMock).toHaveBeenCalledWith('@bob:server.test', 'system maintenance')
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.notices.send_success', 'success')
  })

  it('发送失败时展示错误反馈', async () => {
    sendNoticeMock.mockRejectedValue(new Error('network error'))
    const wrapper = mountComponent()
    await flushPromises()

    const sendButton = wrapper.findAll('button').find((b) => b.text().includes('admin.notices.send'))
    await sendButton!.trigger('click')
    await flushPromises()

    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('@bob:server.test')
    await inputs[1].setValue('hello')

    const confirmButton = wrapper.findAll('button').find((b) => b.text().includes('common.confirm'))
    await confirmButton!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.notices.send_failed', 'error')
  })
})
