import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { RoomTypeEnum } from '@/enums'
import ChatHeaderToolbar from '../ChatHeaderToolbar.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const NTooltip = defineComponent({
    name: 'NTooltip',
    setup(_, { slots }) {
      return () => h('div', [slots.trigger?.(), slots.default?.()])
    }
  })

  const NButton = defineComponent({
    name: 'NButton',
    inheritAttrs: true,
    setup(_, { slots, attrs }) {
      return () => h('button', attrs, slots.default?.())
    }
  })

  return { NTooltip, NButton }
})

describe('ChatHeaderToolbar 群聊隐藏通话按钮 (P2-1)', () => {
  it('单聊时渲染语音/视频通话按钮', () => {
    const wrapper = mount(ChatHeaderToolbar, {
      props: { roomType: RoomTypeEnum.SINGLE }
    })

    expect(wrapper.find('[aria-label="chat.header.voice_call"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="chat.header.video_call"]').exists()).toBe(true)
  })

  it('群聊时隐藏语音/视频通话按钮', () => {
    const wrapper = mount(ChatHeaderToolbar, {
      props: { roomType: RoomTypeEnum.GROUP }
    })

    expect(wrapper.find('[aria-label="chat.header.voice_call"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="chat.header.video_call"]').exists()).toBe(false)
  })
})
