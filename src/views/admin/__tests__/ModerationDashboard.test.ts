import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ModerationReport } from '../ModerationDashboard.vue'
import ModerationDashboard from '../ModerationDashboard.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string) =>
    defineComponent({
      name,
      props: ['type', 'size', 'bordered', 'disabled', 'show', 'description', 'animated', 'value', 'tab', 'name'],
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  return {
    NButton: defineComponent({
      name: 'NButton',
      inheritAttrs: false,
      props: {
        type: { type: String, default: 'default' },
        size: { type: String, default: 'medium' },
        disabled: { type: Boolean, default: false },
        quaternary: { type: Boolean, default: false }
      },
      emits: ['click'],
      setup(props, { slots, emit, attrs }) {
        return () =>
          h(
            'button',
            {
              type: 'button',
              'data-test': 'NButton',
              'data-action': (attrs['data-action'] as string) ?? '',
              disabled: props.disabled,
              onClick: () => emit('click')
            },
            slots.default?.()
          )
      }
    }),
    NTabs: defineComponent({
      name: 'NTabs',
      props: { value: { type: String, default: '' } },
      emits: ['update:value'],
      setup(props, { slots, emit }) {
        return () =>
          h(
            'div',
            {
              'data-test': 'NTabs',
              'data-value': props.value,
              role: 'tablist'
            },
            [
              slots.default?.(),
              h('input', {
                type: 'hidden',
                'data-test': 'NTabs-value',
                value: props.value,
                onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
              })
            ]
          )
      }
    }),
    NTabPane: defineComponent({
      name: 'NTabPane',
      props: { name: { type: String, default: '' }, tab: { type: String, default: '' } },
      setup(props, { slots }) {
        return () =>
          h('div', { 'data-test': 'NTabPane', 'data-name': props.name, 'data-tab': props.tab, role: 'tabpanel' }, [
            slots.default?.()
          ])
      }
    }),
    NList: passthrough('NList'),
    NListItem: passthrough('NListItem'),
    NTag: passthrough('NTag'),
    NSpin: passthrough('NSpin'),
    NEmpty: passthrough('NEmpty')
  }
})

const now = 1_700_000_000_000

const reports: ModerationReport[] = [
  {
    id: 'r1',
    reporter: '@alice:server.test',
    reportedEvent: '$event1:server.test',
    reason: 'moderation.report.reason_spam',
    timestamp: now,
    priority: 'high',
    status: 'pending'
  },
  {
    id: 'r2',
    reporter: '@bob:server.test',
    reportedEvent: '$event2:server.test',
    reason: 'moderation.report.reason_abuse',
    timestamp: now + 60_000,
    priority: 'normal',
    status: 'pending'
  },
  {
    id: 'r3',
    reporter: '@carol:server.test',
    reportedEvent: '$event3:server.test',
    reason: 'moderation.report.reason_inappropriate',
    timestamp: now + 120_000,
    priority: 'low',
    status: 'processing'
  },
  {
    id: 'r4',
    reporter: '@dave:server.test',
    reportedEvent: '$event4:server.test',
    reason: 'moderation.report.reason_other',
    timestamp: now + 180_000,
    priority: 'normal',
    status: 'resolved'
  }
]

const mountComponent = (props: Partial<{ reports: ModerationReport[]; loading: boolean }> = {}) =>
  mount(ModerationDashboard, {
    props: {
      reports: reports,
      loading: false,
      ...props
    }
  })

describe('ModerationDashboard — 审核工作台 (§8.10)', () => {
  it('渲染举报队列', () => {
    const wrapper = mountComponent()
    const items = wrapper.findAll('[data-test="NListItem"]')
    expect(items.length).toBeGreaterThan(0)
  })

  it('渲染三个 Tab（待处理/处理中/已解决）', () => {
    const wrapper = mountComponent()
    const panes = wrapper.findAll('[data-test="NTabPane"]')
    const names = panes.map((p) => p.attributes('data-name'))
    expect(names).toEqual(['pending', 'processing', 'resolved'])
  })

  it('每条举报显示举报人、被举报事件、原因、时间', () => {
    const wrapper = mountComponent({ reports: [reports[0]] })
    const text = wrapper.text()
    expect(text).toContain('@alice:server.test')
    expect(text).toContain('$event1:server.test')
    expect(text).toContain('moderation.report.reason_spam')
  })

  it('点击忽略按钮触发 action 事件（action=ignore）', async () => {
    const wrapper = mountComponent({ reports: [reports[0]] })
    const ignoreBtn = wrapper.findAll('[data-test="NButton"]').find((b) => b.attributes('data-action') === 'ignore')
    expect(ignoreBtn).toBeDefined()
    await ignoreBtn!.trigger('click')
    expect(wrapper.emitted('action')).toBeTruthy()
    expect(wrapper.emitted('action')?.[0]).toEqual(['r1', 'ignore'])
  })

  it('点击隐藏事件按钮触发 action 事件（action=hide）', async () => {
    const wrapper = mountComponent({ reports: [reports[0]] })
    const hideBtn = wrapper.findAll('[data-test="NButton"]').find((b) => b.attributes('data-action') === 'hide')
    expect(hideBtn).toBeDefined()
    await hideBtn!.trigger('click')
    expect(wrapper.emitted('action')?.[0]).toEqual(['r1', 'hide'])
  })

  it('点击封禁用户按钮触发 action 事件（action=ban）', async () => {
    const wrapper = mountComponent({ reports: [reports[0]] })
    const banBtn = wrapper.findAll('[data-test="NButton"]').find((b) => b.attributes('data-action') === 'ban')
    expect(banBtn).toBeDefined()
    await banBtn!.trigger('click')
    expect(wrapper.emitted('action')?.[0]).toEqual(['r1', 'ban'])
  })

  it('空队列时显示空状态', () => {
    const wrapper = mountComponent({ reports: [] })
    expect(wrapper.find('[data-test="NEmpty"]').exists()).toBe(true)
  })

  it('loading=true 时显示加载状态', () => {
    const wrapper = mountComponent({ loading: true })
    expect(wrapper.find('[data-test="NSpin"]').exists()).toBe(true)
  })

  it('高优先级举报使用 danger 色标识', () => {
    const wrapper = mountComponent({ reports: [reports[0]] })
    const item = wrapper.find('[data-test="report-item"]')
    expect(item.exists()).toBe(true)
    const style = item.attributes('style') ?? ''
    expect(style).toContain('--tjg-color-danger-100')
  })

  it('组件有 role=region 可访问性属性', () => {
    const wrapper = mountComponent()
    const region = wrapper.find('.moderation-dashboard')
    expect(region.exists()).toBe(true)
    expect(region.attributes('role')).toBe('region')
  })
})
