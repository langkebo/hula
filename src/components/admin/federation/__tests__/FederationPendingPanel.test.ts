import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import FederationPendingPanel from '../FederationPendingPanel.vue'

const { getPendingMock, confirmFederationMock, warningMock, showFeedbackMock } = vi.hoisted(() => ({
  getPendingMock: vi.fn(),
  confirmFederationMock: vi.fn(),
  warningMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {},
  adminFederationService: {
    getPendingFederationServers: getPendingMock,
    confirmFederation: confirmFederationMock
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('naive-ui', () => {
  const NAlert = defineComponent({
    name: 'NAlert',
    props: { type: String, title: String, bordered: Boolean },
    setup(props, { slots }) {
      return () => h('div', { class: 'n-alert' }, [h('span', props.title), slots.default?.()])
    }
  })
  const NButton = defineComponent({
    name: 'NButton',
    props: { type: String, size: String, ghost: Boolean },
    emits: ['click'],
    setup(_, { slots, emit }) {
      return () => h('button', { class: 'n-button', onClick: () => emit('click') }, slots.default?.())
    }
  })
  const NDataTable = defineComponent({
    name: 'NDataTable',
    props: { columns: { type: Array, default: () => [] }, data: { type: Array, default: () => [] } },
    setup(props) {
      return () =>
        h(
          'table',
          { class: 'n-data-table' },
          (props.data as Record<string, unknown>[]).map((row, rowIndex) =>
            h(
              'tr',
              { class: 'n-data-row', key: String(row.serverName ?? rowIndex) },
              (props.columns as { key: string; render?: (r: unknown, i: number) => unknown }[]).map((column) =>
                h('td', {}, column.render ? (column.render(row, rowIndex) as never) : String(row[column.key] ?? ''))
              )
            )
          )
        )
    }
  })
  const NEmpty = defineComponent({
    name: 'NEmpty',
    props: { description: String },
    setup(props) {
      return () => h('div', { class: 'n-empty' }, props.description)
    }
  })
  const NSpin = defineComponent({
    name: 'NSpin',
    props: { show: Boolean },
    setup(_, { slots }) {
      return () => h('div', { class: 'n-spin' }, slots.default?.())
    }
  })
  const NTag = defineComponent({
    name: 'NTag',
    props: { type: String, size: String },
    setup(_, { slots }) {
      return () => h('span', { class: 'n-tag' }, slots.default?.())
    }
  })
  const NSpace = defineComponent({
    name: 'NSpace',
    props: { size: Number },
    setup(_, { slots }) {
      return () => h('div', { class: 'n-space' }, slots.default?.())
    }
  })
  return {
    NAlert,
    NButton,
    NDataTable,
    NEmpty,
    NSpace,
    NSpin,
    NTag,
    useDialog: () => ({ warning: warningMock })
  }
})

const pendingRow = {
  serverName: 'pending.hs',
  failureCount: 3,
  lastFailedConnectAt: 1700000000000,
  lastSuccessfulConnectAt: null,
  status: 'pending',
  updatedTs: 1700000000000
}

function mountPanel() {
  return mount(FederationPendingPanel)
}

describe('FederationPendingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPendingMock.mockResolvedValue({ servers: [], total: 0, limit: 20 })
    confirmFederationMock.mockResolvedValue(undefined)
  })

  it('loads pending servers on mount and renders rows', async () => {
    getPendingMock.mockResolvedValue({ servers: [pendingRow], total: 1, limit: 20 })
    const wrapper = mountPanel()
    await flushPromises()

    expect(getPendingMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.n-data-row').exists()).toBe(true)
    expect(wrapper.text()).toContain('pending.hs')
    expect(wrapper.text()).toContain('pending')
    expect(wrapper.find('[data-test="pending-empty"]').exists()).toBe(false)
  })

  it('renders empty state when there are no pending servers', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    expect(wrapper.find('[data-test="pending-empty"]').exists()).toBe(true)
  })

  it('renders error alert when loading fails', async () => {
    getPendingMock.mockRejectedValue(new Error('pending-down'))
    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-test="pending-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('pending-down')
  })

  it('asks for confirmation before accepting a server', async () => {
    getPendingMock.mockResolvedValue({ servers: [pendingRow], total: 1, limit: 20 })
    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('.pending-accept-btn').trigger('click')
    expect(warningMock).toHaveBeenCalledTimes(1)
    expect(confirmFederationMock).not.toHaveBeenCalled()

    const options = warningMock.mock.calls[0]?.[0] as { onPositiveClick: () => Promise<void> }
    await options.onPositiveClick()
    await flushPromises()

    expect(confirmFederationMock).toHaveBeenCalledWith('pending.hs', true)
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.federation.confirmPendingSuccess', 'success')
  })

  it('asks for confirmation before rejecting a server', async () => {
    getPendingMock.mockResolvedValue({ servers: [pendingRow], total: 1, limit: 20 })
    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('.pending-reject-btn').trigger('click')
    const options = warningMock.mock.calls[0]?.[0] as { onPositiveClick: () => Promise<void> }
    await options.onPositiveClick()
    await flushPromises()

    expect(confirmFederationMock).toHaveBeenCalledWith('pending.hs', false)
  })

  it('reports failure when confirming throws', async () => {
    getPendingMock.mockResolvedValue({ servers: [pendingRow], total: 1, limit: 20 })
    confirmFederationMock.mockRejectedValue(new Error('confirm-fail'))
    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('.pending-accept-btn').trigger('click')
    const options = warningMock.mock.calls[0]?.[0] as { onPositiveClick: () => Promise<void> }
    await options.onPositiveClick()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.federation.confirmPendingFailed', 'error')
    expect(wrapper.text()).toContain('confirm-fail')
  })
})
