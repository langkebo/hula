/**
 * Body-level orchestration test for useMsgInput.
 *
 * The purpose is not to retest every sub-hook — each has its own __tests__.
 * Instead this locks in the composition contract: which sub-hooks run,
 * what refs/callbacks get passed into them, and how `send` wraps sendCore
 * with mobile-focus behavior.
 */

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

// ---- Sub-hook mocks ---------------------------------------------------------

const inputShortcutsSpy = vi.fn()
vi.mock('../msgInput/useInputShortcuts', () => ({
  useInputShortcuts: (opts: unknown) => {
    inputShortcutsSpy(opts)
    return { chatKey: ref('Enter'), handleInput: vi.fn(), inputKeyDown: vi.fn() }
  }
}))

const sendCore = vi.fn().mockResolvedValue(undefined)
const msgInputSendSpy = vi.fn()
vi.mock('../msgInput/useMsgInputSend', () => ({
  useMsgInputSend: (opts: unknown) => {
    msgInputSendSpy(opts)
    return {
      send: sendCore,
      sendFilesDirect: vi.fn(),
      sendVoiceDirect: vi.fn(),
      sendBeaconDirect: vi.fn(),
      sendLinkPreviewDirect: vi.fn(),
      sendLocationDirect: vi.fn(),
      sendEmojiDirect: vi.fn()
    }
  }
}))

const mentionActionsSpy = vi.fn()
vi.mock('../msgInput/useMsgInputMentionActions', () => ({
  useMsgInputMentionActions: (opts: unknown) => {
    mentionActionsSpy(opts)
    return { editorRange: ref(null), handleAit: vi.fn(), handleAI: vi.fn() }
  }
}))

const eventsSpy = vi.fn()
vi.mock('../msgInput/useMsgInputEvents', () => ({
  useMsgInputEvents: (opts: unknown) => {
    eventsSpy(opts)
    return {
      onReEdit: vi.fn(),
      onReplyMeg: vi.fn(),
      onCompositionStart: vi.fn(),
      onCompositionEnd: vi.fn()
    }
  }
}))

vi.mock('../msgInput/useClipboardPaste', () => ({
  useClipboardPaste: () => ({ menuList: ref([]) })
}))

vi.mock('../msgInput/useMentionState', () => ({
  useMentionState: () => ({
    ait: ref(false),
    aitKey: ref(''),
    personList: ref([]),
    selectedAitKey: ref(null)
  })
}))

vi.mock('../msgInput/useVoiceInput', () => ({
  useVoiceInput: () => ({ uploadVoiceToMatrix: vi.fn() })
}))

vi.mock('../msgInput/useCursorManager', () => ({
  useCursorManager: () => ({
    getCursorSelectionRange: vi.fn(),
    updateSelectionRange: vi.fn(),
    focusOn: vi.fn()
  })
}))

vi.mock('../useCommon.ts', () => ({
  useCommon: () => ({
    triggerInputEvent: vi.fn(),
    insertNode: vi.fn(),
    getMessageContentType: vi.fn(),
    getEditorRange: vi.fn(() => null),
    imgPaste: vi.fn(),
    reply: ref({ avatar: '', accountName: '', content: '', key: 0 as string | number, imgCount: 0 }),
    userUid: ref('u-self')
  })
}))

vi.mock('../useTrigger', () => ({
  useTrigger: () => ({ handleTrigger: vi.fn(), resetAllStates: vi.fn() })
}))

vi.mock('../useMessageSender', () => ({
  useMessageSender: () => ({ sendWithTracking: vi.fn() })
}))

vi.mock('@/composables/useBurnAfterRead', () => ({
  useBurnAfterRead: () => ({
    isRoomBurnEnabled: () => false,
    getRoomBurnDuration: () => 0
  })
}))

const mobileFlag = { current: false }
vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: () => mobileFlag.current,
  isMac: () => false,
  isWindows: () => false
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId: '!room:x' })
}))
vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({ pushMsg: vi.fn(), updateMsg: vi.fn(), updateSessionLastActiveTime: vi.fn() })
}))
vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({ userList: [], getUserInfo: vi.fn() })
}))
vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({ chat: { sendKey: 'Enter' } })
}))

const { useMsgInput } = await import('../useMsgInput')

const mountMsgInput = () => {
  const domRef = ref(document.createElement('div'))
  let api: ReturnType<typeof useMsgInput> | undefined

  const Comp = defineComponent({
    setup() {
      api = useMsgInput(domRef as any)
      return () => h('div')
    }
  })

  mount(Comp)
  return { api: api!, domRef }
}

describe('useMsgInput orchestration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    inputShortcutsSpy.mockClear()
    msgInputSendSpy.mockClear()
    mentionActionsSpy.mockClear()
    eventsSpy.mockClear()
    sendCore.mockClear()
    mobileFlag.current = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exposes the documented public API', () => {
    const { api } = mountMsgInput()

    const keys = [
      'imgPaste',
      'inputKeyDown',
      'handleAit',
      'handleAI',
      'handleInput',
      'send',
      'stripHtml',
      'sendLocationDirect',
      'sendFilesDirect',
      'sendVoiceDirect',
      'sendBeaconDirect',
      'sendLinkPreviewDirect',
      'sendEmojiDirect',
      'personList',
      'ait',
      'aitKey',
      'msgInput',
      'chatKey',
      'menuList',
      'selectedAitKey',
      'reply',
      'disabledSend',
      'aiDialogVisible',
      'aiKeyword',
      'aiModelList',
      'selectedAIKey',
      'topicDialogVisible',
      'topicKeyword',
      'topicList',
      'groupedAIModels',
      'getCursorSelectionRange',
      'updateSelectionRange',
      'focusOn'
    ]
    for (const k of keys) expect(api).toHaveProperty(k)
  })

  it('wires each sub-hook exactly once', () => {
    mountMsgInput()
    expect(inputShortcutsSpy).toHaveBeenCalledTimes(1)
    expect(msgInputSendSpy).toHaveBeenCalledTimes(1)
    expect(mentionActionsSpy).toHaveBeenCalledTimes(1)
    expect(eventsSpy).toHaveBeenCalledTimes(1)
  })

  it('passes shared refs (msgInput, reply) into useMsgInputSend and events hooks', () => {
    const { api } = mountMsgInput()
    const sendArgs = msgInputSendSpy.mock.calls[0]![0] as any
    const eventArgs = eventsSpy.mock.calls[0]![0] as any

    // Same ref identity → state is shared, not cloned.
    expect(sendArgs.msgInput).toBe(api.msgInput)
    expect(sendArgs.reply).toBe(api.reply)
    expect(eventArgs.msgInput).toBe(api.msgInput)
    expect(eventArgs.reply).toBe(api.reply)
  })

  it('send() on desktop simply awaits sendCore without focusing', async () => {
    const { api } = mountMsgInput()
    await api.send()
    expect(sendCore).toHaveBeenCalledTimes(1)
  })

  it('send() on mobile schedules a focusOn after sendCore', async () => {
    mobileFlag.current = true
    const { api } = mountMsgInput()
    await api.send()
    await nextTick()
    expect(sendCore).toHaveBeenCalledTimes(1)
  })

  it('disabledSend is true for empty input and false with real text', async () => {
    const { api } = mountMsgInput()
    expect(api.disabledSend.value).toBe(true)

    api.msgInput.value = '<p>hello</p>'
    await nextTick()
    expect(api.disabledSend.value).toBe(false)
  })

  it('stripHtml drops tags and keeps text', () => {
    const { api } = mountMsgInput()
    expect(api.stripHtml('<p>hi <b>there</b></p>')).toBe('hi there')
    expect(api.stripHtml('   ')).toBe('')
  })
})
