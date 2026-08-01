import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminTelemetry from '../AdminTelemetry.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (!params) return key
      return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), key)
    }
  })
}))

const { getStatusMock, getMetricsSummaryMock, listAlertsMock, acknowledgeAlertMock } = vi.hoisted(() => ({
  getStatusMock: vi.fn(),
  getMetricsSummaryMock: vi.fn(),
  listAlertsMock: vi.fn(),
  acknowledgeAlertMock: vi.fn()
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    telemetry: {
      getStatus: (...args: unknown[]) => getStatusMock(...args),
      getMetricsSummary: (...args: unknown[]) => getMetricsSummaryMock(...args),
      listAlerts: (...args: unknown[]) => listAlertsMock(...args),
      acknowledgeAlert: (...args: unknown[]) => acknowledgeAlertMock(...args)
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

const SelectStub = {
  template:
    '<select class="n-select" v-bind="$attrs" @change="onChange"><option value="">all</option><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>',
  props: {
    options: { type: Array, default: () => [] },
    modelValue: { type: [String, Number, null], default: null },
    placeholder: { type: String, default: '' },
    size: { type: String, default: '' },
    clearable: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'update:value'],
  inheritAttrs: false,
  setup(_props: unknown, { emit }: { emit: (event: string, ...args: unknown[]) => void }) {
    const onChange = (e: Event) => {
      const value = (e.target as HTMLSelectElement).value
      emit('update:value', value || null)
    }
    return { onChange }
  }
}

const naiveStubs = {
  PageHeader: {
    template: '<div class="n-page-header"><slot name="extra" /><slot /></div>',
    props: ['title', 'subtitle']
  },
  Button: ButtonStub,
  Card: {
    template:
      '<div class="n-card"><div class="n-card-title">{{ title }}</div><slot name="header-extra" /><slot /></div>',
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
  Select: SelectStub
}

const makeStatus = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  trace_enabled: false,
  metrics_enabled: true,
  service_name: 'synapse-rust',
  service_version: '0.1.0',
  sampling_ratio: 0.1,
  export_config: {
    otlp_endpoint: null,
    prometheus_port: 9090,
    prometheus_path: '/metrics',
    batch_export: true
  },
  ...overrides
})

const makeMetrics = (overrides: Record<string, unknown> = {}) => ({
  total_metrics: 42,
  total_counters: 20,
  total_gauges: 15,
  total_histograms: 7,
  rendered_bytes: 4096,
  snapshot_ts: 1700000000000,
  appservice_scheduler: {
    total_services: 2,
    scheduler_available_services: 2,
    services_in_backoff: 0,
    services_capacity_limited: 0,
    services_with_pending_transactions: 0,
    total_pending_events: 0,
    total_pending_transactions: 0,
    total_success_count: 100,
    total_failure_count: 5,
    total_backoff_count: 0,
    total_capacity_limited_count: 0,
    total_in_flight_count: 0
  },
  ...overrides
})

const makeAlert = (overrides: Record<string, unknown> = {}) => ({
  alert_id: 'alert-1',
  alert_key: 'db_health',
  rule_name: 'Database health',
  severity: 'critical',
  status: 'firing',
  owner: 'database',
  message: 'database health check returned unhealthy',
  trigger_count: 1,
  triggered_at: 1700000000000,
  last_seen_ts: 1700000000000,
  acknowledged_at: null,
  acknowledged_by: null,
  recovered_at: null,
  closed_at: null,
  metrics: {},
  ...overrides
})

describe('AdminTelemetry — P1-2 遥测监控面板', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStatusMock.mockReset()
    getMetricsSummaryMock.mockReset()
    listAlertsMock.mockReset()
    acknowledgeAlertMock.mockReset()
    showFeedbackMock.mockReset()
  })

  const mountPanel = async () => {
    if (getStatusMock.getMockImplementation() === undefined) {
      getStatusMock.mockResolvedValue(makeStatus())
    }
    if (getMetricsSummaryMock.getMockImplementation() === undefined) {
      getMetricsSummaryMock.mockResolvedValue(makeMetrics())
    }
    if (listAlertsMock.getMockImplementation() === undefined) {
      listAlertsMock.mockResolvedValue([])
    }
    const wrapper = mount(AdminTelemetry, {
      global: { stubs: naiveStubs }
    })
    await flushPromises()
    return wrapper
  }

  it('挂载时加载状态、指标和告警', async () => {
    await mountPanel()
    expect(getStatusMock).toHaveBeenCalled()
    expect(getMetricsSummaryMock).toHaveBeenCalled()
    expect(listAlertsMock).toHaveBeenCalledWith(expect.objectContaining({ refresh: true }))
  })

  it('展示遥测状态卡片，包含 service_name / service_version / sampling_ratio', async () => {
    const wrapper = await mountPanel()
    const text = wrapper.text()
    expect(text).toContain('telemetry.status.service_name')
    expect(text).toContain('telemetry.status.service_version')
    expect(text).toContain('telemetry.status.sampling_ratio')
  })

  it('展示指标摘要卡片，包含 total_metrics / total_counters', async () => {
    const wrapper = await mountPanel()
    const text = wrapper.text()
    expect(text).toContain('telemetry.metrics.total_metrics')
    expect(text).toContain('telemetry.metrics.total_counters')
  })

  it('展示 Appservice 调度器摘要卡片', async () => {
    const wrapper = await mountPanel()
    expect(wrapper.text()).toContain('telemetry.scheduler.title')
    expect(wrapper.text()).toContain('telemetry.scheduler.total_services')
  })

  it('点击刷新按钮重新加载所有数据', async () => {
    const wrapper = await mountPanel()
    expect(getStatusMock.mock.calls.length).toBe(1)
    await wrapper.find('[data-testid="refresh-btn"]').trigger('click')
    await flushPromises()
    expect(getStatusMock.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('告警列表为空时显示空状态', async () => {
    listAlertsMock.mockResolvedValue([])
    const wrapper = await mountPanel()
    const empties = wrapper.findAll('.n-empty')
    expect(empties.length).toBeGreaterThan(0)
  })

  it('告警列表展示告警条目，包括严重程度、规则名和消息', async () => {
    listAlertsMock.mockResolvedValue([makeAlert()])
    const wrapper = await mountPanel()
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('Database health')
    expect(text).toContain('database health check returned unhealthy')
    expect(text).toContain('critical')
  })

  it('点击确认告警按钮调用 acknowledgeAlert 并刷新反馈', async () => {
    listAlertsMock.mockResolvedValue([makeAlert({ status: 'firing' })])
    acknowledgeAlertMock.mockResolvedValue(makeAlert({ status: 'acknowledged', acknowledged_by: '@admin:matrix.test' }))
    const wrapper = await mountPanel()
    await flushPromises()

    const ackBtn = wrapper.find('[data-testid="ack-btn"]')
    expect(ackBtn.exists()).toBe(true)
    await ackBtn.trigger('click')
    await flushPromises()

    expect(acknowledgeAlertMock).toHaveBeenCalledWith('alert-1')
    expect(showFeedbackMock).toHaveBeenCalledWith('telemetry.feedback.ack_success', 'success')
  })

  it('已确认状态的告警不展示确认按钮', async () => {
    listAlertsMock.mockResolvedValue([makeAlert({ status: 'acknowledged', acknowledged_by: '@admin:matrix.test' })])
    const wrapper = await mountPanel()
    await flushPromises()
    expect(wrapper.find('[data-testid="ack-btn"]').exists()).toBe(false)
  })

  it('状态过滤改变后重新加载告警', async () => {
    const wrapper = await mountPanel()
    expect(listAlertsMock.mock.calls.length).toBe(1)
    await wrapper.find('[data-testid="filter-status"]').setValue('firing')
    await flushPromises()
    expect(listAlertsMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    const lastCallArgs = listAlertsMock.mock.calls[listAlertsMock.mock.calls.length - 1][0]
    expect(lastCallArgs.status).toBe('firing')
  })

  it('严重程度过滤改变后重新加载告警', async () => {
    const wrapper = await mountPanel()
    expect(listAlertsMock.mock.calls.length).toBe(1)
    await wrapper.find('[data-testid="filter-severity"]').setValue('critical')
    await flushPromises()
    expect(listAlertsMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    const lastCallArgs = listAlertsMock.mock.calls[listAlertsMock.mock.calls.length - 1][0]
    expect(lastCallArgs.severity).toBe('critical')
  })

  it('确认告警失败时显示错误反馈', async () => {
    listAlertsMock.mockResolvedValue([makeAlert({ status: 'firing' })])
    acknowledgeAlertMock.mockRejectedValue(new Error('boom'))
    const wrapper = await mountPanel()
    await flushPromises()
    await wrapper.find('[data-testid="ack-btn"]').trigger('click')
    await flushPromises()
    expect(showFeedbackMock).toHaveBeenCalledWith('telemetry.feedback.ack_failed', 'error')
  })

  it('加载状态为 null 时显示空状态', async () => {
    getStatusMock.mockResolvedValue(null)
    getMetricsSummaryMock.mockResolvedValue(null)
    listAlertsMock.mockResolvedValue([])
    const wrapper = await mountPanel()
    const empties = wrapper.findAll('.n-empty')
    expect(empties.length).toBeGreaterThan(0)
  })
})
