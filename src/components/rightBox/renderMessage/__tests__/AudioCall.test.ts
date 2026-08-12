import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AudioCall from '../AudioCall.vue'

const userInfo = vi.hoisted(() => ({ uid: 'me' }))
const isMobileMock = vi.hoisted(() => vi.fn(() => false))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo })
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: isMobileMock
}))

describe('renderMessage/AudioCall', () => {
  const mountComponent = (props: Record<string, unknown>) => mount(AudioCall, { props: props as never })

  it('渲染通话文本正文', () => {
    const wrapper = mountComponent({ body: '语音通话 00:12', fromUserUid: 'me' })
    expect(wrapper.text()).toContain('语音通话 00:12')
  })

  it('本人发送时布局为 flex-row-reverse', () => {
    userInfo.uid = 'me'
    const wrapper = mountComponent({ body: 'x', fromUserUid: 'me' })
    expect(wrapper.find('.flex-row-reverse').exists()).toBe(true)
  })

  it('他人发送时布局为 flex-row', () => {
    userInfo.uid = 'other'
    const wrapper = mountComponent({ body: 'x', fromUserUid: 'peer' })
    expect(wrapper.find('.flex-row').exists()).toBe(true)
  })
})
