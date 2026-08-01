import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import ModerationPanel from '../ModerationPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@iconify/vue', () => ({
  Icon: { template: '<span class="icon"><slot /></span>' }
}))

// Moderation Store mock
const fetchReportsMock = vi.fn().mockResolvedValue(undefined)
const fetchContentFiltersMock = vi.fn().mockResolvedValue(undefined)
const resolveReportMock = vi.fn().mockResolvedValue(true)
const addContentFilterMock = vi.fn()
const removeContentFilterMock = vi.fn()

vi.mock('@/stores/domains/chat/moderation', () => ({
  useModerationStore: () => ({
    openReports: { value: [] },
    enabledFilters: { value: [] },
    loading: { value: false },
    fetchReports: (...args: unknown[]) => fetchReportsMock(...args),
    fetchContentFilters: (...args: unknown[]) => fetchContentFiltersMock(...args),
    resolveReport: (...args: unknown[]) => resolveReportMock(...args),
    addContentFilter: (...args: unknown[]) => addContentFilterMock(...args),
    removeContentFilter: (...args: unknown[]) => removeContentFilterMock(...args)
  })
}))

// Admin service mock for event reports
const listEventReportsMock = vi.fn()
const listEventReportsByStatusMock = vi.fn()
const countAllEventReportsMock = vi.fn()
const countEventReportsByStatusMock = vi.fn()
const resolveEventReportMock = vi.fn()
const dismissEventReportMock = vi.fn()
const escalateEventReportMock = vi.fn()
const deleteEventReportMock = vi.fn()
const getEventReportHistoryMock = vi.fn()

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    reports: {
      listEventReports: (...args: unknown[]) => listEventReportsMock(...args),
      listEventReportsByStatus: (...args: unknown[]) => listEventReportsByStatusMock(...args),
      countAllEventReports: (...args: unknown[]) => countAllEventReportsMock(...args),
      countEventReportsByStatus: (...args: unknown[]) => countEventReportsByStatusMock(...args),
      resolveEventReport: (...args: unknown[]) => resolveEventReportMock(...args),
      dismissEventReport: (...args: unknown[]) => dismissEventReportMock(...args),
      escalateEventReport: (...args: unknown[]) => escalateEventReportMock(...args),
      deleteEventReport: (...args: unknown[]) => deleteEventReportMock(...args),
      getEventReportHistory: (...args: unknown[]) => getEventReportHistoryMock(...args)
    }
  }
}))

const showFeedbackMock = vi.fn()
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: (...args: unknown[]) => showFeedbackMock(...args) })
}))

// Naive UI 组件 stub（按注册名匹配，不带 N 前缀）
const naiveStubs = {
  Card: {
    template: '<div class="n-card"><div class="n-card-title">{{ title }}</div><slot /></div>',
    props: ['title', 'size']
  },
  Tabs: { template: '<div class="n-tabs"><slot /></div>' },
  TabPane: { template: '<div class="n-tab-pane"><slot /></div>', props: ['name', 'tab'] },
  Space: { template: '<div class="n-space"><slot /></div>', props: ['align', 'size', 'vertical'] },
  Button: {
    template:
      '<button class="n-button" :disabled="disabled" :data-testid="dataTestid" @click="$emit(\'click\')"><slot /><slot name="icon" /></button>',
    props: ['disabled', 'loading', 'type', 'secondary', 'dataTestid', 'size', 'text', 'ghost'],
    emits: ['click']
  },
  Select: {
    template:
      '<select class="n-select" v-bind="$attrs" :value="value" @change="$emit(\'update:value\', $event.target.value)"><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>',
    props: ['value', 'options', 'placeholder', 'disabled', 'clearable'],
    emits: ['update:value']
  },
  Input: {
    template:
      '<textarea class="n-input" v-bind="$attrs" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
    props: ['value', 'placeholder', 'type', 'rows'],
    emits: ['update:value']
  },
  DataTable: {
    props: ['columns', 'data', 'loading', 'rowKey'],
    render(this: {
      columns: Array<{ key?: string; render?: (row: unknown) => unknown }>
      data: Array<Record<string, unknown>>
    }) {
      const cols = this.columns || []
      const rows = this.data || []
      return h(
        'div',
        { class: 'n-data-table' },
        rows.map((row) =>
          h(
            'div',
            { class: 'n-data-table-row', key: String(row.id) },
            cols.map((col) => {
              const cellContent: unknown =
                typeof col.render === 'function' ? col.render(row) : (row[col.key ?? ''] ?? '')
              return h('div', { class: 'n-data-table-cell' }, [cellContent as never])
            })
          )
        )
      )
    }
  },
  Statistic: {
    template:
      '<div class="n-statistic"><span class="n-statistic-label">{{ label }}</span><span class="n-statistic-value">{{ value }}</span><slot name="suffix" /></div>',
    props: ['label', 'value']
  },
  Tag: { template: '<span class="n-tag"><slot /></span>', props: ['size', 'type', 'round'] },
  Empty: { template: '<div class="n-empty">{{ description }}</div>', props: ['description', 'size'] },
  Spin: { template: '<div class="n-spin" />', props: ['show'] },
  Modal: {
    template: '<div class="n-modal" v-if="show"><slot /><slot name="action" /></div>',
    props: ['show', 'title', 'preset']
  },
  Form: { template: '<form class="n-form"><slot /></form>', props: ['labelPlacement', 'model'] },
  FormItem: {
    template: '<div class="n-form-item"><label v-if="label">{{ label }}</label><slot /></div>',
    props: ['label', 'path']
  },
  List: { template: '<div class="n-list"><slot /></div>' },
  ListItem: { template: '<div class="n-list-item"><slot /></div>' },
  Thing: { template: '<div class="n-thing"><slot /></div>', props: ['title', 'description'] }
}

// jsdom 在某些环境下不提供 window.confirm，需要预先定义
function setupWindowConfirm(returnValue: boolean) {
  const impl = () => returnValue
  if (typeof window.confirm !== 'function') {
    Object.defineProperty(window, 'confirm', { value: impl, writable: true, configurable: true })
  } else {
    window.confirm = impl
  }
  return impl
}

describe('ModerationPanel — P1-4 事件举报管理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listEventReportsMock.mockResolvedValue([])
    countAllEventReportsMock.mockResolvedValue(0)
    countEventReportsByStatusMock.mockResolvedValue(0)
    resolveEventReportMock.mockResolvedValue(null)
    dismissEventReportMock.mockResolvedValue(null)
    escalateEventReportMock.mockResolvedValue(null)
    deleteEventReportMock.mockResolvedValue(true)
    getEventReportHistoryMock.mockResolvedValue([])
  })

  const mountPanel = () =>
    mount(ModerationPanel, {
      global: { stubs: naiveStubs }
    })

  const sampleEventReport = {
    id: 101,
    event_id: '$event1:hs',
    room_id: '!room1:hs',
    reporter_user_id: '@alice:hs',
    reported_user_id: '@bob:hs',
    reason: 'spam',
    description: null,
    status: 'open',
    score: -50,
    received_ts: 1700000000000,
    resolved_ts: null,
    resolved_by: null,
    resolution_reason: null
  }

  it('挂载时加载事件举报列表与统计', async () => {
    listEventReportsMock.mockResolvedValue([sampleEventReport])
    countAllEventReportsMock.mockResolvedValue(1)
    countEventReportsByStatusMock.mockResolvedValueOnce(1) // open

    const wrapper = mountPanel()
    await flushPromises()

    expect(listEventReportsMock).toHaveBeenCalledWith({ limit: 100 })
    expect(countAllEventReportsMock).toHaveBeenCalled()
    expect(countEventReportsByStatusMock).toHaveBeenCalledWith('open')
    expect(countEventReportsByStatusMock).toHaveBeenCalledWith('resolved')
    expect(countEventReportsByStatusMock).toHaveBeenCalledWith('dismissed')
    expect(wrapper.find('[data-testid="event-report-stat-total"]').exists()).toBe(true)
  })

  it('状态过滤调用 listEventReportsByStatus', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    listEventReportsByStatusMock.mockResolvedValue([])
    const select = wrapper.find('[data-testid="event-report-status-filter"]')
    await select.setValue('open')
    await flushPromises()

    expect(listEventReportsByStatusMock).toHaveBeenCalledWith('open', { limit: 100 })
  })

  it('点击刷新按钮重新拉取列表', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    listEventReportsMock.mockClear()
    await wrapper.find('[data-testid="event-report-refresh-btn"]').trigger('click')
    await flushPromises()

    expect(listEventReportsMock).toHaveBeenCalled()
  })

  it('升级事件举报成功后给出反馈', async () => {
    listEventReportsMock.mockResolvedValue([sampleEventReport])
    escalateEventReportMock.mockResolvedValue({ ...sampleEventReport, status: 'escalated' })

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="event-report-action-escalate"]').trigger('click')
    await flushPromises()

    expect(escalateEventReportMock).toHaveBeenCalledWith(101)
    expect(showFeedbackMock).toHaveBeenCalledWith('moderation.event_reports.toast.escalateSuccess', 'success')
  })

  it('升级失败给出错误反馈', async () => {
    listEventReportsMock.mockResolvedValue([sampleEventReport])
    escalateEventReportMock.mockResolvedValue(null)

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="event-report-action-escalate"]').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('moderation.event_reports.toast.escalateFailed', 'error')
  })

  it('删除事件举报弹出确认并调用 deleteEventReport', async () => {
    listEventReportsMock.mockResolvedValue([sampleEventReport])
    setupWindowConfirm(true)

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="event-report-action-delete"]').trigger('click')
    await flushPromises()

    expect(deleteEventReportMock).toHaveBeenCalledWith(101)
    expect(showFeedbackMock).toHaveBeenCalledWith('moderation.event_reports.toast.deleteSuccess', 'success')
  })

  it('删除确认取消时不调用 deleteEventReport', async () => {
    listEventReportsMock.mockResolvedValue([sampleEventReport])
    setupWindowConfirm(false)

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="event-report-action-delete"]').trigger('click')
    await flushPromises()

    expect(deleteEventReportMock).not.toHaveBeenCalled()
  })

  it('解决举报对话框：填写原因后调用 resolveEventReport', async () => {
    listEventReportsMock.mockResolvedValue([sampleEventReport])
    resolveEventReportMock.mockResolvedValue({ ...sampleEventReport, status: 'resolved' })

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="event-report-action-resolve"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('.n-modal').exists()).toBe(true)
    await wrapper.find('[data-testid="event-report-action-reason"]').setValue('resolved by admin')
    await wrapper.find('[data-testid="event-report-action-confirm"]').trigger('click')
    await flushPromises()

    expect(resolveEventReportMock).toHaveBeenCalledWith(101, { reason: 'resolved by admin' })
    expect(showFeedbackMock).toHaveBeenCalledWith('moderation.event_reports.toast.resolveSuccess', 'success')
  })

  it('解决对话框不填原因时给出错误反馈', async () => {
    listEventReportsMock.mockResolvedValue([sampleEventReport])

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="event-report-action-resolve"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="event-report-action-confirm"]').trigger('click')
    await flushPromises()

    expect(resolveEventReportMock).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('moderation.event_reports.dialog.reasonRequired', 'error')
  })

  it('驳回举报对话框：调用 dismissEventReport', async () => {
    listEventReportsMock.mockResolvedValue([sampleEventReport])
    dismissEventReportMock.mockResolvedValue({ ...sampleEventReport, status: 'dismissed' })

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="event-report-action-dismiss"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="event-report-action-reason"]').setValue('invalid report')
    await wrapper.find('[data-testid="event-report-action-confirm"]').trigger('click')
    await flushPromises()

    expect(dismissEventReportMock).toHaveBeenCalledWith(101, { reason: 'invalid report' })
    expect(showFeedbackMock).toHaveBeenCalledWith('moderation.event_reports.toast.dismissSuccess', 'success')
  })

  it('取消按钮关闭对话框且不调用接口', async () => {
    listEventReportsMock.mockResolvedValue([sampleEventReport])

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="event-report-action-resolve"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="event-report-action-cancel"]').trigger('click')
    await flushPromises()

    expect(resolveEventReportMock).not.toHaveBeenCalled()
  })

  it('点击历史按钮打开历史对话框', async () => {
    listEventReportsMock.mockResolvedValue([sampleEventReport])
    const history = [
      {
        id: 1,
        report_id: 101,
        action: 'create',
        actor_user_id: '@alice:hs',
        old_status: null,
        new_status: 'open',
        reason: null,
        created_ts: 1700000000000
      }
    ]
    getEventReportHistoryMock.mockResolvedValue(history)

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="event-report-action-history"]').trigger('click')
    await flushPromises()

    expect(getEventReportHistoryMock).toHaveBeenCalledWith(101)
  })

  it('加载事件举报失败时显示错误反馈并清空列表', async () => {
    listEventReportsMock.mockRejectedValue(new Error('boom'))

    mountPanel()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('moderation.event_reports.loadFailed', 'error')
  })

  it('已解决状态的举报禁用解决按钮', async () => {
    listEventReportsMock.mockResolvedValue([{ ...sampleEventReport, status: 'resolved' }])

    const wrapper = mountPanel()
    await flushPromises()

    const resolveBtn = wrapper.find('[data-testid="event-report-action-resolve"]')
    expect(resolveBtn.attributes('disabled')).toBeDefined()
  })
})
