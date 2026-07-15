import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TextMessage from '../Text.vue'

const { showFeedbackMock, writeTextMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  writeTextMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/composables/common/useLinkSegments', () => ({
  openExternalUrl: vi.fn()
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: vi.fn(() => null)
  })
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: () => false
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', slots.default?.())
      }
    })

  return {
    NPopover: passthrough('NPopover'),
    NFlex: passthrough('NFlex'),
    NTooltip: passthrough('NTooltip'),
    NHighlight: defineComponent({
      name: 'NHighlight',
      props: {
        text: {
          type: String,
          default: ''
        }
      },
      setup(props) {
        return () => h('span', props.text)
      }
    })
  }
})

describe('Text render message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: writeTextMock
      }
    })
  })

  it('uses action feedback when copying a url', () => {
    const wrapper = mount(TextMessage, {
      props: {
        body: {
          content: 'https://example.com',
          atUidList: [],
          urlContentMap: {}
        }
      }
    })

    ;(wrapper.vm as unknown as { handleCopy: (value: string) => void }).handleCopy('https://example.com')

    expect(writeTextMock).toHaveBeenCalledWith('https://example.com')
    expect(showFeedbackMock).toHaveBeenCalledWith('copy_success', 'success')
  })
})
