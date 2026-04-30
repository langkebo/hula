import { useDebounceFn } from '@vueuse/core'
import { type ComputedRef, type Ref, ref, watch } from 'vue'
import { MsgEnum } from '@/enums'
import { createLogger } from '@/utils/Logger'
import { isMac, isWindows } from '@/utils/PlatformConstants'

const logger = createLogger('InputShortcuts')

/**
 * `useInputShortcuts` 的聚合依赖：集中注入所有需要读写的 store / hook / DOM 引用，
 * 保持此 hook 对 Pinia 与 Vue 组件树无直接耦合，便于单测。
 */
export interface InputShortcutsOptions {
  messageInputDom: Ref<HTMLElement | null | undefined> | Ref<HTMLElement>
  msgInput: Ref<string>
  /** 来自 `useSettingStore` 的发送消息快捷键引用 */
  sendKey: Ref<string>
  /** 写回发送消息快捷键的 store action */
  setSendKey: (value: string) => void
  ait: Ref<boolean>
  aiDialogVisible: Ref<boolean>
  isChinese: Ref<boolean>
  disabledSend: ComputedRef<boolean>
  getEditorRange: () => { range: Range; selection: Selection } | null
  handleTrigger: (
    text: string,
    cursorPosition: number,
    opts: { range: Range; selection: Selection; keyword: string }
  ) => unknown
  resetAllStates: () => void
  resetInput: () => void
  insertNode: (type: MsgEnum, content: string, target: HTMLElement) => void
  triggerInputEvent: (dom: HTMLElement) => void
}

export interface InputShortcutsHook {
  /** 与发送消息快捷键双向同步的本地 ref */
  chatKey: Ref<string>
  /** 防抖后的 input 事件处理器 */
  handleInput: (e: Event) => Promise<void>
  /** keydown 快捷键处理器（Enter / Ctrl+Enter / ⌘+Enter 发送规则） */
  inputKeyDown: (e: KeyboardEvent) => Promise<void>
}

/**
 * 输入框快捷键 / 发送键 / 防抖输入处理 hook。
 *
 * 负责三件事：
 * 1. `chatKey` 与发送消息快捷键的双向同步（store 改了 UI 跟着变，UI 改了写回 store）。
 * 2. `handleInput`：防抖处理输入框内容，在空内容场景下重置 trigger 面板状态；否则把文本交给 `handleTrigger` 判断 `@` / `/` / `#`。
 * 3. `inputKeyDown`：按 `sendKey` 配置处理 Enter / Ctrl+Enter / ⌘+Enter 三档发送策略，并屏蔽 `ait` / `aiDialogVisible` / IME 组字状态。
 *
 * 从 `useMsgInput.ts` 抽离，消费者 API 保持不变。
 */
export function useInputShortcuts(options: InputShortcutsOptions): InputShortcutsHook {
  const {
    messageInputDom,
    msgInput,
    sendKey,
    setSendKey,
    ait,
    aiDialogVisible,
    isChinese,
    disabledSend,
    getEditorRange,
    handleTrigger,
    resetAllStates,
    resetInput,
    insertNode,
    triggerInputEvent
  } = options

  const chatKey = ref(sendKey.value)

  // store → local
  watch(
    () => sendKey.value,
    (v) => {
      if (v !== chatKey.value) chatKey.value = v
    }
  )
  // local → store
  watch(chatKey, (v) => {
    if (sendKey.value !== v) setSendKey(v)
  })

  const handleInput = useDebounceFn(async (e: Event) => {
    const inputElement = e.target as HTMLInputElement

    const textContent = inputElement.textContent || ''
    const innerHTML = inputElement.innerHTML || ''

    const hasMediaContent =
      innerHTML.includes('<img') || innerHTML.includes('<video') || innerHTML.includes('data-type=')

    const cleanText = textContent.replace(/[\u00A0\u0020\u2000-\u200B\u2028\u2029]/g, '').trim()
    const hasOnlyEmptyElements =
      innerHTML === '<br>' ||
      innerHTML === '<div><br></div>' ||
      innerHTML.match(/^(<br>|<div><br><\/div>|<p><br><\/p>|\s)*$/)

    if (!hasMediaContent && (cleanText === '' || hasOnlyEmptyElements)) {
      inputElement.innerHTML = ''
      inputElement.textContent = ''
      msgInput.value = ''
      resetAllStates()
      return
    }
    msgInput.value = inputElement.innerHTML || ''

    const editorRange = getEditorRange()
    if (!editorRange) {
      resetAllStates()
      return
    }
    const { range, selection } = editorRange
    if (!range || !selection) {
      resetAllStates()
      return
    }

    const curNode = range.endContainer
    if (!curNode || !curNode.textContent || curNode.nodeName !== '#text') {
      resetAllStates()
      return
    }

    const cursorPosition = selection.focusOffset
    const text = curNode.textContent

    try {
      await handleTrigger(text, cursorPosition, { range, selection, keyword: '' })
    } catch (err) {
      logger.error('handleTrigger 异常:', err)
    }
  }, 0)

  const inputKeyDown = async (e: KeyboardEvent) => {
    if (disabledSend.value) {
      e.preventDefault()
      e.stopPropagation()
      resetInput()
      return
    }

    if (ait.value || aiDialogVisible.value) {
      e?.preventDefault()
      return
    }

    // 拼音组字中 (macOS)：交给 IME 处理
    if (isChinese.value && isMac()) {
      return
    }

    const isWindowsPlatform = isWindows()
    const isEnterKey = e.key === 'Enter'
    const isCtrlOrMetaKey = isWindowsPlatform ? e.ctrlKey : e.metaKey
    const sendKeyIsEnter = sendKey.value === 'Enter'
    const sendKeyIsCtrlEnter = sendKey.value === `${isWindowsPlatform ? 'Ctrl' : '⌘'}+Enter`

    // mac 下当 sendKey=Enter，用 ⌘+Enter 插入换行
    if (!isWindowsPlatform && sendKey.value === 'Enter' && e.metaKey && e.key === 'Enter') {
      e.preventDefault()
      const dom = messageInputDom.value
      if (dom) {
        insertNode(MsgEnum.TEXT, '\n', dom)
        triggerInputEvent(dom)
      }
    }

    if (msgInput.value === '' || msgInput.value.trim() === '' || ait.value) {
      e?.preventDefault()
      return
    }
    if (!isWindowsPlatform && e.ctrlKey && isEnterKey && sendKeyIsEnter) {
      e?.preventDefault()
      return
    }
    if ((sendKeyIsEnter && isEnterKey && !isCtrlOrMetaKey) || (sendKeyIsCtrlEnter && isCtrlOrMetaKey && isEnterKey)) {
      e?.preventDefault()
      const form = document.getElementById('message-form') as HTMLFormElement | null
      if (form) {
        form.requestSubmit()
      }
      resetAllStates()
    }
  }

  return { chatKey, handleInput, inputKeyDown }
}
