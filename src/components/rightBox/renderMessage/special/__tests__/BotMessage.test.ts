import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BotMessage from '../BotMessage.vue'

const { getAvatarUrlMock, getUserInfoMock } = vi.hoisted(() => ({
  getAvatarUrlMock: vi.fn(() => 'https://cdn/avatar.png'),
  getUserInfoMock: vi.fn(() => ({ avatar: 'group-avatar.png' }))
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    userInfo: { uid: 'self', avatar: 'self-avatar.png' }
  })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: getUserInfoMock
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: getAvatarUrlMock
  }
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    NAvatar: defineComponent({
      name: 'NAvatar',
      props: ['src', 'round', 'size'],
      setup(props) {
        return () => h('img', { 'data-test': 'NAvatar', src: props.src as string })
      }
    })
  }
})

describe('renderMessage/special/BotMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mountComponent = (content: string, fromUserUid = 'bot-1') =>
    mount(BotMessage, {
      props: {
        body: { content },
        fromUserUid
      }
    })

  it('解析并高亮方括号内容', () => {
    const wrapper = mountComponent('[新人] 已加入')
    const parts = wrapper.findAll('p')
    const texts = parts.map((p) => p.text())
    expect(texts).toContain('新人')
    expect(texts).toContain('已加入')
    // 方括号内容渲染为 primary 高亮
    expect(wrapper.find('.text-\\[\\--tjg-color-primary-500\\]').text()).toBe('新人')
  })

  it('解析并高亮数字', () => {
    const wrapper = mountComponent('今日新增 12 条消息')
    expect(wrapper.find('.text-\\[\\--tjg-color-warning-500\\]').text()).toBe('12')
  })

  it('空内容时不渲染任何片段', () => {
    const wrapper = mountComponent('')
    expect(wrapper.findAll('p')).toHaveLength(0)
  })

  it('自身消息优先使用 userInfo 头像', () => {
    mountComponent('hello', 'self')
    expect(getAvatarUrlMock).toHaveBeenCalledWith('self-avatar.png')
  })

  it('他人消息回退到 groupStore 头像', () => {
    mountComponent('hello', 'other')
    expect(getUserInfoMock).toHaveBeenCalledWith('other')
    expect(getAvatarUrlMock).toHaveBeenCalledWith('group-avatar.png')
  })
})
