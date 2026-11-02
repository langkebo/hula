import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { SettingsTab } from '@/stores/domains/settings/settingsTab'
import SettingsSidebar from '../SettingsSidebar.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('naive-ui', () => ({
  NInput: defineComponent({
    name: 'NInput',
    props: { value: { type: String, default: '' }, disabled: { type: Boolean, default: false } },
    emits: ['update:value'],
    setup(props) {
      return () => h('input', { 'data-testid': 'settings-search-input', disabled: props.disabled })
    }
  }),
  NIcon: defineComponent({
    name: 'NIcon',
    setup(_props, { slots }) {
      return () => h('span', slots.default?.())
    }
  })
}))

vi.mock('@iconify/vue', () => ({
  Icon: defineComponent({
    name: 'IconStub',
    props: { icon: { type: String, default: '' } },
    setup: () => () => h('span')
  })
}))

vi.mock('@/components/common/EmptyState.vue', () => ({
  default: defineComponent({
    name: 'EmptyState',
    props: { illustration: { type: String, default: '' }, title: { type: String, default: '' } },
    setup(props) {
      return () => h('div', { 'data-testid': 'empty-state-stub', 'data-illustration': props.illustration }, props.title)
    }
  })
}))

vi.mock('@/components/common/SkeletonBase.vue', () => ({
  default: defineComponent({
    name: 'SkeletonBase',
    props: {
      variant: { type: String, default: 'text' },
      width: { type: [String, Number], default: '100%' },
      height: { type: [String, Number], default: '14px' },
      compact: { type: Boolean, default: false }
    },
    setup(props) {
      return () => h('div', { 'data-testid': 'skeleton-stub', 'data-variant': props.variant })
    }
  })
}))

// 只 mock 分组工具，避免整棵 settingsSchema 进入测试依赖。
vi.mock('@/stores/domains/settings/settingsTab', () => ({
  getGroupedSettingsTabs: (tabs: Array<{ id: string }>) => (tabs.length > 0 ? [{ group: 'main', tabs }] : []),
  getSettingsTabGroupLabel: () => 'group-label'
}))

const sampleTabs: SettingsTab[] = [
  { id: 'account', label: 'Account', icon: 'user', group: 'general' },
  { id: 'preferences', label: 'Preferences', icon: 'settings', group: 'general' }
]

const mountSidebar = (props: Record<string, unknown> = {}) =>
  mount(SettingsSidebar, {
    props: {
      tabs: sampleTabs,
      activeTab: 'account',
      searchQuery: '',
      ...props
    }
  })

describe('SettingsSidebar 能力加载态（UI-P2-09）', () => {
  it('能力未加载时渲染骨架，且不渲染真实 Tab', () => {
    const wrapper = mountSidebar({ capabilitiesLoaded: false })

    expect(wrapper.find('[data-testid="settings-sidebar-skeleton"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="skeleton-stub"]').length).toBeGreaterThan(0)
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="empty-state-stub"]').exists()).toBe(false)
  })

  it('能力未加载时禁用搜索框，避免基于未知可见集合搜索', () => {
    const wrapper = mountSidebar({ capabilitiesLoaded: false })

    expect(wrapper.find('[data-testid="settings-search-input"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.settings-sidebar').attributes('aria-busy')).toBe('true')
  })

  it('能力加载完成后一次性渲染真实 Tab，骨架消失', () => {
    const wrapper = mountSidebar({ capabilitiesLoaded: true })

    expect(wrapper.find('[data-testid="settings-sidebar-skeleton"]').exists()).toBe(false)
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="settings-search-input"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.settings-sidebar').attributes('aria-busy')).toBe('false')
  })

  it('未传 capabilitiesLoaded 时默认视为已加载（探测失败即严格过滤）', () => {
    const wrapper = mountSidebar({ tabs: [] })

    expect(wrapper.find('[data-testid="settings-sidebar-skeleton"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="empty-state-stub"]').attributes('data-illustration')).toBe('no-results')
  })

  it('能力未加载时即使有搜索词也不渲染搜索结果', () => {
    const wrapper = mountSidebar({
      capabilitiesLoaded: false,
      searchQuery: 'account',
      searchResults: [{ tabId: 'account', anchorId: 'account-profile', path: ['Account'], available: true }]
    })

    expect(wrapper.find('.settings-search-results').exists()).toBe(false)
    expect(wrapper.find('[data-testid="settings-sidebar-skeleton"]').exists()).toBe(true)
  })
})
