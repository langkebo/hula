import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const captured = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }))

vi.mock('@/components/rightBox/chatBox/ChatMultiMsg.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'ChatMultiMsg',
      props: ['contentList', 'msgIds', 'msgId'],
      setup(props) {
        captured.props = props as Record<string, unknown>
        return () => h('div', { 'data-test': 'ChatMultiMsg' })
      }
    })
  }
})

import MergeMessage from '../MergeMessage.vue'

describe('renderMessage/MergeMessage', () => {
  const mountComponent = (props: Record<string, unknown>) => mount(MergeMessage, { props: props as never })

  const baseMessage = {
    id: 'merge-msg-1',
    body: {
      content: ['第一条合并消息', '第二条合并消息'],
      body: [
        { messageId: 'a1', uid: 'u1' },
        { messageId: 'b2', uid: 'u2' }
      ]
    }
  } as never

  it('渲染 ChatMultiMsg 子组件', () => {
    const wrapper = mountComponent({ body: (baseMessage as { body: unknown }).body, message: baseMessage })
    expect(wrapper.find('[data-test="ChatMultiMsg"]').exists()).toBe(true)
  })

  it('将 body.content 透传为 content-list', () => {
    mountComponent({ body: (baseMessage as { body: unknown }).body, message: baseMessage })
    expect(captured.props?.contentList).toEqual(['第一条合并消息', '第二条合并消息'])
  })

  it('将 message.id 透传为 msg-id', () => {
    mountComponent({ body: (baseMessage as { body: unknown }).body, message: baseMessage })
    expect(captured.props?.msgId).toBe('merge-msg-1')
  })

  it('将 body.body 映射为 msg-ids（messageId → msgId, uid → fromUid）', () => {
    mountComponent({ body: (baseMessage as { body: unknown }).body, message: baseMessage })
    expect(captured.props?.msgIds).toEqual([
      { msgId: 'a1', fromUid: 'u1' },
      { msgId: 'b2', fromUid: 'u2' }
    ])
  })
})
