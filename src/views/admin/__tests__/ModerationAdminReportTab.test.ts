import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ModerationAdminReportTab from '../ModerationAdminReportTab.vue'

const mocks = vi.hoisted(() => ({
  getAdminReports: vi.fn(),
  getAdminReport: vi.fn(),
  dismissReport: vi.fn(),
  showFeedback: vi.fn()
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    reports: {
      getAdminReports: mocks.getAdminReports,
      getAdminReport: mocks.getAdminReport,
      dismissReport: mocks.dismissReport
    }
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: mocks.showFeedback })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const NSpace = defineComponent({
    name: 'NSpace',
    setup(_, { slots }) {
      return () => h('div', { class: 'n-space' }, slots.default?.())
    }
  })

  const NAlert = defineComponent({
    name: 'NAlert',
    setup(_, { slots }) {
      return () => h('div', { class: 'n-alert' }, slots.default?.())
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
    props: {
      size: { type: String, default: 'medium' },
      type: { type: String, default: 'default' },
      text: { type: Boolean, default: false },
      loading: { type: Boolean, default: false }
    },
    setup(_, { slots }) {
      return () => h('button', { class: 'n-button', type: 'button' }, slots.default?.())
    }
  })

  const NPopconfirm = defineComponent({
    name: 'NPopconfirm',
    props: { onPositiveClick: { type: Function, default: undefined } },
    setup(props, { slots }) {
      return () =>
        h('span', { class: 'n-popconfirm' }, [
          slots.trigger?.(),
          h(
            'button',
            {
              class: 'popconfirm-positive',
              type: 'button',
              onClick: () => (props.onPositiveClick as (() => void) | undefined)?.()
            },
            'ok'
          )
        ])
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
              (
                props.columns as {
                  key: string
                  render?: (row: unknown, index: number) => unknown
                }[]
              ).map((col) =>
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

  const NEmpty = defineComponent({
    name: 'NEmpty',
    props: { description: { type: String, default: '' } },
    setup(props) {
      return () => h('div', { class: 'n-empty' }, props.description)
    }
  })

  const NSpin = defineComponent({
    name: 'NSpin',
    setup(_, { slots }) {
      return () => h('div', { class: 'n-spin' }, slots.default?.())
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

  const NDescriptions = defineComponent({
    name: 'NDescriptions',
    setup(_, { slots }) {
      return () => h('div', { class: 'n-descriptions' }, slots.default?.())
    }
  })

  const NDescriptionsItem = defineComponent({
    name: 'NDescriptionsItem',
    props: { label: { type: String, default: '' } },
    setup(props, { slots }) {
      return () => h('div', { class: 'n-descriptions-item' }, [props.label, slots.default?.()])
    }
  })

  return {
    NAlert,
    NButton,
    NDataTable,
    NDescriptions,
    NDescriptionsItem,
    NDrawer,
    NDrawerContent,
    NEmpty,
    NInput,
    NPopconfirm,
    NSpace,
    NSpin
  }
})

const sampleReports = [
  {
    id: 1,
    room_id: '!room-a:example.org',
    event_id: '$event-a',
    user_id: '@alice:example.org',
    reported_user_id: '@bob:example.org',
    reason: 'spam',
    content: 'buy now',
    status: 'open',
    score: -50,
    received_ts: 1700000000000
  },
  {
    id: 2,
    room_id: '!room-b:example.org',
    event_id: '$event-b',
    user_id: '@carol:example.org',
    reported_user_id: null,
    reason: 'abuse',
    content: null,
    status: 'open',
    score: -30,
    received_ts: 1700000000000
  }
]

const mountTab = async () => {
  const wrapper = mount(ModerationAdminReportTab)
  await flushPromises()
  return wrapper
}

describe('ModerationAdminReportTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAdminReports.mockResolvedValue({ reports: sampleReports })
    mocks.getAdminReport.mockResolvedValue(sampleReports[0])
    mocks.dismissReport.mockResolvedValue(true)
  })

  it('挂载后按默认参数拉取并渲染报表行', async () => {
    const wrapper = await mountTab()

    expect(mocks.getAdminReports).toHaveBeenCalledWith(undefined, 100, undefined, true)
    expect(wrapper.findAll('[data-testid^="row-"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="row-1"]').text()).toContain('spam')
    expect(wrapper.find('[data-testid="row-1"]').text()).toContain('@bob:example.org')
    expect(wrapper.find('[data-testid="row-2"]').text()).toContain('-')
  })

  it('空列表显示空状态', async () => {
    mocks.getAdminReports.mockResolvedValueOnce({ reports: [] })
    const wrapper = await mountTab()

    expect(wrapper.find('[data-testid="admin-report-empty"]').exists()).toBe(true)
  })

  it('加载失败显示错误并可重试', async () => {
    mocks.getAdminReports.mockRejectedValueOnce(new Error('server offline'))
    const wrapper = await mountTab()

    expect(wrapper.find('[data-testid="admin-report-error"]').text()).toContain('server offline')
    expect(wrapper.find('[data-testid="admin-report-empty"]').exists()).toBe(false)

    await wrapper.find('[data-testid="admin-report-retry"]').trigger('click')
    await flushPromises()
    expect(mocks.getAdminReports).toHaveBeenCalledTimes(2)
  })

  it('填写房间 ID 后刷新按房间查询', async () => {
    const wrapper = await mountTab()

    await wrapper.find('[data-testid="admin-report-room-input"]').setValue('!room-a:example.org')
    await wrapper.find('[data-testid="admin-report-refresh"]').trigger('click')
    await flushPromises()

    expect(mocks.getAdminReports).toHaveBeenLastCalledWith('!room-a:example.org', 100, undefined, true)
  })

  it('查看详情调用 getAdminReport 并渲染内容', async () => {
    const wrapper = await mountTab()

    await wrapper.find('[data-testid="admin-report-detail-1"]').trigger('click')
    await flushPromises()

    expect(mocks.getAdminReport).toHaveBeenCalledWith('1', true)
    const drawer = wrapper.find('.n-drawer-content')
    expect(drawer.text()).toContain('buy now')
    expect(drawer.text()).toContain('spam')
  })

  it('驳回成功后提示并重新拉取', async () => {
    const wrapper = await mountTab()
    mocks.getAdminReports.mockClear()

    await wrapper.find('[data-testid="admin-report-dismiss-1"]').trigger('click')
    await wrapper.find('.popconfirm-positive').trigger('click')
    await flushPromises()

    expect(mocks.dismissReport).toHaveBeenCalledWith('1', true)
    expect(mocks.showFeedback).toHaveBeenCalled()
    expect(mocks.getAdminReports).toHaveBeenCalledTimes(1)
  })

  it('驳回失败提示错误且不重新拉取', async () => {
    mocks.dismissReport.mockRejectedValueOnce(new Error('forbidden'))
    const wrapper = await mountTab()
    mocks.getAdminReports.mockClear()

    await wrapper.find('[data-testid="admin-report-dismiss-1"]').trigger('click')
    await wrapper.find('.popconfirm-positive').trigger('click')
    await flushPromises()

    expect(mocks.showFeedback).toHaveBeenCalled()
    expect(mocks.getAdminReports).not.toHaveBeenCalled()
  })
})
