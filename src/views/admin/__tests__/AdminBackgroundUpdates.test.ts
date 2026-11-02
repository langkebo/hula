import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import AdminBackgroundUpdates from '../AdminBackgroundUpdates.vue'

const { warningMock, showFeedbackMock, composableMock } = vi.hoisted(() => ({
  warningMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  composableMock: {
    loadAll: vi.fn().mockResolvedValue(undefined),
    startUpdate: vi.fn().mockResolvedValue(undefined),
    cancelUpdate: vi.fn().mockResolvedValue(undefined),
    retryFailed: vi.fn().mockResolvedValue(2),
    cleanupLocks: vi.fn().mockResolvedValue(3),
    setAutoRefresh: vi.fn(),
    stopAutoRefresh: vi.fn()
  }
}))

vi.mock('@/composables/admin', () => ({
  useAdminBackgroundUpdates: () => ({
    updates: ref([
      {
        job_name: 'index_rebuild',
        job_type: 'index',
        status: 'running',
        total_items: 100,
        processed_items: 20,
        created_ts: 1_700_000_000,
        retry_count: 0
      }
    ]),
    summary: ref({
      pending_count: 1,
      running_count: 1,
      completed_count: 2,
      failed_count: 1,
      total_count: 5,
      current_update: {
        job_name: 'index_rebuild',
        job_type: 'index',
        status: 'running',
        total_items: 100,
        processed_items: 20,
        created_ts: 1_700_000_000,
        retry_count: 0
      }
    }),
    loading: ref(false),
    actionLoading: ref(false),
    autoRefresh: ref(false),
    ...composableMock
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params && typeof params.count === 'number' ? `${key}:${params.count}` : key
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      props: ['title', 'subtitle', 'type', 'column', 'labelPlacement', 'size', 'bordered', 'striped', 'label'],
      setup(props, { slots }) {
        return () =>
          h(tag, { 'data-test': name }, [
            props.title ? h('span', String(props.title)) : null,
            props.label ? h('span', String(props.label)) : null,
            slots.default?.(),
            slots.extra?.()
          ])
      }
    })

  return {
    useDialog: () => ({ warning: warningMock }),
    NAlert: passthrough('NAlert'),
    NButton: defineComponent({
      name: 'NButton',
      props: ['disabled', 'loading'],
      emits: ['click'],
      setup(props, { slots, emit }) {
        return () =>
          h('button', { type: 'button', disabled: props.disabled, onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NDataTable: defineComponent({
      name: 'NDataTable',
      props: ['data', 'columns', 'loading', 'locale', 'pagination', 'rowKey', 'size', 'striped'],
      setup(props) {
        return () => h('div', { 'data-test': 'NDataTable' }, JSON.stringify(props.data ?? []))
      }
    }),
    NDescriptions: passthrough('NDescriptions'),
    NDescriptionsItem: passthrough('NDescriptionsItem'),
    NPageHeader: passthrough('NPageHeader'),
    NProgress: passthrough('NProgress'),
    NSpace: passthrough('NSpace'),
    NSwitch: defineComponent({
      name: 'NSwitch',
      props: ['value', 'size'],
      emits: ['update:value'],
      setup(props, { slots, emit }) {
        return () =>
          h(
            'button',
            {
              type: 'button',
              'data-test': 'NSwitch',
              'data-value': String(props.value),
              onClick: () => emit('update:value', !props.value)
            },
            slots.default?.()
          )
      }
    }),
    NTag: passthrough('NTag')
  }
})

describe('AdminBackgroundUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mountComponent = () => mount(AdminBackgroundUpdates)

  it('渲染汇总计数与当前任务', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('background_updates.summary.total')
    expect(wrapper.text()).toContain('background_updates.current')
    expect(wrapper.find('[data-test="NDataTable"]').text()).toContain('index_rebuild')
  })

  it('重试失败任务需二次确认，确认后回执数量', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const retry = wrapper
      .findAll('button')
      .find((button) => button.text() === 'background_updates.actions.retry_failed')
    expect(retry).toBeDefined()
    await retry!.trigger('click')

    expect(warningMock).toHaveBeenCalledTimes(1)
    const options = warningMock.mock.calls[0][0]
    await options.onPositiveClick()

    expect(composableMock.retryFailed).toHaveBeenCalledTimes(1)
    expect(showFeedbackMock).toHaveBeenCalledWith('background_updates.retried_success:2', 'success')
  })

  it('自动刷新开关驱动可停的轮询', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    await wrapper.find('[data-test="NSwitch"]').trigger('click')
    expect(composableMock.setAutoRefresh).toHaveBeenCalledWith(true)
  })
})
