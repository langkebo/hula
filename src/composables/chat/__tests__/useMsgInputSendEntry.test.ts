import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useMsgInputSendEntry } from '../useMsgInputSendEntry'

const startTyping = vi.fn()
const stopTyping = vi.fn()
const showFeedback = vi.fn()

vi.mock('@/composables/chat/useTyping', () => ({
  useTyping: () => ({ startTyping, stopTyping })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback })
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

const mountEntry = () => {
  const roomId = ref('!a:example.org')
  const inputEvent = new Event('input')
  let entry!: ReturnType<typeof useMsgInputSendEntry>
  const wrapper = mount(
    defineComponent({
      setup() {
        entry = useMsgInputSendEntry({
          messageInputDom: ref(document.createElement('div')),
          currentSessionRoomId: roomId,
          isAIMode: () => false,
          isAIStreaming: () => false,
          send: async () => {},
          inputKeyDown: () => {},
          handleInput: () => {},
          emitInput: () => {},
          emitSendAi: () => {},
          emitStopAi: () => {}
        })
        return () => h('div')
      }
    })
  )
  return { wrapper, roomId, entry, inputEvent }
}

describe('useMsgInputSendEntry typing 清理', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    startTyping.mockClear()
    stopTyping.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('输入后 3 秒停止 typing 并清理定时器', () => {
    const { entry, inputEvent } = mountEntry()

    entry.handleInternalInput(inputEvent)
    expect(startTyping).toHaveBeenCalledWith('!a:example.org', 30000)
    expect(stopTyping).not.toHaveBeenCalled()

    vi.advanceTimersByTime(3000)
    expect(stopTyping).toHaveBeenCalledWith('!a:example.org')
  })

  it('切换会话时向旧房间发送 stopTyping', async () => {
    const { roomId, entry, inputEvent } = mountEntry()

    entry.handleInternalInput(inputEvent)
    roomId.value = '!b:example.org'
    await Promise.resolve()

    expect(stopTyping).toHaveBeenCalledWith('!a:example.org')
  })

  it('组件卸载时停止 typing', () => {
    const { wrapper, entry, inputEvent } = mountEntry()

    entry.handleInternalInput(inputEvent)
    wrapper.unmount()

    expect(stopTyping).toHaveBeenCalledWith('!a:example.org')
  })

  it('提交表单时先停止 typing 再发送', async () => {
    const { entry, inputEvent } = mountEntry()

    entry.handleInternalInput(inputEvent)
    await entry.handleFormSubmit({ preventDefault: () => {} } as Event)

    expect(stopTyping).toHaveBeenCalledWith('!a:example.org')
  })
})
