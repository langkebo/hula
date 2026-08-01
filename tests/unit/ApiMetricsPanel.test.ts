/**
 * Task 19: 性能指标接入设置页诊断面板
 *
 * 测试对象：DiagnosticsPanel 组件（消费 useApiMetrics composable）。
 * 覆盖：
 * - 至少渲染 7 项诊断指标
 * - 重试率异常时显示告警
 * - 重试率正常时不显示告警
 * - 点击重置按钮调用 reset()
 */
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mockGetMetricsSnapshot = vi.fn()
const mockReset = vi.fn()

vi.mock('@/composables/useApiMetrics', () => ({
  useApiMetrics: () => ({
    getMetricsSnapshot: mockGetMetricsSnapshot,
    reset: mockReset,
    recordApiCall: vi.fn(),
    recordSync: vi.fn(),
    recordReplay: vi.fn(),
    recordRetry: vi.fn()
  })
}))

import DiagnosticsPanel from '@/components/settings/DiagnosticsPanel.vue'

const NORMAL_SNAPSHOT = {
  apiCalls: {},
  slidingSync: { count: 0, avgDurationMs: 0 },
  offlineReplay: { totalCount: 0, successCount: 0, successRate: 0 },
  retryRate: 0,
  isRetryRateAbnormal: false
}

const stubs = {
  NCard: { template: '<div><slot/></div>' },
  NStatistic: { template: '<div data-testid="metric-stat"><slot/></div>' },
  NGrid: { template: '<div><slot/></div>' },
  NGi: { template: '<div><slot/></div>' },
  NAlert: { template: '<div data-testid="retry-warning"><slot/></div>' },
  NButton: {
    template: '<button data-testid="reset-btn" @click="$emit(\'click\')"><slot/></button>'
  }
}

describe('ApiMetrics diagnostic panel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGetMetricsSnapshot.mockReset()
    mockReset.mockReset()
    mockGetMetricsSnapshot.mockReturnValue({ ...NORMAL_SNAPSHOT })
  })

  it('renders at least 7 metric statistics', () => {
    const wrapper = mount(DiagnosticsPanel, { global: { stubs } })
    const metrics = wrapper.findAll('[data-testid="metric-stat"]')
    expect(metrics.length).toBeGreaterThanOrEqual(7)
  })

  it('shows retry rate warning when isRetryRateAbnormal is true', () => {
    mockGetMetricsSnapshot.mockReturnValue({
      ...NORMAL_SNAPSHOT,
      retryRate: 0.25,
      isRetryRateAbnormal: true
    })
    const wrapper = mount(DiagnosticsPanel, { global: { stubs } })
    expect(wrapper.find('[data-testid="retry-warning"]').exists()).toBe(true)
  })

  it('hides retry rate warning when isRetryRateAbnormal is false', () => {
    mockGetMetricsSnapshot.mockReturnValue({
      ...NORMAL_SNAPSHOT,
      retryRate: 0.05,
      isRetryRateAbnormal: false
    })
    const wrapper = mount(DiagnosticsPanel, { global: { stubs } })
    expect(wrapper.find('[data-testid="retry-warning"]').exists()).toBe(false)
  })

  it('calls reset when reset button is clicked', async () => {
    const wrapper = mount(DiagnosticsPanel, { global: { stubs } })
    await wrapper.find('[data-testid="reset-btn"]').trigger('click')
    expect(mockReset).toHaveBeenCalledTimes(1)
  })
})
