import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminTelemetry from '../AdminTelemetry.vue'

const { telemetryMock } = vi.hoisted(() => ({
  telemetryMock: {
    getStatus: vi.fn(),
    getHealth: vi.fn(),
    getMetricsSummary: vi.fn(),
    listAlerts: vi.fn(),
    getResourceAttributes: vi.fn(),
    acknowledgeAlert: vi.fn()
  }
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: { telemetry: telemetryMock }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      props: ['title', 'subtitle', 'type', 'description', 'column', 'labelPlacement', 'size', 'bordered', 'showIcon'],
      setup(props, { slots }) {
        return () =>
          h(tag, { 'data-test': name }, [
            props.title ? h('span', String(props.title)) : null,
            props.description ? h('span', String(props.description)) : null,
            slots.default?.(),
            slots.extra?.()
          ])
      }
    })

  return {
    useDialog: () => ({ warning: vi.fn() }),
    NAlert: passthrough('NAlert'),
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NDataTable: defineComponent({
      name: 'NDataTable',
      props: ['data', 'columns', 'bordered', 'loading', 'pagination', 'rowKey', 'scrollX', 'size'],
      setup(props) {
        return () =>
          h('div', { 'data-test': 'NDataTable' }, [
            h(
              'div',
              { 'data-test': 'NDataTable-columns' },
              ((props.columns ?? []) as Array<{ title?: string }>).map((column) => String(column.title)).join(',')
            ),
            h('div', { 'data-test': 'NDataTable-rows' }, JSON.stringify(props.data ?? []))
          ])
      }
    }),
    NDescriptions: passthrough('NDescriptions'),
    NDescriptionsItem: passthrough('NDescriptionsItem'),
    NEmpty: passthrough('NEmpty'),
    NPageHeader: passthrough('NPageHeader'),
    NSpin: passthrough('NSpin'),
    NTag: passthrough('NTag')
  }
})

describe('AdminTelemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    telemetryMock.getStatus.mockResolvedValue({
      enabled: true,
      trace_enabled: false,
      metrics_enabled: true,
      service_name: 'synapse-rust',
      service_version: '1.0.0',
      sampling_ratio: 0.25,
      export_config: {
        otlp_endpoint: null,
        prometheus_port: 9000,
        prometheus_path: '/metrics',
        batch_export: false
      }
    })
    telemetryMock.getHealth.mockResolvedValue({ status: 'ok', alerts: [] })
    telemetryMock.getMetricsSummary.mockResolvedValue({
      total_metrics: 12,
      total_counters: 8,
      total_gauges: 3,
      total_histograms: 1,
      rendered_bytes: 2048,
      snapshot_ts: 1_700_000_000,
      appservice_scheduler: null
    })
    telemetryMock.listAlerts.mockResolvedValue([])
    telemetryMock.getResourceAttributes.mockResolvedValue({ attributes: {} })
  })

  it('能力未启用时显示降级提示而非错误', async () => {
    telemetryMock.getStatus.mockResolvedValue(null)
    telemetryMock.getMetricsSummary.mockResolvedValue(null)

    const wrapper = mount(AdminTelemetry)
    await flushPromises()

    expect(wrapper.text()).toContain('telemetry.unavailable.title')
    expect(wrapper.text()).toContain('telemetry.unavailable.description')
    expect(wrapper.find('[data-test="NDataTable"]').exists()).toBe(false)
  })

  it('能力可用时渲染状态与指标摘要', async () => {
    const wrapper = mount(AdminTelemetry)
    await flushPromises()

    expect(wrapper.text()).toContain('synapse-rust')
    expect(wrapper.text()).toContain('1.0.0')
    expect(wrapper.text()).toContain('25%')
    expect(wrapper.text()).toContain(':9000/metrics')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.find('[data-test="NDataTable"]').exists()).toBe(true)
  })

  it('刷新按钮触发重新加载', async () => {
    const wrapper = mount(AdminTelemetry)
    await flushPromises()

    const refresh = wrapper.findAll('button').find((button) => button.text() === 'common.refresh')
    expect(refresh).toBeDefined()
    await refresh!.trigger('click')
    await flushPromises()

    expect(telemetryMock.getStatus).toHaveBeenCalledTimes(2)
  })

  it('补齐渲染调度器新增计数、健康检查明细与告警字段', async () => {
    telemetryMock.getHealth.mockResolvedValue({
      status: 'ok',
      service: 'synapse-rust',
      checks: { storage: 'healthy' },
      database: { pool_size: 42 },
      alerts: []
    })
    telemetryMock.getMetricsSummary.mockResolvedValue({
      total_metrics: 12,
      total_counters: 8,
      total_gauges: 3,
      total_histograms: 1,
      rendered_bytes: 2048,
      snapshot_ts: 1_700_000_000,
      appservice_scheduler: {
        total_services: 1,
        scheduler_available_services: 1,
        services_in_backoff: 0,
        services_capacity_limited: 21,
        services_with_pending_transactions: 22,
        total_pending_events: 0,
        total_pending_transactions: 0,
        total_success_count: 0,
        total_failure_count: 0,
        total_backoff_count: 23,
        total_capacity_limited_count: 24,
        total_in_flight_count: 25
      }
    })
    telemetryMock.listAlerts.mockResolvedValue([
      {
        alert_id: 'alert-1',
        alert_key: 'scheduler.backoff',
        rule_name: 'SchedulerBackoff',
        severity: 'warning',
        status: 'firing',
        owner: 'ops',
        message: 'backoff detected',
        trigger_count: 7,
        triggered_at: 1_700_000_000,
        last_seen_ts: 1_700_000_100,
        acknowledged_at: null,
        acknowledged_by: null,
        recovered_at: null,
        closed_at: null,
        metrics: {}
      }
    ])

    const wrapper = mount(AdminTelemetry)
    await flushPromises()

    const text = wrapper.text()
    for (const value of ['21', '22', '23', '24', '25']) {
      expect(text).toContain(value)
    }
    expect(text).toContain('healthy')
    expect(text).toContain('42')

    const columns = wrapper.find('[data-test="NDataTable-columns"]').text()
    expect(columns).toContain('telemetry.alerts.col_owner')
    expect(columns).toContain('telemetry.alerts.col_count')
    expect(columns).toContain('telemetry.alerts.col_last_seen')
    expect(wrapper.find('[data-test="NDataTable-rows"]').text()).toContain('ops')
  })
})
