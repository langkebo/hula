import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import MediaQuotaPanel from '../MediaQuotaPanel.vue'

const { checkQuotaMock, getQuotaStatsMock, getQuotaAlertsMock, getServerQuotaMock } = vi.hoisted(() => ({
  checkQuotaMock: vi.fn(),
  getQuotaStatsMock: vi.fn(),
  getQuotaAlertsMock: vi.fn(),
  getServerQuotaMock: vi.fn()
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    checkQuota: checkQuotaMock,
    getQuotaStats: getQuotaStatsMock,
    getQuotaAlerts: getQuotaAlertsMock,
    getServerQuota: getServerQuotaMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('naive-ui', () => {
  const NAlert = defineComponent({
    name: 'NAlert',
    props: { title: String, type: String },
    setup(props, { slots }) {
      return () => h('div', { class: 'n-alert' }, [h('span', props.title), slots.default?.()])
    }
  })
  const NButton = defineComponent({
    name: 'NButton',
    props: { loading: Boolean, size: String },
    emits: ['click'],
    setup(_, { slots, emit }) {
      return () => h('button', { class: 'n-button', onClick: () => emit('click') }, slots.default?.())
    }
  })
  const NEmpty = defineComponent({
    name: 'NEmpty',
    props: { description: String },
    setup(props) {
      return () => h('div', { class: 'n-empty' }, props.description)
    }
  })
  const NProgress = defineComponent({
    name: 'NProgress',
    props: { percentage: Number, status: String, showIndicator: Boolean },
    setup(props) {
      return () =>
        h('div', {
          class: 'n-progress',
          'data-percentage': String(props.percentage),
          'data-status': String(props.status)
        })
    }
  })
  const NTag = defineComponent({
    name: 'NTag',
    props: { type: String, size: String },
    setup(_, { slots }) {
      return () => h('span', { class: 'n-tag' }, slots.default?.())
    }
  })
  return { NAlert, NButton, NEmpty, NProgress, NTag }
})

function mountPanel() {
  return mount(MediaQuotaPanel, {
    global: {
      plugins: [createPinia()],
      stubs: { AdminStatCard: true }
    }
  })
}

describe('MediaQuotaPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkQuotaMock.mockResolvedValue(null)
    getQuotaStatsMock.mockResolvedValue(null)
    getQuotaAlertsMock.mockResolvedValue([])
    getServerQuotaMock.mockResolvedValue(null)
  })

  it('loads quota data on mount and renders empty states', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    expect(checkQuotaMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-test="quota-status-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="quota-alerts-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="quota-stat-storage"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="quota-server-defaults"]').exists()).toBe(false)
  })

  it('shows an unavailable hint instead of the empty state when alerts fail to load', async () => {
    getQuotaAlertsMock.mockRejectedValue(new Error('alerts failed'))

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-test="quota-alerts-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="quota-alerts-empty"]').exists()).toBe(false)
  })

  it('renders usage, server quota and alerts', async () => {
    checkQuotaMock.mockResolvedValue({ used: 1024, limit: 2048, remaining: 1024, percentage: 50, exceeded: false })
    getQuotaStatsMock.mockResolvedValue({ storageBytes: 1024, mediaCount: 3, limitBytes: 4096 })
    getServerQuotaMock.mockResolvedValue({
      totalSize: 8192,
      totalCount: 7,
      defaultSizeLimit: 1048576,
      defaultCountLimit: 100
    })
    getQuotaAlertsMock.mockResolvedValue([
      {
        alert_id: 'a1',
        alert_type: 'quota_warning',
        threshold_percent: 80,
        current_usage_bytes: 900,
        quota_limit_bytes: 1000,
        message: 'usage is high',
        created_ts: Date.now(),
        is_read: false
      },
      {
        alert_id: 'a2',
        alert_type: 'quota_exceeded',
        threshold_percent: 100,
        current_usage_bytes: 1100,
        quota_limit_bytes: 1000,
        message: 'usage exceeded',
        created_ts: Date.now(),
        is_read: false
      }
    ])

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-test="quota-status"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="quota-usage"]').text()).toContain('1 KB')
    expect(wrapper.find('[data-test="quota-state-label"]').text()).toBe('admin.media.quota.state.normal')
    expect(wrapper.find('[data-test="quota-stat-storage"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="quota-stat-count"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="quota-stat-server-size"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="quota-stat-server-count"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="quota-server-defaults"]').exists()).toBe(true)
    expect(wrapper.findAll('.media-quota-panel__alert-item')).toHaveLength(2)
    expect(wrapper.find('[data-test="quota-alerts-empty"]').exists()).toBe(false)
  })

  it('marks exceeded quota in text and clamps the progress bar', async () => {
    checkQuotaMock.mockResolvedValue({ used: 150, limit: 100, remaining: 0, percentage: 150, exceeded: true })

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-test="quota-state-label"]').text()).toBe('admin.media.quota.state.exceeded')
    const progress = wrapper.find('[data-test="quota-progress"]')
    expect(progress.attributes('data-percentage')).toBe('100')
    expect(progress.attributes('data-status')).toBe('error')
  })

  it('refetches quota data when the refresh button is clicked', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    checkQuotaMock.mockClear()

    await wrapper.find('[data-test="quota-refresh"]').trigger('click')
    await flushPromises()

    expect(checkQuotaMock).toHaveBeenCalledTimes(1)
  })
})
