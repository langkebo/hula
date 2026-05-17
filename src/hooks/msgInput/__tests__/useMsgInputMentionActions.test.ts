import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { MsgEnum } from '@/enums'
import { useMsgInputMentionActions } from '../useMsgInputMentionActions'

const { showFeedbackMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn()
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

const makeTextNode = (value: string): Node => {
  const node = document.createTextNode(value)
  return node
}

const makeRange = (textNode: Node, endOffset: number): Range => {
  const range = document.createRange()
  range.setStart(textNode, endOffset)
  range.setEnd(textNode, endOffset)
  vi.spyOn(range, 'deleteContents')
  vi.spyOn(range, 'setStart')
  vi.spyOn(range, 'setEnd')
  return range
}

const setup = (opts?: Partial<{ textNodeValue: string; endOffset: number; editorRange: unknown }>) => {
  const textNode = opts?.textNodeValue !== undefined ? makeTextNode(opts.textNodeValue) : null
  const range = textNode ? makeRange(textNode, opts?.endOffset ?? 0) : null
  const selection = {} as Selection

  const getEditorRange = vi.fn(() => {
    if (opts?.editorRange === null) return null
    if (range) return { range, selection }
    return null
  })
  const focusOn = vi.fn()
  const insertNode = vi.fn()
  const triggerInputEvent = vi.fn()

  const groupStore = {
    getUserInfo: vi.fn((uid: string) =>
      uid === 'u-with-myName' ? { myName: 'NickName', name: 'RealName' } : { name: 'RealName' }
    )
  }

  const messageInputDom = ref(document.createElement('div'))
  const isChinese = ref(false)
  const ait = ref(true)
  const aiDialogVisible = ref(true)

  const actions = useMsgInputMentionActions({
    messageInputDom: messageInputDom as any,
    isChinese,
    ait,
    aiDialogVisible,
    groupStore,
    focusOn,
    getEditorRange,
    insertNode,
    triggerInputEvent
  })

  return {
    actions,
    range,
    textNode,
    focusOn,
    insertNode,
    triggerInputEvent,
    getEditorRange,
    isChinese,
    ait,
    aiDialogVisible,
    groupStore
  }
}

describe('useMsgInputMentionActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleAit', () => {
    it('is a no-op during IME composition', () => {
      const ctx = setup({ textNodeValue: 'hello @', endOffset: 7 })
      ctx.isChinese.value = true

      ctx.actions.handleAit({ uid: 'u1', name: 'Alice' } as any)

      expect(ctx.focusOn).not.toHaveBeenCalled()
      expect(ctx.insertNode).not.toHaveBeenCalled()
    })

    it('rewinds range to the @ trigger and inserts AIT node using group nickname when present', () => {
      const ctx = setup({ textNodeValue: 'hello @foo', endOffset: 10 })

      ctx.actions.handleAit({ uid: 'u-with-myName', name: 'RealName' } as any)

      expect(ctx.focusOn).toHaveBeenCalled()
      expect(ctx.range!.setStart).toHaveBeenCalledWith(ctx.textNode!, 6)
      expect(ctx.range!.setEnd).toHaveBeenCalledWith(ctx.textNode!, 10)
      expect(ctx.insertNode).toHaveBeenCalledWith(
        MsgEnum.AIT,
        { name: 'NickName', uid: 'u-with-myName' },
        expect.anything()
      )
      expect(ctx.triggerInputEvent).toHaveBeenCalled()
      expect(ctx.ait.value).toBe(false)
    })

    it('falls back to item.name when group info has no myName', () => {
      const ctx = setup({ textNodeValue: '@x', endOffset: 2 })
      ctx.actions.handleAit({ uid: 'u-plain', name: 'Bob' } as any)

      expect(ctx.insertNode).toHaveBeenCalledWith(MsgEnum.AIT, { name: 'Bob', uid: 'u-plain' }, expect.anything())
    })

    it('still inserts even when no editor range is available', () => {
      const ctx = setup({ editorRange: null })
      ctx.actions.handleAit({ uid: 'u-plain', name: 'Bob' } as any)

      expect(ctx.insertNode).toHaveBeenCalled()
      expect(ctx.ait.value).toBe(false)
    })
  })

  describe('handleAI', () => {
    it('is a no-op during IME composition', () => {
      const ctx = setup({ textNodeValue: '/ask', endOffset: 4 })
      ctx.isChinese.value = true

      ctx.actions.handleAI({})

      expect(showFeedbackMock).not.toHaveBeenCalled()
    })

    it('shows the pending message, closes AI dialog, and deletes the / trigger text', () => {
      const ctx = setup({ textNodeValue: 'hi /ask', endOffset: 7 })

      ctx.actions.handleAI({})

      expect(showFeedbackMock).toHaveBeenCalledWith('当前ai正在对接，敬请期待', 'info')
      expect(ctx.aiDialogVisible.value).toBe(false)
      expect(ctx.range!.setStart).toHaveBeenCalled()
      expect(ctx.range!.setEnd).toHaveBeenCalled()
      expect(ctx.range!.deleteContents).toHaveBeenCalled()
      expect(ctx.triggerInputEvent).toHaveBeenCalled()
    })

    it('exits early when editor range is missing', () => {
      const ctx = setup({ editorRange: null })

      ctx.actions.handleAI({})

      expect(showFeedbackMock).toHaveBeenCalledWith('当前ai正在对接，敬请期待', 'info')
      expect(ctx.aiDialogVisible.value).toBe(false)
      expect(ctx.triggerInputEvent).not.toHaveBeenCalled()
    })
  })
})
