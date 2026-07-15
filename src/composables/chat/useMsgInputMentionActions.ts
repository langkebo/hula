import { type Ref, ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { MsgEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import type { UserItem } from '@/services/types.ts'

interface GroupStoreLike {
  getUserInfo: (uid: string) => { myName?: string; name?: string; avatar?: string } | null
}

export interface UseMsgInputMentionActionsOptions {
  messageInputDom: Ref<HTMLElement>
  isChinese: Ref<boolean>
  ait: Ref<boolean>
  aiDialogVisible: Ref<boolean>
  groupStore: GroupStoreLike
  focusOn: (el: HTMLElement) => void
  getEditorRange: () => { range: Range; selection: Selection } | null | undefined
  insertNode: (type: MsgEnum, payload: Record<string, unknown>, container: HTMLElement) => void
  triggerInputEvent: (el: HTMLElement) => void
}

/**
 * 将光标范围回退到触发字符（`@` 或 `/`）处，方便后续插入/删除。
 * 纯函数：不读任何 ref，所有输入都从参数来。
 */
const selectBackToTriggerChar = (range: Range, triggerPattern: RegExp): void => {
  const textNode = range.endContainer
  if (!textNode) return
  const endOffset = range.endOffset
  const value = textNode.nodeValue as string | null
  if (!value) return
  const match = triggerPattern.exec(value)
  if (!match) return
  range.setStart(textNode, match.index)
  range.setEnd(textNode, endOffset)
}

/**
 * 消息输入框的 @ 提及 / `/` 命令交互。
 *
 * 从 useMsgInput 抽出：两个处理器共享 editorRange 闭包以及「聚焦 -> 回退光标 ->
 * 插入/删除」的相同流程。保持与原逻辑完全一致的行为，包括拼音输入期间短路。
 */
export const useMsgInputMentionActions = ({
  messageInputDom,
  isChinese,
  ait,
  aiDialogVisible,
  groupStore,
  focusOn,
  getEditorRange,
  insertNode,
  triggerInputEvent
}: UseMsgInputMentionActionsOptions) => {
  const editorRange = ref<{ range: Range; selection: Selection } | null>(null)
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()

  const captureEditorRange = () => {
    const snapshot = getEditorRange()
    if (!snapshot) return null
    editorRange.value = { range: snapshot.range, selection: snapshot.selection }
    return snapshot.range
  }

  const handleAit = (item: UserItem) => {
    if (isChinese.value) return

    focusOn(messageInputDom.value)
    const currentRange = captureEditorRange()
    if (currentRange) {
      selectBackToTriggerChar(currentRange, /@([^@]*)$/)
    }

    const userInfo = groupStore.getUserInfo(item.uid)
    const displayName = userInfo?.myName || item.name

    insertNode(MsgEnum.AIT, { name: displayName, uid: item.uid }, {} as HTMLElement)
    triggerInputEvent(messageInputDom.value)
    ait.value = false
  }

  const handleAI = (_item: unknown) => {
    if (isChinese.value) return

    showFeedback(t('hooks.mention.ai_coming_soon'), 'info')
    aiDialogVisible.value = false

    focusOn(messageInputDom.value)
    const currentRange = captureEditorRange()
    if (!currentRange) return

    const textNode = currentRange.endContainer
    if (!textNode) return
    const value = textNode.nodeValue as string | null
    if (!value) return
    const match = /([^/]*)$/.exec(value)
    if (!match) return

    currentRange.setStart(textNode, match.index)
    currentRange.setEnd(textNode, currentRange.endOffset)
    currentRange.deleteContents()
    triggerInputEvent(messageInputDom.value)
  }

  return { editorRange, handleAit, handleAI }
}
