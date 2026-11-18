import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ModerationEventReportTab from '../ModerationEventReportTab.vue'

const mocks = vi.hoisted(() => ({
  listReports: vi.fn(),
  getReportsByStatus: vi.fn(),
  getReportsCount: vi.fn(),
  getStatusCount: vi.fn(),
  escalateReport: vi.fn(),
  deleteReport: vi.fn(),
  resolveReport: vi.fn(),
  dismissReport: vi.fn(),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
  showFeedback: vi.fn(),
  dialogWarning: vi.fn()
}))

vi.mock('@/services/matrix/moderation/MatrixEventReportService', () => ({
  matrixEventReportService: {
    listReports: mocks.listReports,
    getReportsByStatus: mocks.getReportsByStatus,
    getReportsCount: mocks.getReportsCount,
    getStatusCount: mocks.getStatusCount,
    escalateReport: mocks.escalateReport,
    deleteReport: mocks.deleteReport,
    resolveReport: mocks.resolveReport,
    dismissReport: mocks.dismissReport,
    blockUser: mocks.blockUser,
    unblockUser: mocks.unblockUser
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: mocks.showFeedback })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const NSpace = defineComponent({
    name: 'NSpace',
    setup(_, { slots }) {
      return () => h('div', { class: 'n-space' }, slots.default?.())
    }
  })

  const NStatistic = defineComponent({
    name: 'NStatistic',
    props: { label: { type: String, default: '' }, value: { type: [Number, String], default: 0 } },
    setup(props) {
      return () => h('div', { class: 'n-statistic' }, `${props.label}:${props.value}`)
    }
  })

  const NSelect = defineComponent({
    name: 'NSelect',
    props: { value: { type: String, default: null }, options: { type: Array, default: () => [] } },
    emits: ['update:value'],
    setup() {
      return () => h('div', { class: 'n-select' })
    }
  })

  const NInput = defineComponent({
    name: 'NInput',
    props: { value: { type: String, default: '' }, placeholder: { type: String, default: '' } },
    emits: ['update:value'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          class: 'n-input',
          value: props.value,
          placeholder: props.placeholder,
          onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
        })
    }
  })

  const NButton = defineComponent({
    name: 'NButton',
    props: { size: { type: String, default: 'medium' }, type: { type: String, default: 'default' } },
    setup(_, { slots }) {
      return () => h('button', { class: 'n-button', type: 'button' }, slots.default?.())
    }
  })

  const NDataTable = defineComponent({
    name: 'NDataTable',
    props: {
      columns: { type: Array, default: () => [] },
      data: { type: Array, default: () => [] },
      loading: { type: Boolean, default: false },
      rowKey: { type: Function, default: undefined }
    },
    setup(props) {
      return () =>
        h(
          'div',
          { class: 'n-data-table' },
          (props.data as Record<string, unknown>[]).map((row, index) =>
            h(
              'div',
              { class: 'n-data-table-row', 'data-testid': `row-${row.id}` },
              (props.columns as { key: string; render?: (row: unknown, index: number) => unknown }[]).map((col) =>
                h(
                  'div',
                  { class: `cell-${col.key}` },
                  col.render ? (col.render(row, index) as never) : String(row[col.key] ?? '')
                )
              )
            )
          )
        )
    }
  })

  const NDrawer = defineComponent({
    name: 'NDrawer',
    props: { show: { type: Boolean, default: false } },
    setup(props, { slots }) {
      return () => (props.show ? h('div', { class: 'n-drawer' }, slots.default?.()) : null)
    }
  })

  const NDrawerContent = defineComponent({
    name: 'NDrawerContent',
    props: { title: { type: String, default: '' } },
    setup(props, { slots }) {
      return () => h('div', { class: 'n-drawer-content' }, [props.title, slots.default?.()])
    }
  })

  return {
    NButton,
    NDataTable,
    NDrawer,
    NDrawerContent,
    NInput,
    NSelect,
    NSpace,
    NStatistic,
    useDialog: () => ({ warning: mocks.dialogWarning })
  }
})

const sampleReports = [
  {
    id: 1,
    event_id: '$event-a',
    room_id: '!room-a:example.org',
    reporter_user_id: '@alice:example.org',
    reported_user_id: '@bob:example.org',
    reason: 'spam',
    description: null,
    status: 'open',
    score: -50,
    received_ts: 1700000000000,
    resolved_ts: null,
    resolved_by: null,
    resolution_reason: null
  }
]

const mountTab = async () => {
  const wrapper = mount(ModerationEventReportTab)
  await flushPromises()
  return wrapper
}

const lastDialogOptions = () => mocks.dialogWarning.mock.calls.at(-1)?.[0]

describe('ModerationEventReportTab 拉黑举报人', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listReports.mockResolvedValue(sampleReports)
    mocks.getReportsCount.mockResolvedValue({ total_reports: 1 })
    mocks.getStatusCount.mockResolvedValue({ count: 1 })
    mocks.blockUser.mockResolvedValue(undefined)
    mocks.unblockUser.mockResolvedValue(undefined)
  })

  it('挂载后按默认参数拉取举报列表', async () => {
    const wrapper = await mountTab()

    expect(mocks.listReports).toHaveBeenCalledWith({ limit: 100 })
    expect(wrapper.find('[data-testid="row-1"]').exists()).toBe(true)
  })

  it('拉黑举报人需二次确认，确认后按 24 小时封禁并提示成功', async () => {
    const wrapper = await mountTab()
    const before = Date.now()

    await wrapper.find('[data-testid="event-report-action-block"]').trigger('click')
    expect(mocks.blockUser).not.toHaveBeenCalled()

    const options = lastDialogOptions()
    await options.onPositiveClick()
    await flushPromises()

    const [, blockedUntil, reason] = mocks.blockUser.mock.calls[0]
    expect(mocks.blockUser.mock.calls[0][0]).toBe('@alice:example.org')
    expect(blockedUntil).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000)
    expect(reason).toBe('moderation.event_reports.dialog.blockReporterReason')
    expect(mocks.showFeedback).toHaveBeenCalledWith('moderation.event_reports.toast.blockReporterSuccess', 'success')
  })

  it('拉黑失败提示错误', async () => {
    mocks.blockUser.mockRejectedValueOnce(new Error('forbidden'))
    const wrapper = await mountTab()

    await wrapper.find('[data-testid="event-report-action-block"]').trigger('click')
    await lastDialogOptions().onPositiveClick()
    await flushPromises()

    expect(mocks.showFeedback).toHaveBeenCalledWith('moderation.event_reports.toast.blockReporterFailed', 'error')
  })

  it('解除拉黑需二次确认，确认后调用 unblockUser 并提示成功', async () => {
    const wrapper = await mountTab()

    await wrapper.find('[data-testid="event-report-action-unblock"]').trigger('click')
    expect(mocks.unblockUser).not.toHaveBeenCalled()

    await lastDialogOptions().onPositiveClick()
    await flushPromises()

    expect(mocks.unblockUser).toHaveBeenCalledWith('@alice:example.org')
    expect(mocks.showFeedback).toHaveBeenCalledWith('moderation.event_reports.toast.unblockReporterSuccess', 'success')
  })
})
