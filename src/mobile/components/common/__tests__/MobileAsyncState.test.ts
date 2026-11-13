import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18nMock } from '~/tests/i18n-messages'
import MobileAsyncState from '../MobileAsyncState.vue'

vi.mock('vue-i18n', () => createI18nMock())

const stubs = {
  'van-loading': { template: '<div class="van-loading" />' },
  'van-empty': {
    template: '<div class="van-empty"><span class="van-empty__desc">{{ description }}</span><slot /></div>',
    props: ['description']
  },
  'van-button': { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' }
}

const mountState = (props: Record<string, unknown>, slots: Record<string, string> = {}) =>
  mount(MobileAsyncState, {
    props: props as { state: 'loading' | 'error' | 'empty' | 'ready' },
    slots,
    global: { stubs }
  })

describe('MobileAsyncState', () => {
  it('loading 态渲染加载文案，不渲染默认插槽', () => {
    const wrapper = mountState({ state: 'loading' }, { default: '<p class="content">内容</p>' })
    expect(wrapper.find('[data-test="async-state-loading"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('加载中')
    expect(wrapper.find('.content').exists()).toBe(false)
  })

  it('error 态展示错误文案并支持重试', async () => {
    const wrapper = mountState({ state: 'error', errorText: '网络不可用' })
    expect(wrapper.text()).toContain('网络不可用')
    await wrapper.find('[data-test="async-state-retry"]').trigger('click')
    expect(wrapper.emitted('retry')?.length).toBeGreaterThan(0)
  })

  it('error 态缺省文案回落通用加载失败', () => {
    const wrapper = mountState({ state: 'error' })
    expect(wrapper.text()).toContain('加载失败')
  })

  it('empty 态展示空态文案', () => {
    const wrapper = mountState({ state: 'empty', emptyText: '还没有会话' })
    expect(wrapper.text()).toContain('还没有会话')
  })

  it('ready 态只渲染默认插槽', () => {
    const wrapper = mountState({ state: 'ready' }, { default: '<p class="content">内容</p>' })
    expect(wrapper.find('.content').exists()).toBe(true)
    expect(wrapper.find('[data-test^="async-state-"]').exists()).toBe(false)
  })
})
