import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { RoomTypeEnum } from '@/enums'
import ChatHeaderInfo from '../ChatHeaderInfo.vue'

// naive-ui 与内部重组件 stub，聚焦联邦图标渲染
vi.mock('naive-ui', async () => {
  const { defineComponent: dc, h: hh } = await import('vue')
  const passthrough = (name: string) =>
    dc({
      name,
      setup:
        (_, { slots }) =>
        () =>
          hh('div', { class: `n-${name.toLowerCase()}` }, [slots.default?.()])
    })
  return { NTag: passthrough('NTag') }
})

vi.mock('@/components/atomic/TjgAvatar.vue', () => ({
  default: defineComponent({ name: 'TjgAvatarStub', template: '<div class="tjg-avatar-stub"></div>' })
}))
vi.mock('@/components/encryption/EncryptionStatus.vue', () => ({
  default: defineComponent({ name: 'EncryptionStatusStub', template: '<div class="enc-stub"></div>' })
}))
vi.mock('@/composables/chat/useTyping', () => ({
  useTyping: () => ({ getTypingUsersText: () => '' })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
    locale: { value: 'zh-CN' }
  })
}))

const mountInfo = (props: Record<string, unknown> = {}) =>
  mount(ChatHeaderInfo, {
    props: {
      name: '测试房间',
      avatar: '',
      type: RoomTypeEnum.GROUP,
      memberCount: 3,
      isOnline: false,
      statusIcon: '',
      statusTitle: '',
      isBotUser: false,
      ...props
    }
  })

describe('ChatHeaderInfo · 联邦图标', () => {
  it('非联邦房间不渲染 globe 图标', () => {
    const wrapper = mountInfo({ isFederated: false })
    expect(wrapper.find('.federation-icon').exists()).toBe(false)
  })

  it('联邦房间渲染 globe 图标并带无障碍标签', () => {
    const wrapper = mountInfo({ isFederated: true, federationServer: 'matrix.remote' })
    const icon = wrapper.find('.federation-icon')
    expect(icon.exists()).toBe(true)
    expect(icon.attributes('role')).toBe('img')
    expect(icon.attributes('aria-label')).toBe('home.chat_header.federated')
  })

  it('tooltip 包含 server 名称', () => {
    const wrapper = mountInfo({ isFederated: true, federationServer: 'matrix.remote' })
    expect(wrapper.find('.federation-icon').attributes('title')).toContain('matrix.remote')
  })
})
