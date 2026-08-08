// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

const mittOn = vi.fn()
vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    on: (...a: unknown[]) => mittOn(...a),
    off: vi.fn(),
    emit: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
}))

const getReplyContentMock = vi.fn((_m: unknown) => 'REPLY_BODY')
vi.mock('@/utils/MessageReply.ts', () => ({
  getReplyContent: (m: unknown) => getReplyContentMock(m)
}))

const { useMsgInputEvents } = await import('../useMsgInputEvents')

const mountHook = (overrides: Partial<Parameters<typeof useMsgInputEvents>[0]> = {}) => {
  const dom = document.createElement('div')
  const messageInputDom = ref(dom)
  const msgInput = ref('')
  const reply = ref({ avatar: '', accountName: '', content: '', key: 0 as string | number, imgCount: 0 })
  const isChinese = ref(false)
  const aitKey = ref('')
  const aiKeyword = ref('')

  const focusOn = vi.fn()
  const insertNode = vi.fn()
  const triggerInputEvent = vi.fn()
  const getEditorRange = vi.fn(() => null as any)
  const updateSelectionRange = vi.fn()
  const groupStore = {
    getUserInfo: vi.fn((uid: string) => (uid === 'u-known' ? { name: 'Alice', avatar: 'a.png' } : null))
  }

  let handlers: ReturnType<typeof useMsgInputEvents> | undefined

  const Comp = defineComponent({
    setup() {
      handlers = useMsgInputEvents({
        messageInputDom: messageInputDom as any,
        msgInput,
        reply,
        isChinese,
        aitKey,
        aiKeyword,
        groupStore,
        focusOn,
        insertNode,
        triggerInputEvent,
        getEditorRange,
        updateSelectionRange,
        ...overrides
      } as any)
      return () => h('div')
    }
  })

  const wrapper = mount(Comp)
  return {
    wrapper,
    dom,
    messageInputDom,
    msgInput,
    reply,
    isChinese,
    aitKey,
    aiKeyword,
    focusOn,
    insertNode,
    triggerInputEvent,
    getEditorRange,
    updateSelectionRange,
    groupStore,
    handlers: handlers!
  }
}

describe('useMsgInputEvents', () => {
  beforeEach(() => {
    mittOn.mockClear()
    getReplyContentMock.mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('onMounted registers RE_EDIT and REPLY_MEG mitt listeners', () => {
    mountHook()
    const events = mittOn.mock.calls.map((c) => c[0])
    expect(events).toContain('reEdit')
    expect(events).toContain('replyMsg')
  })

  it('onReEdit focuses, sets innerHTML, and updates msgInput', async () => {
    const ctx = mountHook()
    await ctx.handlers.onReEdit('<p>hi</p>')
    await nextTick()
    expect(ctx.dom.innerHTML).toBe('<p>hi</p>')
    expect(ctx.msgInput.value).toBe('<p>hi</p>')
  })

  it('onCompositionStart sets isChinese=true and end resets after 10ms timer', () => {
    const ctx = mountHook()
    ctx.handlers.onCompositionStart()
    expect(ctx.isChinese.value).toBe(true)

    ctx.handlers.onCompositionEnd({ data: 'foo' } as CompositionEvent)
    expect(ctx.isChinese.value).toBe(true) // still true until timer fires

    vi.advanceTimersByTime(10)
    expect(ctx.isChinese.value).toBe(false)
    expect(ctx.aitKey.value).toBe('foo')
    expect(ctx.aiKeyword.value).toBe('foo')
  })

  it('onReplyMeg bails out when user info is missing', () => {
    const ctx = mountHook()
    ctx.handlers.onReplyMeg({
      fromUser: { uid: 'u-unknown' },
      message: { id: 'm-1' }
    } as any)

    expect(ctx.focusOn).not.toHaveBeenCalled()
    expect(ctx.reply.value.content).toBe('')
  })

  it('onReplyMeg populates reply state and schedules reply node insertion', async () => {
    const ctx = mountHook()
    ctx.handlers.onReplyMeg({
      fromUser: { uid: 'u-known' },
      message: { id: 'm-42', body: {}, type: 1 }
    } as any)

    // Initial focus + reset + populate
    expect(ctx.focusOn).toHaveBeenCalled()
    expect(getReplyContentMock).toHaveBeenCalled()
    expect(ctx.reply.value.accountName).toBe('Alice')
    expect(ctx.reply.value.content).toBe('REPLY_BODY')
    expect(ctx.reply.value.key).toBe('m-42')

    // nextTick phase: triggerInputEvent (reply preview now via ReplyComposer, no DOM injection)
    await nextTick()
    expect(ctx.triggerInputEvent).toHaveBeenCalledWith(ctx.dom)
  })
})
