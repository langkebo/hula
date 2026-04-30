import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { MsgEnum } from '@/enums'

vi.mock('@/utils/PlatformConstants', () => ({
  isMac: vi.fn(() => false),
  isWindows: vi.fn(() => false)
}))

import { isMac, isWindows } from '@/utils/PlatformConstants'
import { useInputShortcuts } from '../useInputShortcuts'

type ShortcutOpts = Parameters<typeof useInputShortcuts>[0]

const makeOpts = (overrides: Partial<ShortcutOpts> = {}): ShortcutOpts => {
  const dom = document.createElement('div')
  document.body.appendChild(dom)
  const messageInputDom = ref(dom) as ShortcutOpts['messageInputDom']
  const sendKey = ref('Enter')
  return {
    messageInputDom,
    msgInput: ref(''),
    sendKey,
    setSendKey: vi.fn((value: string) => {
      sendKey.value = value
    }),
    ait: ref(false),
    aiDialogVisible: ref(false),
    isChinese: ref(false),
    disabledSend: computed(() => false),
    getEditorRange: vi.fn(() => null),
    handleTrigger: vi.fn(() => Promise.resolve(true)),
    resetAllStates: vi.fn(),
    resetInput: vi.fn(),
    insertNode: vi.fn(),
    triggerInputEvent: vi.fn(),
    ...overrides
  }
}

const keyDownEvent = (init: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  vi.spyOn(e, 'preventDefault')
  vi.spyOn(e, 'stopPropagation')
  return e
}

describe('useInputShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isMac).mockReturnValue(false)
    vi.mocked(isWindows).mockReturnValue(false)
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('chatKey two-way binding', () => {
    it('mirrors sendKey into chatKey initially', () => {
      const opts = makeOpts({ sendKey: ref('⌘+Enter') })
      const { chatKey } = useInputShortcuts(opts)
      expect(chatKey.value).toBe('⌘+Enter')
    })

    it('propagates external sendKey change to chatKey', async () => {
      const opts = makeOpts()
      const { chatKey } = useInputShortcuts(opts)
      opts.sendKey.value = 'Ctrl+Enter'
      await nextTick()
      expect(chatKey.value).toBe('Ctrl+Enter')
    })

    it('propagates chatKey change back through setSendKey', async () => {
      const opts = makeOpts()
      const { chatKey } = useInputShortcuts(opts)
      chatKey.value = '⌘+Enter'
      await nextTick()
      expect(opts.setSendKey).toHaveBeenCalledWith('⌘+Enter')
      expect(opts.sendKey.value).toBe('⌘+Enter')
    })
  })

  describe('handleInput', () => {
    it('clears input + resets states when element is empty / br-only', async () => {
      const opts = makeOpts()
      const { handleInput } = useInputShortcuts(opts)
      const el = document.createElement('div')
      el.innerHTML = '<br>'
      el.textContent = ''
      const e = { target: el } as unknown as Event

      await handleInput(e)
      await nextTick()

      expect(opts.msgInput.value).toBe('')
      expect(opts.resetAllStates).toHaveBeenCalledTimes(1)
      expect(opts.handleTrigger).not.toHaveBeenCalled()
      expect(el.innerHTML).toBe('')
    })

    it('keeps media content and forwards to handleTrigger when editorRange resolves', async () => {
      const opts = makeOpts()
      const el = document.createElement('div')
      el.innerHTML = '<img src="http://x.com/y.png">hi @a'
      const textNode = document.createTextNode('hi @a')
      el.appendChild(textNode)
      const range = document.createRange()
      range.setStart(textNode, 3)
      range.setEnd(textNode, 5)
      const selection = { focusOffset: 5 } as unknown as Selection
      opts.getEditorRange = vi.fn(() => ({ range, selection }))

      const { handleInput } = useInputShortcuts(opts)
      await handleInput({ target: el } as unknown as Event)
      await nextTick()

      expect(opts.msgInput.value).toBe(el.innerHTML)
      expect(opts.handleTrigger).toHaveBeenCalledTimes(1)
      const call = vi.mocked(opts.handleTrigger).mock.calls[0]
      expect(call[0]).toBe('hi @a')
      expect(call[1]).toBe(5)
      expect(opts.resetAllStates).not.toHaveBeenCalled()
    })

    it('resets states when editorRange returns null', async () => {
      const opts = makeOpts()
      const el = document.createElement('div')
      el.textContent = 'abc'
      el.innerHTML = 'abc'
      opts.getEditorRange = vi.fn(() => null)

      const { handleInput } = useInputShortcuts(opts)
      await handleInput({ target: el } as unknown as Event)
      await nextTick()

      expect(opts.handleTrigger).not.toHaveBeenCalled()
      expect(opts.resetAllStates).toHaveBeenCalledTimes(1)
    })

    it('swallows handleTrigger rejections instead of bubbling up', async () => {
      const opts = makeOpts()
      const el = document.createElement('div')
      const textNode = document.createTextNode('hello')
      el.appendChild(textNode)
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)
      const selection = { focusOffset: 5 } as unknown as Selection
      opts.getEditorRange = vi.fn(() => ({ range, selection }))
      opts.handleTrigger = vi.fn(() => Promise.reject(new Error('boom')))

      const { handleInput } = useInputShortcuts(opts)
      await expect(handleInput({ target: el } as unknown as Event)).resolves.toBeUndefined()
      expect(opts.handleTrigger).toHaveBeenCalled()
    })
  })

  describe('inputKeyDown', () => {
    it('blocks send + calls resetInput when disabledSend is true', async () => {
      const disabled = ref(true)
      const opts = makeOpts({ disabledSend: computed(() => disabled.value) })
      const { inputKeyDown } = useInputShortcuts(opts)
      const e = keyDownEvent({ key: 'Enter' })
      await inputKeyDown(e)
      expect(e.preventDefault).toHaveBeenCalled()
      expect(e.stopPropagation).toHaveBeenCalled()
      expect(opts.resetInput).toHaveBeenCalled()
    })

    it('bails when ait / aiDialog is open', async () => {
      const opts = makeOpts({ ait: ref(true), msgInput: ref('anything') })
      const { inputKeyDown } = useInputShortcuts(opts)
      const e = keyDownEvent({ key: 'Enter' })
      await inputKeyDown(e)
      expect(e.preventDefault).toHaveBeenCalled()
    })

    it('defers to IME when chinese composition on mac', async () => {
      vi.mocked(isMac).mockReturnValue(true)
      const opts = makeOpts({ isChinese: ref(true), msgInput: ref('hi') })
      const { inputKeyDown } = useInputShortcuts(opts)
      const e = keyDownEvent({ key: 'Enter' })
      await inputKeyDown(e)
      expect(e.preventDefault).not.toHaveBeenCalled()
    })

    it('inserts newline on mac when sendKey=Enter and user presses ⌘+Enter', async () => {
      vi.mocked(isMac).mockReturnValue(true)
      const opts = makeOpts({ sendKey: ref('Enter'), msgInput: ref('hi') })
      const { inputKeyDown } = useInputShortcuts(opts)
      const e = keyDownEvent({ key: 'Enter', metaKey: true })
      await inputKeyDown(e)
      expect(e.preventDefault).toHaveBeenCalled()
      expect(opts.insertNode).toHaveBeenCalledWith(MsgEnum.TEXT, '\n', opts.messageInputDom.value)
      expect(opts.triggerInputEvent).toHaveBeenCalledWith(opts.messageInputDom.value)
    })

    it('submits the form when sendKey=Enter and plain Enter is pressed', async () => {
      const opts = makeOpts({ sendKey: ref('Enter'), msgInput: ref('hello') })
      const form = document.createElement('form')
      form.id = 'message-form'
      const requestSubmit = vi.fn()
      ;(form as unknown as { requestSubmit: typeof requestSubmit }).requestSubmit = requestSubmit
      document.body.appendChild(form)

      const { inputKeyDown } = useInputShortcuts(opts)
      const e = keyDownEvent({ key: 'Enter' })
      await inputKeyDown(e)

      expect(e.preventDefault).toHaveBeenCalled()
      expect(requestSubmit).toHaveBeenCalledTimes(1)
      expect(opts.resetAllStates).toHaveBeenCalled()
    })

    it('submits when sendKey=⌘+Enter (mac) and ⌘+Enter is pressed', async () => {
      vi.mocked(isMac).mockReturnValue(true)
      const opts = makeOpts({ sendKey: ref('⌘+Enter'), msgInput: ref('hello') })
      const form = document.createElement('form')
      form.id = 'message-form'
      const requestSubmit = vi.fn()
      ;(form as unknown as { requestSubmit: typeof requestSubmit }).requestSubmit = requestSubmit
      document.body.appendChild(form)

      const { inputKeyDown } = useInputShortcuts(opts)
      const e = keyDownEvent({ key: 'Enter', metaKey: true })
      await inputKeyDown(e)

      expect(requestSubmit).toHaveBeenCalledTimes(1)
    })

    it('does not submit on plain Enter when sendKey=Ctrl+Enter', async () => {
      vi.mocked(isWindows).mockReturnValue(true)
      const opts = makeOpts({ sendKey: ref('Ctrl+Enter'), msgInput: ref('hello') })
      const form = document.createElement('form')
      form.id = 'message-form'
      const requestSubmit = vi.fn()
      ;(form as unknown as { requestSubmit: typeof requestSubmit }).requestSubmit = requestSubmit
      document.body.appendChild(form)

      const { inputKeyDown } = useInputShortcuts(opts)
      await inputKeyDown(keyDownEvent({ key: 'Enter' }))
      expect(requestSubmit).not.toHaveBeenCalled()

      await inputKeyDown(keyDownEvent({ key: 'Enter', ctrlKey: true }))
      expect(requestSubmit).toHaveBeenCalledTimes(1)
    })

    it('blocks send when msgInput is empty / whitespace', async () => {
      const opts = makeOpts({ msgInput: ref('   ') })
      const form = document.createElement('form')
      form.id = 'message-form'
      const requestSubmit = vi.fn()
      ;(form as unknown as { requestSubmit: typeof requestSubmit }).requestSubmit = requestSubmit
      document.body.appendChild(form)

      const { inputKeyDown } = useInputShortcuts(opts)
      const e = keyDownEvent({ key: 'Enter' })
      await inputKeyDown(e)

      expect(e.preventDefault).toHaveBeenCalled()
      expect(requestSubmit).not.toHaveBeenCalled()
    })
  })
})
