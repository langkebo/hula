import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UserIdentity from '../UserIdentity.vue'

describe('UserIdentity', () => {
  const LOCAL_SERVER = 'matrix.org'

  const mountUserIdentity = (props: Record<string, unknown> = {}) =>
    mount(UserIdentity, {
      props: { localServer: LOCAL_SERVER, ...props },
      global: { plugins: [createTestingPinia()] }
    })

  it('renders displayName as primary text', () => {
    const wrapper = mountUserIdentity({ displayName: 'Alice', mxid: '@alice:matrix.org' })
    expect(wrapper.find('.user-identity__name').text()).toBe('Alice')
  })

  it('falls back to mxid localpart when no displayName', () => {
    const wrapper = mountUserIdentity({ mxid: '@alice:matrix.org' })
    expect(wrapper.find('.user-identity__name').text()).toBe('alice')
  })

  it('shows local badge for same-homeserver user', () => {
    const wrapper = mountUserIdentity({ mxid: '@alice:matrix.org', localServer: 'matrix.org' })
    expect(wrapper.find('.federation-badge').exists()).toBe(true)
    // FederationBadge 为本地用户时添加 --local 变体类名
    expect(wrapper.find('.federation-badge').classes()).toContain('federation-badge--local')
  })

  it('shows remote badge for federated user', () => {
    const wrapper = mountUserIdentity({ mxid: '@bob:other.server' })
    expect(wrapper.find('.federation-badge').exists()).toBe(true)
    // 远端用户无 --local 类名
    expect(wrapper.find('.federation-badge').classes()).not.toContain('federation-badge--local')
  })

  it('hides federation badge when showFederation=false', () => {
    const wrapper = mountUserIdentity({ mxid: '@alice:matrix.org', showFederation: false })
    expect(wrapper.find('.federation-badge').exists()).toBe(false)
  })

  it('renders mxid text when showMxid=true', () => {
    const wrapper = mountUserIdentity({ mxid: '@alice:matrix.org', showMxid: true })
    expect(wrapper.find('.mxid-text').exists()).toBe(true)
  })

  it('hides mxid text when showMxid=false', () => {
    const wrapper = mountUserIdentity({ mxid: '@alice:matrix.org', showMxid: false })
    expect(wrapper.find('.mxid-text').exists()).toBe(false)
  })

  it('shows avatar when showAvatar=true', () => {
    const wrapper = mountUserIdentity({
      displayName: 'Alice',
      avatarUrl: 'https://example.com/avatar.png',
      showAvatar: true
    })
    // TjgAvatar 根元素是 <span class="tjg-avatar">（Vue 3 不把组件标签上的 class 合并进根元素）
    expect(wrapper.find('.tjg-avatar').exists()).toBe(true)
  })

  it('applies interactive class when interactive=true', () => {
    const wrapper = mountUserIdentity({ displayName: 'Alice', interactive: true })
    expect(wrapper.find('.user-identity--interactive').exists()).toBe(true)
  })
})
