import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ReportScannerInfo from '../ReportScannerInfo.vue'

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const NButton = defineComponent({
    name: 'NButton',
    props: {
      size: { type: String, default: 'medium' },
      type: { type: String, default: 'default' },
      text: { type: Boolean, default: false }
    },
    setup(_, { slots }) {
      return () => h('button', { class: 'n-button', type: 'button' }, slots.default?.())
    }
  })

  const NAlert = defineComponent({
    name: 'NAlert',
    setup(_, { slots }) {
      return () => h('div', { class: 'n-alert' }, slots.default?.())
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
      return () => h('div', { class: 'n-descriptions-item' }, [props.label, ':', slots.default?.()])
    }
  })

  return { NAlert, NButton, NDescriptions, NDescriptionsItem }
})

const scannerInfo = {
  scanner_id: 'scanner-1',
  scan_result: 'spam',
  confidence: 0.92,
  scanned_at: 1700000000000
}

const mountInfo = (props: { info: typeof scannerInfo | null; loading: boolean; error: string | null }) =>
  mount(ReportScannerInfo, { props })

describe('ReportScannerInfo', () => {
  it('加载中显示加载态', () => {
    const wrapper = mountInfo({ info: null, loading: true, error: null })

    expect(wrapper.find('[data-testid="report-scanner-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="report-scanner-empty"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="report-scanner-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="report-scanner-fields"]').exists()).toBe(false)
  })

  it('无扫描信息时显示空态', () => {
    const wrapper = mountInfo({ info: null, loading: false, error: null })

    expect(wrapper.find('[data-testid="report-scanner-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="report-scanner-loading"]').exists()).toBe(false)
  })

  it('后端返回空对象时按空态展示', () => {
    const wrapper = mountInfo({
      info: { scanner_id: '', scan_result: '', confidence: 0, scanned_at: 0 },
      loading: false,
      error: null
    })

    expect(wrapper.find('[data-testid="report-scanner-empty"]').exists()).toBe(true)
  })

  it('错误态展示错误信息并可重试', async () => {
    const wrapper = mountInfo({ info: null, loading: false, error: 'boom' })

    expect(wrapper.find('[data-testid="report-scanner-error"]').text()).toContain('boom')
    await wrapper.find('[data-testid="report-scanner-retry"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('成功态渲染扫描器字段并支持刷新', async () => {
    const wrapper = mountInfo({ info: scannerInfo, loading: false, error: null })

    const fields = wrapper.find('[data-testid="report-scanner-fields"]')
    expect(fields.exists()).toBe(true)
    expect(fields.text()).toContain('scanner-1')
    expect(fields.text()).toContain('spam')
    expect(fields.text()).toContain('0.92')
    expect(fields.text()).toContain(new Date(1700000000000).toLocaleString())

    await wrapper.find('[data-testid="report-scanner-refresh"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
