import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StorageSettings from '../StorageSettings.vue'

const { checkQuotaMock, getQuotaStatsMock, getQuotaAlertsMock } = vi.hoisted(() => ({
  checkQuotaMock: vi.fn(),
  getQuotaStatsMock: vi.fn(),
  getQuotaAlertsMock: vi.fn()
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: {
    checkQuota: checkQuotaMock,
    getQuotaStats: getQuotaStatsMock,
    getQuotaAlerts: getQuotaAlertsMock
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

const mountTab = () =>
  mount(StorageSettings, {
    global: {
      stubs: { NDivider: true }
    }
  })

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

const usageOf = (used: number, limit: number) => ({ used, limit, remaining: Math.max(limit - used, 0) })

describe('StorageSettings 媒体配额', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkQuotaMock.mockResolvedValue(usageOf(512, 1024))
    getQuotaStatsMock.mockResolvedValue({ storageBytes: 512, mediaCount: 3, limitBytes: 0 })
    getQuotaAlertsMock.mockResolvedValue([])
  })

  it('配额读取完成前展示 loading 三态', async () => {
    let resolveUsage: ((value: unknown) => void) | undefined
    checkQuotaMock.mockReturnValue(
      new Promise((resolve) => {
        resolveUsage = resolve
      })
    )

    const wrapper = mountTab()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-test="quota-loading"]').exists()).toBe(true)

    resolveUsage?.(usageOf(512, 1024))
    await flush()

    expect(wrapper.find('[data-test="quota-stats"]').exists()).toBe(true)
  })

  it('展示已用、上限、剩余与媒体数量', async () => {
    const wrapper = mountTab()
    await flush()

    const stats = wrapper.find('[data-test="quota-stats"]')
    expect(stats.exists()).toBe(true)
    expect(stats.text()).toContain('1 KB')
    expect(wrapper.text()).toContain('setting.storage.quota_used')
    expect(wrapper.text()).toContain('setting.storage.quota_limit')
    expect(wrapper.text()).toContain('setting.storage.quota_remaining')
    expect(stats.text()).toContain('3')
  })

  it('checkQuota 返回 null 时降级为不可用', async () => {
    checkQuotaMock.mockResolvedValue(null)

    const wrapper = mountTab()
    await flush()

    expect(wrapper.find('[data-test="quota-unavailable"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="quota-stats"]').exists()).toBe(false)
  })

  it('checkQuota 抛错时同样降级且不阻断页面', async () => {
    checkQuotaMock.mockRejectedValue(new Error('quota-fail'))

    const wrapper = mountTab()
    await flush()

    expect(wrapper.find('[data-test="quota-unavailable"]').exists()).toBe(true)
  })

  it('剩余为 0 时展示超限提示', async () => {
    checkQuotaMock.mockResolvedValue(usageOf(1024, 1024))

    const wrapper = mountTab()
    await flush()

    expect(wrapper.find('[data-test="quota-exceeded"]').exists()).toBe(true)
  })

  it('有告警时展示告警列表', async () => {
    getQuotaAlertsMock.mockResolvedValue([
      {
        alert_id: 'a1',
        alert_type: 'quota_warning',
        threshold_percent: 80,
        current_usage_bytes: 800,
        quota_limit_bytes: 1000,
        message: '80% used',
        created_ts: 1,
        is_read: false
      }
    ])

    const wrapper = mountTab()
    await flush()

    const alerts = wrapper.find('[data-test="quota-alerts"]')
    expect(alerts.exists()).toBe(true)
    expect(alerts.text()).toContain('80% used')
    expect(alerts.text()).toContain('setting.storage.quota_alert_threshold')
    expect(wrapper.find('[data-test="quota-no-alerts"]').exists()).toBe(false)
  })

  it('无告警时展示空态', async () => {
    const wrapper = mountTab()
    await flush()

    expect(wrapper.find('[data-test="quota-no-alerts"]').exists()).toBe(true)
  })

  it('配额统计接口失败不影响配额主视图', async () => {
    getQuotaStatsMock.mockRejectedValue(new Error('stats-fail'))

    const wrapper = mountTab()
    await flush()

    const stats = wrapper.find('[data-test="quota-stats"]')
    expect(stats.exists()).toBe(true)
    expect(stats.text()).toContain('0')
  })
})
