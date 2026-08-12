import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import AdminRetention from '../AdminRetention.vue'

const { loadAllMock, setPolicyMock, deletePolicyMock, runTaskMock, showFeedbackMock, state } = vi.hoisted(() => ({
  loadAllMock: vi.fn(),
  setPolicyMock: vi.fn(),
  deletePolicyMock: vi.fn(),
  runTaskMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  state: {
    policies: [] as Array<{ roomId: string; minLifetime?: number; maxLifetime?: number }>,
    retentionStatus: null as Record<string, unknown> | null,
    loading: false,
    taskLoading: false
  }
}))

vi.mock('@/composables/admin', () => ({
  useAdminRetention: () => ({
    policies: ref(state.policies),
    retentionStatus: ref(state.retentionStatus),
    loading: ref(state.loading),
    taskLoading: ref(state.taskLoading),
    loadAll: loadAllMock,
    setPolicy: setPolicyMock,
    deletePolicy: deletePolicyMock,
    runTask: runTaskMock
  })
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

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      props: ['show', 'title', 'subtitle', 'type', 'showIcon', 'model', 'labelPlacement', 'labelWidth', 'preset'],
      setup(props, { slots }) {
        return () =>
          h(tag, { 'data-test': name }, [
            props.title ? h('span', String(props.title)) : null,
            slots.default?.(),
            slots.extra?.(),
            slots.action?.()
          ])
      }
    })

  return {
    NAlert: passthrough('NAlert'),
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
      props: ['value', 'disabled'],
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            'data-test': 'NInput',
            value: props.value as string,
            disabled: props.disabled,
            onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
          })
      }
    }),
    NInputNumber: defineComponent({
      name: 'NInputNumber',
      props: ['value', 'min', 'placeholder'],
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            'data-test': 'NInputNumber',
            type: 'number',
            value: props.value as number,
            onInput: (e: Event) => emit('update:value', Number((e.target as HTMLInputElement).value))
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
    NSpace: passthrough('NSpace'),
    NTag: defineComponent({
      name: 'NTag',
      props: ['size', 'type'],
      setup(_, { slots }) {
        return () => h('span', { 'data-test': 'NTag' }, slots.default?.())
      }
    })
  }
})

describe('AdminRetention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.policies = [{ roomId: '!room1:server.test', minLifetime: 86400000, maxLifetime: 604800000 }]
    state.retentionStatus = { running: false }
    state.loading = false
    state.taskLoading = false
    loadAllMock.mockResolvedValue(undefined)
    setPolicyMock.mockResolvedValue(undefined)
    deletePolicyMock.mockResolvedValue(undefined)
    runTaskMock.mockResolvedValue(undefined)
  })

  const mountComponent = () => mount(AdminRetention)

  it('挂载时加载保留策略与状态', async () => {
    mountComponent()
    await flushPromises()

    expect(loadAllMock).toHaveBeenCalledTimes(1)
  })

  it('渲染策略数据到表格', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const table = wrapper.findComponent({ name: 'NDataTable' })
    expect(table.exists()).toBe(true)
    expect(table.text()).toContain('!room1:server.test')
  })

  it('展示保留任务空闲状态', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('admin.retention.status_idle')
  })

  it('任务运行中显示 running 状态', async () => {
    state.retentionStatus = { running: true }
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('admin.retention.status_running')
  })

  it('点击运行任务按钮触发 runTask 并展示成功反馈', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const runButton = wrapper.findAll('button').find((b) => b.text().includes('admin.retention.run_task'))
    await runButton!.trigger('click')
    await flushPromises()

    expect(runTaskMock).toHaveBeenCalledTimes(1)
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.retention.task_started', 'success')
  })

  it('运行任务失败时展示错误反馈', async () => {
    runTaskMock.mockRejectedValue(new Error('boom'))
    const wrapper = mountComponent()
    await flushPromises()

    const runButton = wrapper.findAll('button').find((b) => b.text().includes('admin.retention.run_task'))
    await runButton!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.retention.task_failed', 'error')
  })

  it('点击刷新按钮重新加载数据', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    loadAllMock.mockClear()

    const refreshButton = wrapper.findAll('button').find((b) => b.text().includes('common.refresh'))
    await refreshButton!.trigger('click')
    await flushPromises()

    expect(loadAllMock).toHaveBeenCalledTimes(1)
  })
})
