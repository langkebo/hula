import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MobileReactionPicker from '../MobileReactionPicker.vue'

const mocks = vi.hoisted(() => ({
  toggleReaction: vi.fn(),
  getReactions: vi.fn()
}))

vi.mock('@/composables/messaging/useReactionFlow', async () => {
  const { ref } = await import('vue')
  return {
    useReactionFlow: () => ({
      reactions: ref([]),
      loading: ref(false),
      pendingEmoji: ref(null),
      error: ref(null),
      totalReactions: ref(0),
      getReactions: mocks.getReactions,
      toggleReaction: mocks.toggleReaction,
      addReaction: vi.fn(),
      removeReaction: vi.fn(),
      findUserReaction: vi.fn(),
      reset: vi.fn()
    }),
    QUICK_EMOJIS: [
      { key: 'like', emoji: '👍', label: 'like' },
      { key: 'love', emoji: '❤️', label: 'love' },
      { key: 'laugh', emoji: '😂', label: 'laugh' },
      { key: 'wow', emoji: '😮', label: 'wow' },
      { key: 'sad', emoji: '😢', label: 'sad' },
      { key: 'angry', emoji: '😡', label: 'angry' }
    ]
  }
})

const mountPicker = (props: Partial<InstanceType<typeof MobileReactionPicker>['$props']> = {}) => {
  return mount(MobileReactionPicker, {
    props: {
      visible: true,
      roomId: '!room1:server',
      eventId: '$event1:server',
      ...props
    },
    global: {
      stubs: {
        VanActionSheet: {
          props: ['show', 'title', 'closeable', 'closeOnClickOverlay', 'teleport'],
          template: '<div v-if="show"><slot /></div>'
        },
        VanButton: {
          emits: ['click'],
          template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
        }
      }
    }
  })
}

describe('MobileReactionPicker', () => {
  it('渲染显示 6 个快捷表情', async () => {
    mocks.toggleReaction.mockResolvedValue(undefined)
    mocks.getReactions.mockResolvedValue(undefined)

    const wrapper = mountPicker()
    await wrapper.vm.$nextTick()

    const emojiButtons = wrapper.findAll('[data-test="quick-emoji-btn"]')
    expect(emojiButtons).toHaveLength(6)

    const emojis = emojiButtons.map((btn) => btn.attributes('data-emoji'))
    expect(emojis).toEqual(['👍', '❤️', '😂', '😮', '😢', '😡'])
  })

  it('点击表情调用 toggleReaction 并 emit reacted', async () => {
    mocks.toggleReaction.mockResolvedValue(undefined)
    mocks.getReactions.mockResolvedValue(undefined)

    const wrapper = mountPicker()
    await wrapper.vm.$nextTick()

    const firstEmojiBtn = wrapper.find('[data-test="quick-emoji-btn"]')
    await firstEmojiBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(mocks.toggleReaction).toHaveBeenCalledWith('👍')
    expect(mocks.toggleReaction).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('reacted')).toEqual([['👍']])
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })
})
