import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MittEnum, MsgEnum } from '@/enums'
import RecallMessage from '../RecallMessage.vue'

const { emitMock, getMessageMock, getRecalledMessageMock } = vi.hoisted(() => ({
  emitMock: vi.fn(),
  getMessageMock: vi.fn(),
  getRecalledMessageMock: vi.fn()
}))

const recalledMessagesMock = vi.hoisted<Record<string, { originalType: MsgEnum; content: string }>>(() => ({}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: { on: vi.fn(), off: vi.fn(), emit: emitMock }
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({
    recalledMessages: recalledMessagesMock,
    getMessage: getMessageMock,
    getRecalledMessage: getRecalledMessageMock
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    userInfo: { uid: 'me' }
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    NFlex: defineComponent({
      name: 'NFlex',
      setup(_, { slots }) {
        return () => h('div', { 'data-test': 'NFlex' }, slots.default?.())
      }
    })
  }
})

describe('renderMessage/special/RecallMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(recalledMessagesMock)) delete recalledMessagesMock[key]
  })

  const baseMessage = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'm1',
      fromUser: { uid: 'me' },
      body: { content: '撤回了消息' },
      ...overrides
    }) as never

  const mountComponent = (props: Record<string, unknown>) => mount(RecallMessage, { props: props as never })

  it('单聊下显示 message.body.content 作为撤回文案', () => {
    const wrapper = mountComponent({
      message: baseMessage(),
      fromUserUid: 'me',
      isGroup: false,
      body: {} as never
    })
    expect(wrapper.text()).toContain('撤回了消息')
  })

  it('body.content 缺失时回退到默认文案', () => {
    const wrapper = mountComponent({
      message: baseMessage({ body: {} }),
      fromUserUid: 'me',
      isGroup: false,
      body: {} as never
    })
    expect(wrapper.text()).toContain('撤回了一条消息')
  })

  it('群聊 + 自己 + 文本类型时显示「重新编辑」', () => {
    recalledMessagesMock.m1 = { originalType: MsgEnum.TEXT, content: 'hi' }
    getMessageMock.mockReturnValue({ fromUser: { uid: 'me' } })

    const wrapper = mountComponent({
      message: baseMessage(),
      fromUserUid: 'me',
      isGroup: true,
      body: {} as never
    })

    const reEdit = wrapper.findAll('p').find((p) => p.text() === '重新编辑')
    expect(reEdit).toBeTruthy()
  })

  it('非文本类型撤回消息不显示「重新编辑」', () => {
    recalledMessagesMock.m1 = { originalType: MsgEnum.IMAGE, content: 'x' }
    getMessageMock.mockReturnValue({ fromUser: { uid: 'me' } })

    const wrapper = mountComponent({
      message: baseMessage(),
      fromUserUid: 'me',
      isGroup: true,
      body: {} as never
    })

    const reEdit = wrapper.findAll('p').find((p) => p.text() === '重新编辑')
    expect(reEdit).toBeFalsy()
  })

  it('他人消息不显示「重新编辑」', () => {
    recalledMessagesMock.m1 = { originalType: MsgEnum.TEXT, content: 'hi' }
    getMessageMock.mockReturnValue({ fromUser: { uid: 'other' } })

    const wrapper = mountComponent({
      message: baseMessage({ fromUser: { uid: 'other' } }),
      fromUserUid: 'other',
      isGroup: true,
      body: {} as never
    })

    const reEdit = wrapper.findAll('p').find((p) => p.text() === '重新编辑')
    expect(reEdit).toBeFalsy()
  })

  it('点击「重新编辑」通过 useMitt 广播 RE_EDIT 事件', () => {
    recalledMessagesMock.m1 = { originalType: MsgEnum.TEXT, content: 'hi' }
    getMessageMock.mockReturnValue({ fromUser: { uid: 'me' } })
    getRecalledMessageMock.mockReturnValue({ content: 'hi' })

    const wrapper = mountComponent({
      message: baseMessage(),
      fromUserUid: 'me',
      isGroup: true,
      body: {} as never
    })

    const reEdit = wrapper.findAll('p').find((p) => p.text() === '重新编辑')!
    reEdit.trigger('click')

    expect(emitMock).toHaveBeenCalledWith(MittEnum.RE_EDIT, 'hi')
  })
})
