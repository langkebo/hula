import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { chatState } = vi.hoisted(() => ({
  chatState: {
    currentMessageOptions: null as null | {
      loadFailed?: {
        scope: 'history' | 'initial'
        reason: string
        category: 'network' | 'permission' | 'server' | 'unknown'
      } | null
    }
  }
}))

vi.mock('@/stores/domains/chat/chat', async () => {
  const { reactive } = await import('vue')
  return { useChatStore: () => reactive(chatState) }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

import ChatLoadMoreIndicator from '../ChatLoadMoreIndicator.vue'

const mountIndicator = (props: { loading: boolean; error: boolean }) => mount(ChatLoadMoreIndicator, { props })

const setHistoryCategory = (category: 'network' | 'permission' | 'server' | 'unknown') => {
  chatState.currentMessageOptions = {
    loadFailed: { scope: 'history', reason: category, category }
  }
}

describe('ChatLoadMoreIndicator', () => {
  beforeEach(() => {
    chatState.currentMessageOptions = null
  })

  it('加载中显示加载文案且不出现重试入口', () => {
    const wrapper = mountIndicator({ loading: true, error: false })

    expect(wrapper.text()).toContain('home.chat_main.loading_more')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it.each([
    ['network', 'home.chat_main.load_more_network'],
    ['permission', 'home.chat_main.load_more_permission'],
    ['server', 'home.chat_main.load_more_server']
  ] as const)('按失败归类（%s）显示对应文案', (category, key) => {
    setHistoryCategory(category)

    const wrapper = mountIndicator({ loading: false, error: true })

    expect(wrapper.find('.load-more-indicator--error').text()).toContain(key)
    expect(wrapper.find('.load-more-indicator--error button').exists()).toBe(true)
  })

  it('缺少归类、非翻页失败或无法归类时回落到通用失败文案', () => {
    const withoutFailure = mountIndicator({ loading: false, error: true })
    expect(withoutFailure.find('.load-more-indicator--error').text()).toContain('home.chat_main.load_more_failed')

    chatState.currentMessageOptions = {
      loadFailed: { scope: 'initial', reason: 'boom', category: 'network' }
    }
    const initialScope = mountIndicator({ loading: false, error: true })
    expect(initialScope.find('.load-more-indicator--error').text()).toContain('home.chat_main.load_more_failed')

    setHistoryCategory('unknown')
    const unknown = mountIndicator({ loading: false, error: true })
    expect(unknown.find('.load-more-indicator--error').text()).toContain('home.chat_main.load_more_failed')
  })

  it('点击重试按钮触发 retry 事件', async () => {
    setHistoryCategory('network')

    const wrapper = mountIndicator({ loading: false, error: true })
    await wrapper.find('.load-more-indicator--error button').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
