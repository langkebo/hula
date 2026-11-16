import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import FederationCachePanel from '../FederationCachePanel.vue'

const {
  getFederationCacheMock,
  clearFederationCacheMock,
  deleteFederationCacheEntryMock,
  warningMock,
  showFeedbackMock
} = vi.hoisted(() => ({
  getFederationCacheMock: vi.fn(),
  clearFederationCacheMock: vi.fn(),
  deleteFederationCacheEntryMock: vi.fn(),
  warningMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {},
  adminFederationService: {
    getFederationCache: getFederationCacheMock,
    clearFederationCache: clearFederationCacheMock,
    deleteFederationCacheEntry: deleteFederationCacheEntryMock
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
    props: { type: String, size: String, ghost: Boolean, disabled: Boolean },
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
              { class: 'n-data-row', key: String(row.key ?? rowIndex) },
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
  return {
    NAlert,
    NButton,
    NDataTable,
    NEmpty,
    NSpin,
    useDialog: () => ({ warning: warningMock })
  }
})

function mountPanel() {
  return mount(FederationCachePanel)
}

describe('FederationCachePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getFederationCacheMock.mockResolvedValue({ entries: [], total: 0 })
    clearFederationCacheMock.mockResolvedValue(undefined)
    deleteFederationCacheEntryMock.mockResolvedValue(undefined)
  })

  it('loads cache entries on mount and renders rows', async () => {
    getFederationCacheMock.mockResolvedValue({
      entries: [{ key: 'room:!a', value: { foo: 'bar' }, expiryTs: 1700000000000 }],
      total: 1
    })
    const wrapper = mountPanel()
    await flushPromises()

    expect(getFederationCacheMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.n-data-row').exists()).toBe(true)
    expect(wrapper.text()).toContain('room:!a')
    expect(wrapper.find('[data-test="cache-empty"]').exists()).toBe(false)
  })

  it('renders empty state when there are no entries', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    expect(wrapper.find('[data-test="cache-empty"]').exists()).toBe(true)
  })

  it('renders error alert when loading fails', async () => {
    getFederationCacheMock.mockRejectedValue(new Error('cache-down'))
    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-test="cache-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('cache-down')
  })

  it('asks for confirmation before clearing the cache', async () => {
    getFederationCacheMock.mockResolvedValue({ entries: [{ key: 'k1', value: 1, expiryTs: null }], total: 1 })
    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-test="cache-clear"]').trigger('click')
    expect(warningMock).toHaveBeenCalledTimes(1)
    expect(clearFederationCacheMock).not.toHaveBeenCalled()

    const options = warningMock.mock.calls[0]?.[0] as { content: string; onPositiveClick: () => Promise<void> }
    expect(options.content).toBe('admin.federation.cacheClearConfirm')
    await options.onPositiveClick()
    await flushPromises()

    expect(clearFederationCacheMock).toHaveBeenCalledTimes(1)
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.federation.cacheCleared', 'success')
  })

  it('asks for confirmation before deleting a single entry', async () => {
    getFederationCacheMock.mockResolvedValue({ entries: [{ key: 'k1', value: 1, expiryTs: null }], total: 1 })
    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('.cache-delete-btn').trigger('click')
    expect(warningMock).toHaveBeenCalledTimes(1)
    expect(deleteFederationCacheEntryMock).not.toHaveBeenCalled()

    const options = warningMock.mock.calls[0]?.[0] as { onPositiveClick: () => Promise<void> }
    await options.onPositiveClick()
    await flushPromises()

    expect(deleteFederationCacheEntryMock).toHaveBeenCalledWith('k1')
  })

  it('reports a failure when clearing the cache throws', async () => {
    getFederationCacheMock.mockResolvedValue({ entries: [{ key: 'k1', value: 1, expiryTs: null }], total: 1 })
    clearFederationCacheMock.mockRejectedValue(new Error('clear-fail'))
    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-test="cache-clear"]').trigger('click')
    const options = warningMock.mock.calls[0]?.[0] as { onPositiveClick: () => Promise<void> }
    await options.onPositiveClick()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.federation.cacheClearFailed', 'error')
    expect(wrapper.text()).toContain('clear-fail')
  })
})
