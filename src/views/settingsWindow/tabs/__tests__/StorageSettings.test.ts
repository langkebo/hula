import { mount } from '@vue/test-utils'
import { NDialogProvider } from 'naive-ui'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { makeQuotaAlertsUnavailable } from '@/services/matrix/media/__tests__/fixtures/quota'
import StorageSettings from '../StorageSettings.vue'

const {
  checkQuotaMock,
  getQuotaStatsMock,
  getQuotaAlertsMock,
  getMediaConfigMock,
  getAuthenticatedMediaConfigMock,
  applyMediaUploadPreferencesMock
} = vi.hoisted(() => ({
  checkQuotaMock: vi.fn(),
  getQuotaStatsMock: vi.fn(),
  getQuotaAlertsMock: vi.fn(),
  getMediaConfigMock: vi.fn(),
  getAuthenticatedMediaConfigMock: vi.fn(),
  applyMediaUploadPreferencesMock: vi.fn()
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: {
    checkQuota: checkQuotaMock,
    getQuotaStats: getQuotaStatsMock,
    getQuotaAlerts: getQuotaAlertsMock,
    getMediaConfig: getMediaConfigMock,
    getAuthenticatedMediaConfig: getAuthenticatedMediaConfigMock
  }
}))

vi.mock('@/services/matrix/media/mediaUploadPreferences', () => ({
  applyMediaUploadPreferences: applyMediaUploadPreferencesMock
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

const mountTab = () =>
  mount(
    {
      render: () => h(NDialogProvider, null, { default: () => h(StorageSettings) })
    },
    {
      global: {
        plugins: [createPinia()],
        stubs: { NDivider: true }
      }
    }
  )

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

const usageOf = (used: number, limit: number) => ({ used, limit, remaining: Math.max(limit - used, 0) })

describe('StorageSettings 媒体配额', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    checkQuotaMock.mockResolvedValue(usageOf(512, 1024))
    getQuotaStatsMock.mockResolvedValue({ ok: true, stats: { storageBytes: 512, mediaCount: 3, limitBytes: 0 } })
    getQuotaAlertsMock.mockResolvedValue({ ok: true, alerts: [] })
    getMediaConfigMock.mockResolvedValue({ 'm.upload.size': 2048 })
    getAuthenticatedMediaConfigMock.mockResolvedValue({ authenticated_media: false })
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

  it('接口返回 limit<=0（字段缺失折算）时视为不可用，而不是展示 0', async () => {
    checkQuotaMock.mockResolvedValue({ used: 0, limit: 0, remaining: 0 })

    const wrapper = mountTab()
    await flush()

    expect(wrapper.find('[data-test="quota-unavailable"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="quota-stats"]').exists()).toBe(false)
  })

  it('配额区提供本地缓存清理入口', async () => {
    const wrapper = mountTab()
    await flush()

    expect(wrapper.find('[data-test="clear-local-cache"]').exists()).toBe(true)
  })

  it('剩余为 0 时展示超限提示', async () => {
    checkQuotaMock.mockResolvedValue(usageOf(1024, 1024))

    const wrapper = mountTab()
    await flush()

    expect(wrapper.find('[data-test="quota-exceeded"]').exists()).toBe(true)
  })

  it('有告警时展示告警列表', async () => {
    getQuotaAlertsMock.mockResolvedValue({
      ok: true,
      alerts: [
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
      ]
    })

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
    getQuotaStatsMock.mockResolvedValue({ ok: false, reason: 'unavailable' })

    const wrapper = mountTab()
    await flush()

    const stats = wrapper.find('[data-test="quota-stats"]')
    expect(stats.exists()).toBe(true)
    // 取不到媒体数量就显示占位符，不把失败画成 0
    expect(stats.text()).toContain('—')
  })
})

describe('StorageSettings 媒体服务配置与上传策略', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    checkQuotaMock.mockResolvedValue(usageOf(512, 1024))
    getQuotaStatsMock.mockResolvedValue({ ok: true, stats: { storageBytes: 512, mediaCount: 3, limitBytes: 0 } })
    getQuotaAlertsMock.mockResolvedValue({ ok: true, alerts: [] })
    getMediaConfigMock.mockResolvedValue({ 'm.upload.size': 2048 })
    getAuthenticatedMediaConfigMock.mockResolvedValue({ authenticated_media: false })
  })

  it('展示服务端上传上限与认证媒体状态', async () => {
    const wrapper = mountTab()
    await flush()

    expect(wrapper.find('[data-test="media-upload-limit"]').text()).toContain('2 KB')
    expect(wrapper.find('[data-test="media-auth-status"]').text()).toContain('setting.storage.auth_disabled')
  })

  it('认证媒体开启时展示已启用', async () => {
    getAuthenticatedMediaConfigMock.mockResolvedValue({ authenticated_media: true })

    const wrapper = mountTab()
    await flush()

    expect(wrapper.find('[data-test="media-auth-status"]').text()).toContain('setting.storage.auth_enabled')
  })

  it('读取不到媒体配置时降级为不可用', async () => {
    getMediaConfigMock.mockRejectedValue(new Error('media-config-fail'))

    const wrapper = mountTab()
    await flush()

    expect(wrapper.find('[data-test="media-config-unavailable"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="media-upload-limit"]').exists()).toBe(false)
  })

  it('渲染压缩与分块上传开关', async () => {
    const wrapper = mountTab()
    await flush()

    expect(wrapper.find('[data-test="upload-compress-switch"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="upload-chunk-switch"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="upload-quality-select"]').exists()).toBe(true)
  })
})

/**
 * 配额统计 / 告警 / 认证媒体开关此前失败后分别退化成「0 项」「暂无告警」
 * 「未启用」，把读取失败谎报成确定值。以下用例锁定 partial 态与占位显示。
 */
describe('StorageSettings — partial 态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    checkQuotaMock.mockResolvedValue(usageOf(512, 1024))
    getQuotaStatsMock.mockResolvedValue({ ok: true, stats: { storageBytes: 512, mediaCount: 3, limitBytes: 0 } })
    getQuotaAlertsMock.mockResolvedValue({ ok: true, alerts: [] })
    getMediaConfigMock.mockResolvedValue({ 'm.upload.size': 2048 })
    getAuthenticatedMediaConfigMock.mockResolvedValue({ authenticated_media: false })
  })

  it('配额统计与告警读取失败时展示 partial 态', async () => {
    getQuotaStatsMock.mockRejectedValue(new Error('stats-fail'))
    // 告警接口失败时返回 `ok: false` 而不是空数组：不能画成「暂无告警」
    getQuotaAlertsMock.mockResolvedValue({ ok: false, reason: 'unavailable' })

    const wrapper = mountTab()
    await flush()

    const banner = wrapper.find('[data-testid="partial-state"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('common.partial_load_failed')
  })

  it('认证媒体配置失败时展示占位符而不是「未启用」', async () => {
    getAuthenticatedMediaConfigMock.mockRejectedValue(new Error('auth-fail'))

    const wrapper = mountTab()
    await flush()

    expect(wrapper.find('[data-testid="partial-state"]').exists()).toBe(true)
    const auth = wrapper.find('[data-test="media-auth-status"]')
    expect(auth.text()).not.toContain('setting.storage.auth_disabled')
    expect(auth.text()).toContain('-')
  })

  it('全部读取成功时不展示 partial 态', async () => {
    const wrapper = mountTab()
    await flush()

    expect(wrapper.find('[data-testid="partial-state"]').exists()).toBe(false)
  })

  it('点击重试会重新拉取配额与媒体配置', async () => {
    getQuotaAlertsMock.mockResolvedValueOnce(makeQuotaAlertsUnavailable())

    const wrapper = mountTab()
    await flush()
    expect(wrapper.find('[data-testid="partial-state"]').exists()).toBe(true)

    checkQuotaMock.mockClear()
    getQuotaStatsMock.mockClear()
    getQuotaAlertsMock.mockClear()
    getMediaConfigMock.mockClear()
    getAuthenticatedMediaConfigMock.mockClear()

    await wrapper.find('[data-testid="partial-retry"]').trigger('click')
    await flush()

    expect(checkQuotaMock).toHaveBeenCalledTimes(1)
    expect(getQuotaStatsMock).toHaveBeenCalledTimes(1)
    expect(getMediaConfigMock).toHaveBeenCalledTimes(1)
    expect(getAuthenticatedMediaConfigMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="partial-state"]').exists()).toBe(false)
  })
})
