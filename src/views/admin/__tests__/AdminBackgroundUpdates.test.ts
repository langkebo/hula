import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminBackgroundUpdates from '../AdminBackgroundUpdates.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (!params) return key
      return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), key)
    }
  })
}))

const {
  listUpdatesMock,
  getStatusMock,
  startUpdateMock,
  cancelUpdateMock,
  completeUpdateMock,
  failUpdateMock,
  deleteUpdateMock,
  retryFailedMock,
  cleanupLocksMock
} = vi.hoisted(() => ({
  listUpdatesMock: vi.fn(),
  getStatusMock: vi.fn(),
  startUpdateMock: vi.fn(),
  cancelUpdateMock: vi.fn(),
  completeUpdateMock: vi.fn(),
  failUpdateMock: vi.fn(),
  deleteUpdateMock: vi.fn(),
  retryFailedMock: vi.fn(),
  cleanupLocksMock: vi.fn()
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    backgroundUpdates: {
      listUpdates: (...args: unknown[]) => listUpdatesMock(...args),
      getStatus: (...args: unknown[]) => getStatusMock(...args),
      startUpdate: (...args: unknown[]) => startUpdateMock(...args),
      cancelUpdate: (...args: unknown[]) => cancelUpdateMock(...args),
      completeUpdate: (...args: unknown[]) => completeUpdateMock(...args),
      failUpdate: (...args: unknown[]) => failUpdateMock(...args),
      deleteUpdate: (...args: unknown[]) => deleteUpdateMock(...args),
      retryFailed: (...args: unknown[]) => retryFailedMock(...args),
      cleanupLocks: (...args: unknown[]) => cleanupLocksMock(...args)
    }
  }
}))

const showFeedbackMock = vi.fn()
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: (...args: unknown[]) => showFeedbackMock(...args) })
}))

const ButtonStub = {
  template:
    '<button class="n-button" :data-testid="$attrs[\'data-testid\']" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  props: {
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    type: { type: String, default: '' },
    size: { type: String, default: '' },
    block: { type: Boolean, default: false },
    secondary: { type: Boolean, default: false },
    quaternary: { type: Boolean, default: false }
  },
  emits: ['click'],
  inheritAttrs: false
}

const InputStub = {
  template:
    '<input class="n-input" v-bind="$attrs" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
  props: {
    value: { type: String, default: '' },
    type: { type: String, default: '' },
    rows: { type: Number, default: 2 },
    placeholder: { type: String, default: '' }
  },
  emits: ['update:value'],
  inheritAttrs: false
}

const naiveStubs = {
  PageHeader: {
    template: '<div class="n-page-header"><slot name="extra" /><slot /></div>',
    props: ['title', 'subtitle']
  },
  Button: ButtonStub,
  Card: {
    template: '<div class="n-card"><div class="n-card-title">{{ title }}</div><slot /><slot name="action" /></div>',
    props: ['title', 'size']
  },
  Space: { template: '<div class="n-space"><slot /></div>', props: ['align', 'size'] },
  Descriptions: { template: '<div class="n-descriptions"><slot /></div>', props: ['column', 'size', 'bordered'] },
  DescriptionsItem: {
    template: '<div class="n-descriptions-item"><span class="label">{{ label }}</span><slot /></div>',
    props: ['label']
  },
  Tag: { template: '<span class="n-tag"><slot /></span>', props: ['size', 'type', 'round'] },
  Empty: { template: '<div class="n-empty"><slot /></div>', props: ['description', 'size'] },
  Spin: { template: '<div class="n-spin" />', props: ['size'] },
  Modal: {
    template: '<div class="n-modal" v-if="show"><slot /><slot name="action" /></div>',
    props: ['show', 'title', 'preset'],
    emits: ['update:show']
  },
  Form: { template: '<form class="n-form"><slot /></form>', props: ['model'] },
  FormItem: { template: '<div class="n-form-item"><slot /></div>', props: ['label'] },
  Input: InputStub
}

const makeUpdate = (overrides: Record<string, unknown> = {}) => ({
  job_name: 'job-1',
  job_type: 'index_rebuild',
  description: 'rebuild users index',
  status: 'pending',
  progress: {},
  total_items: 1000,
  processed_items: 0,
  created_ts: 1700000000000,
  started_ts: null,
  completed_ts: null,
  error_message: null,
  retry_count: 0,
  ...overrides
})

const makeStatus = (overrides: Record<string, unknown> = {}) => ({
  pending_count: 1,
  running_count: 0,
  completed_count: 5,
  failed_count: 2,
  total_count: 8,
  current_update: null,
  ...overrides
})

describe('AdminBackgroundUpdates — P1-1 后台更新管理面板', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listUpdatesMock.mockReset()
    getStatusMock.mockReset()
    startUpdateMock.mockReset()
    cancelUpdateMock.mockReset()
    completeUpdateMock.mockReset()
    failUpdateMock.mockReset()
    deleteUpdateMock.mockReset()
    retryFailedMock.mockReset()
    cleanupLocksMock.mockReset()
    showFeedbackMock.mockReset()
  })

  const mountPanel = async () => {
    if (listUpdatesMock.getMockImplementation() === undefined) {
      listUpdatesMock.mockResolvedValue({ updates: [], next_batch: undefined })
    }
    if (getStatusMock.getMockImplementation() === undefined) {
      getStatusMock.mockResolvedValue(makeStatus())
    }
    const wrapper = mount(AdminBackgroundUpdates, {
      global: { stubs: naiveStubs }
    })
    await flushPromises()
    return wrapper
  }

  it('挂载时加载状态和任务列表', async () => {
    await mountPanel()
    expect(getStatusMock).toHaveBeenCalled()
    expect(listUpdatesMock).toHaveBeenCalled()
  })

  it('展示汇总状态卡片，包含 pending/running/completed/failed/total 计数', async () => {
    const wrapper = await mountPanel()
    const text = wrapper.text()
    expect(text).toContain('background_updates.status.pending')
    expect(text).toContain('background_updates.status.running')
    expect(text).toContain('background_updates.status.completed')
    expect(text).toContain('background_updates.status.failed')
    expect(text).toContain('background_updates.status.total')
  })

  it('点击刷新按钮重新加载', async () => {
    const wrapper = await mountPanel()
    expect(getStatusMock.mock.calls.length).toBe(1)
    await wrapper.find('[data-testid="refresh-btn"]').trigger('click')
    await flushPromises()
    expect(getStatusMock.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('点击重试失败按钮调用 retryFailed 并反馈', async () => {
    retryFailedMock.mockResolvedValue({ retried_count: 3 })
    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="retry-failed-btn"]').trigger('click')
    await flushPromises()

    expect(retryFailedMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('background_updates.feedback.retry_success', 'success')
  })

  it('点击清理锁按钮调用 cleanupLocks 并反馈', async () => {
    cleanupLocksMock.mockResolvedValue({ cleaned_count: 5 })
    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="cleanup-locks-btn"]').trigger('click')
    await flushPromises()

    expect(cleanupLocksMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('background_updates.feedback.cleanup_success', 'success')
  })

  it('任务列表为空时显示空状态', async () => {
    listUpdatesMock.mockResolvedValue({ updates: [], next_batch: undefined })
    const wrapper = await mountPanel()
    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })

  it('启动任务成功后反馈并刷新列表', async () => {
    listUpdatesMock.mockResolvedValue({ updates: [makeUpdate({ status: 'pending' })], next_batch: undefined })
    startUpdateMock.mockResolvedValue({ ...makeUpdate(), status: 'running' })
    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="action-start"]').trigger('click')
    await flushPromises()

    expect(startUpdateMock).toHaveBeenCalledWith('job-1')
    expect(showFeedbackMock).toHaveBeenCalledWith('background_updates.feedback.start_success', 'success')
    expect(listUpdatesMock.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('取消任务成功后反馈并刷新列表', async () => {
    listUpdatesMock.mockResolvedValue({ updates: [makeUpdate({ status: 'running' })], next_batch: undefined })
    cancelUpdateMock.mockResolvedValue({ ...makeUpdate(), status: 'cancelled' })
    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="action-cancel"]').trigger('click')
    await flushPromises()

    expect(cancelUpdateMock).toHaveBeenCalledWith('job-1')
    expect(showFeedbackMock).toHaveBeenCalledWith('background_updates.feedback.cancel_success', 'success')
  })

  it('完成任务成功后反馈', async () => {
    listUpdatesMock.mockResolvedValue({ updates: [makeUpdate({ status: 'running' })], next_batch: undefined })
    completeUpdateMock.mockResolvedValue({ ...makeUpdate(), status: 'completed' })
    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="action-complete"]').trigger('click')
    await flushPromises()

    expect(completeUpdateMock).toHaveBeenCalledWith('job-1')
    expect(showFeedbackMock).toHaveBeenCalledWith('background_updates.feedback.complete_success', 'success')
  })

  it('点击标记失败按钮打开失败原因对话框', async () => {
    listUpdatesMock.mockResolvedValue({ updates: [makeUpdate()], next_batch: undefined })
    const wrapper = await mountPanel()
    expect(wrapper.find('.n-modal').exists()).toBe(false)
    await wrapper.find('[data-testid="action-fail"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('.n-modal').exists()).toBe(true)
  })

  it('在失败对话框中提交时调用 failUpdate 并关闭对话框', async () => {
    listUpdatesMock.mockResolvedValue({ updates: [makeUpdate()], next_batch: undefined })
    failUpdateMock.mockResolvedValue({ ...makeUpdate(), status: 'failed' })
    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="action-fail"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="fail-message-input"]').setValue('disk full')
    await wrapper.find('[data-testid="fail-confirm-btn"]').trigger('click')
    await flushPromises()

    expect(failUpdateMock).toHaveBeenCalledWith('job-1', 'disk full')
    expect(showFeedbackMock).toHaveBeenCalledWith('background_updates.feedback.fail_success', 'success')
    expect(wrapper.find('.n-modal').exists()).toBe(false)
  })

  it('删除任务成功后反馈', async () => {
    listUpdatesMock.mockResolvedValue({ updates: [makeUpdate({ status: 'completed' })], next_batch: undefined })
    deleteUpdateMock.mockResolvedValue(undefined)
    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="action-delete"]').trigger('click')
    await flushPromises()

    expect(deleteUpdateMock).toHaveBeenCalledWith('job-1')
    expect(showFeedbackMock).toHaveBeenCalledWith('background_updates.feedback.delete_success', 'success')
  })
})
