import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { MobileSessionListItem } from '@/mobile/composables/useMobileSessionList'
import { createI18nMock } from '~/tests/i18n-messages'
import MobileSessionList from '../MobileSessionList.vue'

/**
 * 会话列表的四态渲染契约。
 *
 * 重点不是「渲染了某个 div」，而是**不要把故障/加载中伪装成「暂无会话」**：
 * 用户看到「暂无会话」时不会想到去下拉刷新，这是移动端消息页最容易被误读的一屏。
 */

vi.mock('vue-i18n', () => createI18nMock())

// vant 组件用轻量桩：这里测的是四态分支与 emit，不是 vant 自身行为
const stubs = {
  'van-field': { template: '<div class="stub-field"><slot name="left-icon" /></div>' },
  'van-pull-refresh': { template: '<div class="stub-pull"><slot /></div>' },
  'van-empty': {
    props: ['description'],
    template: '<div class="stub-empty"><span class="stub-empty-desc">{{ description }}</span><slot /></div>'
  },
  // 必须显式声明 emits，否则 click 会同时作为原生事件透传，导致父级 @click 被触发两次
  'van-button': {
    emits: ['click'],
    template: '<button class="stub-btn" @click="$emit(\'click\')"><slot /></button>'
  },
  'van-loading': { template: '<div class="stub-loading" />' },
  'van-swipe-cell': { template: '<div class="stub-swipe"><slot /><slot name="right" /></div>' },
  'van-badge': { template: '<div class="stub-badge"><slot /></div>' },
  SmartVirtualList: {
    props: ['items'],
    template:
      '<div class="stub-virtual">{{ items.length }}<slot v-for="(it, i) in items" :item="it" :index="i" /></div>'
  }
}

const baseProps = {
  filteredSessionList: [] as MobileSessionListItem[],
  searchText: '',
  loading: false,
  isEnablePullRefresh: true,
  longPressOption: {} as never
}

const makeItem = (name: string): MobileSessionListItem =>
  ({
    roomId: `!${name}:matrix.test`,
    name,
    type: 2,
    unreadCount: 0,
    activeTime: 1,
    lastMsg: 'hi',
    lastMsgTime: '刚刚',
    isAtMe: false
  }) as MobileSessionListItem

const mountList = (props: Record<string, unknown>) =>
  mount(MobileSessionList, { props: { ...baseProps, ...props }, global: { stubs } })

describe('MobileSessionList 四态', () => {
  it('空列表 + 加载中 → 显示加载态，不显示「暂无会话」', () => {
    const wrapper = mountList({ filteredSessionList: [], isLoading: true })
    expect(wrapper.find('[data-test="session-list-loading"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('加载中')
    expect(wrapper.text()).not.toContain('暂无会话')
    expect(wrapper.find('[data-test="session-list-error"]').exists()).toBe(false)
  })

  it('空列表 + 失败 → 显示失败原因与重试按钮，不显示「暂无会话」', () => {
    const wrapper = mountList({ filteredSessionList: [], loadError: 'HTTP 500', isLoading: false })
    const error = wrapper.find('[data-test="session-list-error"]')
    expect(error.exists()).toBe(true)
    expect(error.text()).toContain('会话加载失败')
    expect(error.text()).toContain('HTTP 500')
    expect(wrapper.text()).not.toContain('暂无会话')
    expect(wrapper.find('.stub-btn').exists()).toBe(true)
  })

  it('空列表 + 未加载 + 无错误 → 才是真正的「暂无会话」', () => {
    const wrapper = mountList({ filteredSessionList: [], isLoading: false, loadError: null })
    expect(wrapper.text()).toContain('暂无会话')
    expect(wrapper.find('[data-test="session-list-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="session-list-loading"]').exists()).toBe(false)
  })

  it('有数据时恒渲染列表（刷新中 / 刷新失败都不遮挡已有会话）', () => {
    const items = [makeItem('a'), makeItem('b')]
    for (const extra of [{ isLoading: true }, { loadError: 'boom' }, {}]) {
      const wrapper = mountList({ filteredSessionList: items, ...extra })
      expect(wrapper.find('.stub-virtual').exists()).toBe(true)
      expect(wrapper.text()).not.toContain('暂无会话')
      expect(wrapper.find('[data-test="session-list-error"]').exists()).toBe(false)
    }
  })

  it('失败态点重试会向父级抛 refresh', async () => {
    const wrapper = mountList({ filteredSessionList: [], loadError: 'boom' })
    await wrapper.find('.stub-btn').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
})
