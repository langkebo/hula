import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MsgEnum } from '@/enums'
import PinMessageSelector from '../PinMessageSelector.vue'

let chatStore: { chatMessageList: Array<Record<string, unknown>> }

const createMessage = (id: string, opts: Record<string, unknown> = {}) => ({
  message: {
    id,
    roomId: '!room:example.com',
    sendTime: 1000,
    type: MsgEnum.TEXT,
    body: { content: `body-${id}` },
    ...(opts.message as Record<string, unknown> | undefined)
  },
  fromUser: {
    uid: '@user:example.com',
    username: `User ${id}`,
    ...(opts.fromUser as Record<string, unknown> | undefined)
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key
  })
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => chatStore
}))

vi.mock('@/utils/ComputedTime', () => ({
  formatChatTime: () => '12:00'
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  return {
    NModal: defineComponent({
      name: 'NModal',
      props: { show: { type: Boolean, default: false } },
      emits: ['update:show'],
      setup(props, { slots }) {
        return () => (props.show ? h('div', { 'data-test': 'modal' }, slots.default?.()) : null)
      }
    }),
    NScrollbar: passthrough('NScrollbar'),
    NEmpty: defineComponent({
      name: 'NEmpty',
      props: { description: { type: String, default: '' } },
      setup(props) {
        return () => h('div', { 'data-test': 'n-empty' }, props.description)
      }
    })
  }
})

describe('PinMessageSelector', () => {
  beforeEach(() => {
    chatStore = { chatMessageList: [] }
  })

  it('renders selectable messages newest-first with sender and body', () => {
    chatStore.chatMessageList = [
      createMessage('m1', { message: { sendTime: 100 } }),
      createMessage('m2', { message: { sendTime: 200 } })
    ]

    const wrapper = mount(PinMessageSelector, { props: { show: true } })

    const items = wrapper.findAll('.pin-selector__item')
    expect(items).toHaveLength(2)
    // 最新在前（倒序）
    expect(items[0].text()).toContain('m2')
    expect(items[1].text()).toContain('m1')
    expect(items[0].text()).toContain('User m2')
    expect(items[0].text()).toContain('body-m2')
  })

  it('emits select and closes when an item is clicked', async () => {
    chatStore.chatMessageList = [createMessage('m1')]

    const wrapper = mount(PinMessageSelector, { props: { show: true } })

    await wrapper.find('.pin-selector__item').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['m1']])
    expect(wrapper.emitted('update:show')).toEqual([[false]])
  })

  it('shows empty state when there are no selectable messages', () => {
    chatStore.chatMessageList = []

    const wrapper = mount(PinMessageSelector, { props: { show: true } })

    expect(wrapper.find('[data-test="n-empty"]').exists()).toBe(true)
    expect(wrapper.findAll('.pin-selector__item')).toHaveLength(0)
  })

  it('filters out non-selectable message types (notice/bot/recall)', () => {
    chatStore.chatMessageList = [
      createMessage('notice', { message: { type: MsgEnum.NOTICE } }),
      createMessage('text', { message: { type: MsgEnum.TEXT } })
    ]

    const wrapper = mount(PinMessageSelector, { props: { show: true } })

    const items = wrapper.findAll('.pin-selector__item')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('text')
  })
})
