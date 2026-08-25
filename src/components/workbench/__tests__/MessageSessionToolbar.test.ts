import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { WorkbenchSessionTypeFilter } from '@/router/spaceNavigation'
import MessageSessionToolbar from '../MessageSessionToolbar.vue'

// 自定义 naive-ui stub：NButton 渲染真实 button（保留 class 与 click），其余透传 div
vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup:
        (_, { slots }) =>
        () =>
          h('div', { class: `n-${name.toLowerCase()}` }, [slots.default?.()])
    })
  const NButtonStub = defineComponent({
    name: 'NButton',
    props: { type: String, size: String, quaternary: Boolean, circle: Boolean },
    emits: ['click'],
    setup:
      (_, { slots, attrs, emit }) =>
      () =>
        h('button', { ...attrs, onClick: (e: Event) => emit('click', e) }, [slots.default?.()])
  })
  const NBadgeStub = defineComponent({
    name: 'NBadge',
    props: { value: { type: Number, default: 0 }, max: { type: Number, default: 99 } },
    setup:
      (props, { slots }) =>
      () =>
        h('div', { class: 'n-nbadge', 'data-value': String(props.value) }, [
          slots.default?.(),
          h('span', { class: 'n-badge-sup' }, [String(props.value)])
        ])
  })
  return {
    NButton: NButtonStub,
    NFlex: passthrough('NFlex'),
    NInput: passthrough('NInput'),
    NDivider: passthrough('NDivider'),
    NIcon: passthrough('NIcon'),
    NBadge: NBadgeStub
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: 'zh-CN' }
  })
}))

const mountToolbar = (props: Partial<{ sessionTypeFilter: WorkbenchSessionTypeFilter; hiddenCount: number }> = {}) =>
  mount(MessageSessionToolbar, {
    props: {
      searchKeyword: '',
      sessionTypeFilter: 'all' as WorkbenchSessionTypeFilter,
      sessionEngagementFilter: 'all',
      sessionSort: 'recent',
      filteredCount: 0,
      totalCount: 0,
      ...props
    }
  })

const typeButtons = (wrapper: ReturnType<typeof mountToolbar>) =>
  wrapper.findAll('.message-session-toolbar__filter--type')

describe('MessageSessionToolbar · 群聊/单人 类型过滤', () => {
  it('渲染「群聊」「单人」两个类型过滤按钮', () => {
    const wrapper = mountToolbar()
    const buttons = typeButtons(wrapper)
    expect(buttons).toHaveLength(2)
    expect(buttons[0].text()).toContain('space.type_group')
    expect(buttons[1].text()).toContain('space.type_single')
  })

  it('点击「群聊」emit update:sessionTypeFilter=group', async () => {
    const wrapper = mountToolbar()
    await typeButtons(wrapper)[0].trigger('click')
    expect(wrapper.emitted('update:sessionTypeFilter')).toBeTruthy()
    expect(wrapper.emitted('update:sessionTypeFilter')?.[0]).toEqual(['group'])
  })

  it('点击「单人」emit update:sessionTypeFilter=single', async () => {
    const wrapper = mountToolbar()
    await typeButtons(wrapper)[1].trigger('click')
    expect(wrapper.emitted('update:sessionTypeFilter')?.[0]).toEqual(['single'])
  })

  it('再次点击已激活的类型按钮重置为 all（toggle）', async () => {
    const wrapper = mountToolbar({ sessionTypeFilter: 'group' })
    await typeButtons(wrapper)[0].trigger('click')
    expect(wrapper.emitted('update:sessionTypeFilter')?.[0]).toEqual(['all'])
  })

  it('激活态通过 sessionTypeFilter prop 反映（aria-pressed）', () => {
    const wrapper = mountToolbar({ sessionTypeFilter: 'single' })
    expect(typeButtons(wrapper)[1].attributes('aria-pressed')).toBe('true')
    expect(typeButtons(wrapper)[0].attributes('aria-pressed')).toBe('false')
  })
})

describe('MessageSessionToolbar · 已隐藏会话入口（方案B）', () => {
  it('hiddenCount > 0 时渲染入口按钮并显示角标数值', () => {
    const wrapper = mountToolbar({ hiddenCount: 3 })
    const entry = wrapper.find('[aria-label="home.secret_chat.hidden_sessions"]')
    expect(entry.exists()).toBe(true)
    expect(wrapper.find('.n-nbadge').attributes('data-value')).toBe('3')
  })

  it('hiddenCount 为 0 或缺省时不渲染入口', () => {
    expect(mountToolbar({ hiddenCount: 0 }).find('.n-nbadge').exists()).toBe(false)
    expect(mountToolbar().find('.n-nbadge').exists()).toBe(false)
  })

  it('点击入口 emit openHiddenSessions', async () => {
    const wrapper = mountToolbar({ hiddenCount: 1 })
    await wrapper.find('[aria-label="home.secret_chat.hidden_sessions"]').trigger('click')
    expect(wrapper.emitted('openHiddenSessions')).toBeTruthy()
  })

  it('角标超过 99 显示 99+（max 封顶由 NBadge 承担，此处验证透传）', () => {
    const wrapper = mountToolbar({ hiddenCount: 120 })
    // NBadge stub 直接透传原始值；真实组件按 max=99 渲染为 99+
    expect(wrapper.find('.n-nbadge').attributes('data-value')).toBe('120')
  })
})
