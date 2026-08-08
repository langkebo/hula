import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { MsgEnum } from '@/enums'
import ReplyComposer, { type ReplyToInfo } from '../ReplyComposer.vue'

const baseReply = (overrides: Partial<ReplyToInfo> = {}): ReplyToInfo => ({
  eventId: 'evt-1',
  senderId: '@alice:example.com',
  senderName: 'Alice',
  senderAvatar: 'mxc://avatar',
  msgType: MsgEnum.TEXT,
  contentPreview: 'hello world',
  thumbnailUrl: '',
  ...overrides
})

const mountReply = (replyTo: ReplyToInfo | null) =>
  mount(ReplyComposer, {
    props: { replyTo },
    global: {
      stubs: {
        // n-avatar 仅展示头像，测试中无需真实渲染
        'n-avatar': true,
        NButton: defineComponent({
          name: 'NButton',
          setup(_props, { slots, emit }) {
            return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
          }
        })
      }
    }
  })

describe('ReplyComposer', () => {
  it('renders nothing when replyTo is null', () => {
    const wrapper = mountReply(null)
    expect(wrapper.find('.reply-composer').exists()).toBe(false)
  })

  it('renders sender name and text preview for a text reply', () => {
    const wrapper = mountReply(baseReply())
    expect(wrapper.find('.reply-composer').exists()).toBe(true)
    expect(wrapper.find('.reply-sender').text()).toBe('Alice')
    expect(wrapper.find('.reply-text').text()).toBe('hello world')
    expect(wrapper.find('.reply-image-preview').exists()).toBe(false)
  })

  it('renders image preview for an image reply', () => {
    const wrapper = mountReply(
      baseReply({ msgType: MsgEnum.IMAGE, contentPreview: 'mxc://img', thumbnailUrl: 'mxc://thumb' })
    )
    expect(wrapper.find('.reply-image-preview').exists()).toBe(true)
  })

  it('renders video preview for a video reply', () => {
    const wrapper = mountReply(baseReply({ msgType: MsgEnum.VIDEO }))
    expect(wrapper.find('.reply-video-preview').exists()).toBe(true)
  })

  it('renders file preview for a file reply', () => {
    const wrapper = mountReply(baseReply({ msgType: MsgEnum.FILE, contentPreview: 'doc.pdf' }))
    expect(wrapper.find('.reply-file-preview').exists()).toBe(true)
  })

  it('emits cancel when the close button is clicked', async () => {
    const wrapper = mountReply(baseReply())
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
