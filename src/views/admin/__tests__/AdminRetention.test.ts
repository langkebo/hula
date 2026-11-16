import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import AdminRetention from '../AdminRetention.vue'

const {
  loadAllMock,
  setPolicyMock,
  runTaskMock,
  showFeedbackMock,
  loadRoomPolicyMock,
  setRoomPolicyMock,
  deleteRoomPolicyMock,
  dialogWarningMock,
  state
} = vi.hoisted(() => ({
  loadAllMock: vi.fn(),
  setPolicyMock: vi.fn(),
  runTaskMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  loadRoomPolicyMock: vi.fn(),
  setRoomPolicyMock: vi.fn(),
  deleteRoomPolicyMock: vi.fn(),
  dialogWarningMock: vi.fn(),
  state: {
    policies: [] as Array<{ roomId: string; minLifetime?: number; maxLifetime?: number }>,
    retentionStatus: null as Record<string, unknown> | null,
    loading: false,
    taskLoading: false,
    defaultRetention: null as Record<string, number> | null,
    defaultLoading: false,
    roomPolicy: null as { roomId: string; policy?: Record<string, number> } | null,
    roomPolicyLoading: false,
    roomWriteLoading: false
  }
}))

vi.mock('@/composables/admin', () => ({
  useAdminRetention: () => ({
    policies: ref(state.policies),
    retentionStatus: ref(state.retentionStatus),
    loading: ref(state.loading),
    taskLoading: ref(state.taskLoading),
    defaultRetention: ref(state.defaultRetention),
    defaultLoading: ref(state.defaultLoading),
    roomPolicy: ref(state.roomPolicy),
    roomPolicyLoading: ref(state.roomPolicyLoading),
    roomWriteLoading: ref(state.roomWriteLoading),
    loadAll: loadAllMock,
    loadDefaultRetention: vi.fn(),
    loadRoomPolicy: loadRoomPolicyMock,
    setPolicy: setPolicyMock,
    setRoomPolicy: setRoomPolicyMock,
    deleteRoomPolicy: deleteRoomPolicyMock,
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
    useDialog: () => ({ warning: dialogWarningMock }),
    NAlert: passthrough('NAlert'),
    NCard: passthrough('NCard'),
    NDescriptions: passthrough('NDescriptions'),
    NDescriptionsItem: defineComponent({
      name: 'NDescriptionsItem',
      props: ['label', 'span'],
      setup(props, { slots }) {
        return () =>
          h('div', { 'data-test': 'NDescriptionsItem' }, [h('span', String(props.label ?? '')), slots.default?.()])
      }
    }),
    NEmpty: defineComponent({
      name: 'NEmpty',
      props: ['description'],
      setup(props) {
        return () => h('div', { 'data-test': 'NEmpty' }, String(props.description ?? ''))
      }
    }),
    NGrid: passthrough('NGrid'),
    NGi: passthrough('NGi'),
    NSpin: defineComponent({
      name: 'NSpin',
      props: ['show'],
      setup(_, { slots }) {
        return () => h('div', { 'data-test': 'NSpin' }, slots.default?.())
      }
    }),
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
    state.defaultRetention = null
    state.defaultLoading = false
    state.roomPolicy = null
    state.roomPolicyLoading = false
    state.roomWriteLoading = false
    loadAllMock.mockResolvedValue(undefined)
    setPolicyMock.mockResolvedValue(undefined)
    runTaskMock.mockResolvedValue(undefined)
    loadRoomPolicyMock.mockResolvedValue(undefined)
    setRoomPolicyMock.mockResolvedValue(undefined)
    deleteRoomPolicyMock.mockResolvedValue(undefined)
  })

  const mountComponent = () => mount(AdminRetention)

  const clickButton = async (wrapper: ReturnType<typeof mountComponent>, text: string) => {
    const button = wrapper.findAll('button').find((b) => b.text().includes(text))
    expect(button, `button ${text}`).toBeTruthy()
    await button!.trigger('click')
    await flushPromises()
  }

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

    await clickButton(wrapper, 'admin.retention.run_task')

    expect(runTaskMock).toHaveBeenCalledTimes(1)
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.retention.task_started', 'success')
  })

  it('运行任务失败时展示错误反馈', async () => {
    runTaskMock.mockRejectedValue(new Error('boom'))
    const wrapper = mountComponent()
    await flushPromises()

    await clickButton(wrapper, 'admin.retention.run_task')

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.retention.task_failed', 'error')
  })

  it('点击刷新按钮重新加载数据', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    loadAllMock.mockClear()

    await clickButton(wrapper, 'common.refresh')

    expect(loadAllMock).toHaveBeenCalledTimes(1)
  })

  // ---- ADM-11 C: 房间级保留策略 ----

  it('房间 ID 为空时读取策略给出警告且不调用服务', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    await clickButton(wrapper, 'admin.retention.load_room_policy')

    expect(loadRoomPolicyMock).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.retention.room_id_required', 'warning')
  })

  it('读取房间策略成功后展示成功反馈', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    await wrapper.find('[data-test="NInput"]').setValue('!room9:server.test')
    await clickButton(wrapper, 'admin.retention.load_room_policy')

    expect(loadRoomPolicyMock).toHaveBeenCalledWith('!room9:server.test')
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.retention.room_policy_load_success', 'success')
  })

  it('读取房间策略失败时展示错误反馈', async () => {
    loadRoomPolicyMock.mockRejectedValue(new Error('boom'))
    const wrapper = mountComponent()
    await flushPromises()

    await wrapper.find('[data-test="NInput"]').setValue('!room9:server.test')
    await clickButton(wrapper, 'admin.retention.load_room_policy')

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.retention.room_policy_load_failed', 'error')
  })

  it('展示服务端默认策略', async () => {
    state.defaultRetention = { min_lifetime: 3600000, max_lifetime: 7200000 }
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('admin.retention.default_policy_title')
    expect(wrapper.text()).toContain('1h')
  })

  it('保存房间策略后调用服务并给出成功反馈', async () => {
    state.roomPolicy = { roomId: '!room9:server.test', policy: { min_lifetime: 1000, max_lifetime: 9000 } }
    const wrapper = mountComponent()
    await flushPromises()

    await wrapper.find('[data-test="NInput"]').setValue('!room9:server.test')
    const numbers = wrapper.findAll('[data-test="NInputNumber"]')
    await numbers[0].setValue('1000')
    await clickButton(wrapper, 'common.save')

    expect(setRoomPolicyMock).toHaveBeenCalledWith('!room9:server.test', { min_lifetime: 1000, max_lifetime: 9000 })
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.retention.room_policy_save_success', 'success')
  })

  it('保存房间策略失败时展示错误反馈', async () => {
    setRoomPolicyMock.mockRejectedValue(new Error('boom'))
    state.roomPolicy = { roomId: '!room9:server.test', policy: { min_lifetime: 1000, max_lifetime: 9000 } }
    const wrapper = mountComponent()
    await flushPromises()

    await wrapper.find('[data-test="NInput"]').setValue('!room9:server.test')
    await clickButton(wrapper, 'common.save')

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.retention.room_policy_save_failed', 'error')
  })

  it('保存房间策略失败后保留输入，再次点击原按钮可重试成功', async () => {
    setRoomPolicyMock.mockRejectedValueOnce(new Error('boom'))
    state.roomPolicy = { roomId: '!room9:server.test', policy: { min_lifetime: 1000, max_lifetime: 9000 } }
    const wrapper = mountComponent()
    await flushPromises()

    await wrapper.find('[data-test="NInput"]').setValue('!room9:server.test')
    const numbers = wrapper.findAll('[data-test="NInputNumber"]')
    await numbers[1].setValue('20000')

    await clickButton(wrapper, 'common.save')

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.retention.room_policy_save_failed', 'error')
    expect((wrapper.find('[data-test="NInput"]').element as HTMLInputElement).value).toBe('!room9:server.test')
    const retained = wrapper.findAll('[data-test="NInputNumber"]')
    expect((retained[0].element as HTMLInputElement).value).toBe('1000')
    expect((retained[1].element as HTMLInputElement).value).toBe('20000')

    await clickButton(wrapper, 'common.save')

    expect(setRoomPolicyMock).toHaveBeenCalledTimes(2)
    expect(setRoomPolicyMock).toHaveBeenLastCalledWith('!room9:server.test', {
      min_lifetime: 1000,
      max_lifetime: 20000
    })
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.retention.room_policy_save_success', 'success')
  })

  it('删除房间策略需二次确认，取消时不调用服务', async () => {
    state.roomPolicy = { roomId: '!room9:server.test', policy: { min_lifetime: 1000 } }
    const wrapper = mountComponent()
    await flushPromises()

    await wrapper.find('[data-test="NInput"]').setValue('!room9:server.test')
    await clickButton(wrapper, 'admin.retention.delete_room_policy')

    expect(dialogWarningMock).toHaveBeenCalledTimes(1)
    expect(deleteRoomPolicyMock).not.toHaveBeenCalled()
  })

  it('确认删除房间策略后调用服务并展示成功反馈', async () => {
    state.roomPolicy = { roomId: '!room9:server.test', policy: { min_lifetime: 1000 } }
    const wrapper = mountComponent()
    await flushPromises()

    await wrapper.find('[data-test="NInput"]').setValue('!room9:server.test')
    await clickButton(wrapper, 'admin.retention.delete_room_policy')

    const options = dialogWarningMock.mock.calls[0][0] as { onPositiveClick: () => Promise<void> }
    await options.onPositiveClick()
    await flushPromises()

    expect(deleteRoomPolicyMock).toHaveBeenCalledWith('!room9:server.test')
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.retention.room_policy_delete_success', 'success')
  })

  it('删除房间策略失败时展示错误反馈', async () => {
    deleteRoomPolicyMock.mockRejectedValue(new Error('boom'))
    state.roomPolicy = { roomId: '!room9:server.test', policy: { min_lifetime: 1000 } }
    const wrapper = mountComponent()
    await flushPromises()

    await wrapper.find('[data-test="NInput"]').setValue('!room9:server.test')
    await clickButton(wrapper, 'admin.retention.delete_room_policy')
    const options = dialogWarningMock.mock.calls[0][0] as { onPositiveClick: () => Promise<void> }
    await options.onPositiveClick()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.retention.room_policy_delete_failed', 'error')
  })
})
