/**
 * Regression net for `insertNodeAtRange` — the 290-LOC heart of the editor
 * that drives @mention / plain text / reply-card insertion. Locks in the
 * observable DOM contract so we can later extract it into `useEditorDom`
 * without silently changing behaviour.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { MsgEnum } from '@/enums'

// Hoisted store mocks — the closures are referenced from vi.mock factories.
const { userStoreMock, globalStoreMock, chatStoreMock, mittMock } = vi.hoisted(() => ({
  userStoreMock: { userInfo: { uid: 'user-self' } },
  globalStoreMock: { updateCurrentSessionRoomId: vi.fn() },
  chatStoreMock: {
    getSession: vi.fn(),
    updateSessionLastActiveTime: vi.fn(),
    getSessionList: vi.fn(async () => [])
  },
  mittMock: { emit: vi.fn(), on: vi.fn() }
}))

vi.mock('@/stores/domains/user/user', () => ({ useUserStore: () => userStoreMock }))
vi.mock('@/stores/domains/widget/global', () => ({ useGlobalStore: () => globalStoreMock }))
vi.mock('@/stores/domains/chat/chat', () => ({ useChatStore: () => chatStoreMock }))
vi.mock('@/hooks/useMessage.ts', () => ({ useMessage: () => ({ handleMsgClick: vi.fn() }) }))
vi.mock('@/hooks/useMitt.ts', () => ({
  useMitt: mittMock,
  MittEnum: { LOCATE_SESSION: 'locate', TO_SEND_MSG: 'send' }
}))
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: { getCurrent: () => ({ label: 'home' }) }
}))
vi.mock('@tauri-apps/plugin-log', () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
vi.mock('@/router', () => ({ default: { currentRoute: { value: { name: '/message' } }, push: vi.fn() } }))
vi.mock('@/services/matrix', () => ({
  matrixSessionService: { getSessionDetailWithFriends: vi.fn() }
}))
vi.mock('../../utils/TauriInvokeHandler', () => ({ invokeWithErrorHandler: vi.fn() }))
vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: { getAvatarUrl: (raw: string | null | undefined) => (raw ? `https://cdn.test/${raw}` : '') }
}))
vi.mock('@/utils/Formatting', () => ({ removeTag: (s: string) => s }))

import { useCommon } from '@/hooks/useCommon'

const setupRangeIn = (host: HTMLElement) => {
  const range = document.createRange()
  range.selectNodeContents(host)
  range.collapse(false)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  return { range, selection }
}

const makeMessageInput = () => {
  document.body.innerHTML = ''
  const input = document.createElement('div')
  input.id = 'message-input'
  input.contentEditable = 'true'
  document.body.appendChild(input)
  return input
}

describe('insertNodeAtRange — MsgEnum.AIT', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('inserts a span#aitSpan with @Name + trailing nbsp', () => {
    const { insertNodeAtRange } = useCommon()
    const input = makeMessageInput()
    const sr = setupRangeIn(input)

    insertNodeAtRange(MsgEnum.AIT, { name: 'Alice', uid: 'u-1' }, input, sr)

    const span = input.querySelector('#aitSpan')!
    expect(span).toBeTruthy()
    expect(span.textContent).toBe('@Alice')
    expect((span as HTMLElement).contentEditable).toBe('false')
    expect((span as HTMLElement).dataset.aitUid).toBe('u-1')
    // Trailing non-breaking space follows the span
    expect(input.textContent).toContain('@Alice ')
  })

  it('falls back to text/label when name is absent', () => {
    const { insertNodeAtRange } = useCommon()
    const input = makeMessageInput()
    insertNodeAtRange(MsgEnum.AIT, { text: 'Bob' } as any, input, setupRangeIn(input))
    expect(input.querySelector('#aitSpan')!.textContent).toBe('@Bob')
  })

  it('treats a plain string as the mention text', () => {
    const { insertNodeAtRange } = useCommon()
    const input = makeMessageInput()
    insertNodeAtRange(MsgEnum.AIT, 'Carol', input, setupRangeIn(input))
    expect(input.querySelector('#aitSpan')!.textContent).toBe('@Carol')
  })

  it('omits data-ait-uid when uid is absent', () => {
    const { insertNodeAtRange } = useCommon()
    const input = makeMessageInput()
    insertNodeAtRange(MsgEnum.AIT, { name: 'NoUid' } as any, input, setupRangeIn(input))
    expect((input.querySelector('#aitSpan') as HTMLElement).dataset.aitUid).toBeUndefined()
  })
})

describe('insertNodeAtRange — MsgEnum.TEXT', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('inserts a text node carrying the stringified content', () => {
    const { insertNodeAtRange } = useCommon()
    const input = makeMessageInput()
    insertNodeAtRange(MsgEnum.TEXT, 'hello', input, setupRangeIn(input))
    expect(input.textContent).toBe('hello')
  })

  it('coerces non-string values via String(...)', () => {
    const { insertNodeAtRange } = useCommon()
    const input = makeMessageInput()
    insertNodeAtRange(MsgEnum.TEXT, 42 as any, input, setupRangeIn(input))
    expect(input.textContent).toBe('42')
  })
})

describe('insertNodeAtRange — MsgEnum.REPLY', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('inserts #replyDiv as the first child of #message-input', () => {
    const { insertNodeAtRange } = useCommon()
    const input = makeMessageInput()
    const sr = setupRangeIn(input)

    insertNodeAtRange(
      MsgEnum.REPLY,
      { accountName: 'Alice', content: 'previous message', avatar: 'mxc://avatar' },
      input,
      sr
    )

    const replyDiv = document.getElementById('replyDiv')
    expect(replyDiv).toBeTruthy()
    expect(input.firstChild).toBe(replyDiv)
    // Author appears somewhere inside the reply card
    expect(replyDiv!.textContent).toContain('Alice')
  })

  it('replaces an existing #replyDiv when one is already present', () => {
    const { insertNodeAtRange } = useCommon()
    const input = makeMessageInput()

    insertNodeAtRange(
      MsgEnum.REPLY,
      { accountName: 'Alice', content: 'first', avatar: 'a' },
      input,
      setupRangeIn(input)
    )
    const firstDiv = document.getElementById('replyDiv')!

    insertNodeAtRange(MsgEnum.REPLY, { accountName: 'Bob', content: 'second', avatar: 'b' }, input, setupRangeIn(input))
    const secondDiv = document.getElementById('replyDiv')!

    expect(secondDiv).not.toBe(firstDiv)
    expect(document.querySelectorAll('#replyDiv').length).toBe(1)
    expect(secondDiv.textContent).toContain('Bob')
  })

  it('does nothing when #message-input is missing', () => {
    document.body.innerHTML = ''
    const { insertNodeAtRange } = useCommon()
    // Build a detached host so getEditorRange returns something usable
    const detached = document.createElement('div')
    document.body.appendChild(detached)
    expect(() =>
      insertNodeAtRange(
        MsgEnum.REPLY,
        { accountName: 'X', content: 'y', avatar: 'z' },
        detached,
        setupRangeIn(detached)
      )
    ).not.toThrow()
    expect(document.getElementById('replyDiv')).toBeNull()
  })
})

describe('insertNodeAtRange — MsgEnum.AI', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const setupRangeAfterText = (host: HTMLElement, text: string) => {
    const node = document.createTextNode(text)
    host.appendChild(node)
    const range = document.createRange()
    range.setStart(node, text.length)
    range.setEnd(node, text.length)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    return { range, selection }
  }

  it('inserts #AIDiv as a contentEditable=false card with author label', () => {
    const { insertNodeAtRange } = useCommon()
    const input = makeMessageInput()
    const sr = setupRangeAfterText(input, '/ask')

    insertNodeAtRange(MsgEnum.AI, { name: 'GPT', avatar: 'mxc://a', accountName: '', content: '' }, input, sr)

    const ai = document.getElementById('AIDiv')!
    expect(ai).toBeTruthy()
    expect(ai.contentEditable).toBe('false')
    expect(ai.textContent).toContain('GPT')
    // Avatar image is present
    expect(ai.querySelector('img')).toBeTruthy()
  })

  it('strips the trailing "/" trigger char from the host text node', () => {
    const { insertNodeAtRange } = useCommon()
    const input = makeMessageInput()
    const textNode = document.createTextNode('hello /')
    input.appendChild(textNode)
    const range = document.createRange()
    range.setStart(textNode, 7)
    range.setEnd(textNode, 7)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    insertNodeAtRange(MsgEnum.AI, { name: 'GPT', avatar: 'a' } as any, input, { range, selection })

    expect(textNode.textContent).toBe('hello ')
  })

  it('renders a #closeBtn child that, when clicked, removes the AI card and clears reply state', () => {
    const common = useCommon()
    const input = makeMessageInput()
    common.reply.value = { avatar: 'x', imgCount: 3, accountName: 'A', content: 'B', key: 99 }

    common.insertNodeAtRange(MsgEnum.AI, { name: 'GPT', avatar: 'a' } as any, input, setupRangeAfterText(input, '/'))

    const closeBtn = document.getElementById('closeBtn')!
    expect(closeBtn).toBeTruthy()
    expect(closeBtn.textContent).toBe('关闭')

    closeBtn.dispatchEvent(new Event('click', { bubbles: true }))

    expect(document.getElementById('AIDiv')).toBeNull()
    expect(common.reply.value).toEqual({ avatar: '', imgCount: 0, accountName: '', content: '', key: 0 })
  })

  it('falls back to the default avatar when getAvatarUrl returns empty', () => {
    const { insertNodeAtRange } = useCommon()
    const input = makeMessageInput()
    insertNodeAtRange(MsgEnum.AI, { name: 'X', avatar: '' } as any, input, setupRangeAfterText(input, '/'))
    const img = document.getElementById('AIDiv')!.querySelector('img')!
    expect(img.getAttribute('src')).toBe('/avatar/001.png')
  })
})

describe('insertNodeAtRange — default branch', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('inserts a string content as a plain text node when type is unknown', () => {
    const { insertNodeAtRange } = useCommon()
    const input = makeMessageInput()
    insertNodeAtRange(999 as MsgEnum, 'fallback-text', input, setupRangeIn(input))
    expect(input.textContent).toBe('fallback-text')
  })

  it('inserts a Node directly when content is a DOM node', () => {
    const { insertNodeAtRange } = useCommon()
    const input = makeMessageInput()
    const span = document.createElement('span')
    span.id = 'custom-node'
    span.textContent = 'X'
    insertNodeAtRange(999 as MsgEnum, span as any, input, setupRangeIn(input))
    expect(input.querySelector('#custom-node')).toBe(span)
  })
})
