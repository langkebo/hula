import { useDebounceFn } from '@vueuse/core'
import { computed, type Ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type SelectionRange, useCommon } from '@/composables/common/useCommon'
import { MsgEnum } from '@/enums'
import { useEmojiStore } from '@/stores/domains/chat/emoji'
import { useHistoryStore } from '@/stores/domains/chat/history'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'

type MsgInputLike = {
  messageInputDom: HTMLElement
  sendEmojiDirect: (serverUrl: string) => Promise<void>
  focus: () => void
  getLastEditRange: () => SelectionRange | null
  updateSelectionRange: () => void
}

export type EmojiUrlPayload = { renderUrl: string; serverUrl: string }

/**
 * 聊天底部栏表情处理
 * 管理表情插入、最近表情、防抖发送等逻辑
 */
export function useFooterEmoji(
  MsgInputRef: Ref<unknown>,
  msgInputDom: Ref<HTMLElement | null>,
  emojiShow: Ref<boolean>
) {
  const logger = createLogger('useFooterEmoji')
  const { showFeedback } = useActionFeedback()
  const emojiStore = useEmojiStore()
  const historyStore = useHistoryStore()
  const { insertNodeAtRange, triggerInputEvent } = useCommon()

  const msgInputRef = MsgInputRef as Ref<MsgInputLike | null>

  const recentEmojis = computed(() => {
    return historyStore.emoji.slice(0, 15)
  })

  const checkIsUrl = (str: string) => {
    try {
      new URL(str)
      return true
    } catch {
      return false
    }
  }

  const resolveRecentRenderUrl = (url: string) => {
    const matched = emojiStore.emojiList.find((item) => item.expressionUrl === url)
    return matched?.localUrl || url
  }

  const isEmojiUrlPayload = (value: unknown): value is EmojiUrlPayload =>
    value !== null && typeof value === 'object' && typeof (value as { serverUrl?: unknown }).serverUrl === 'string'

  const sendEmojiWithDebounce = useDebounceFn((payload: EmojiUrlPayload) => {
    try {
      msgInputRef.value?.sendEmojiDirect(payload.serverUrl).catch((error: unknown) => {
        logger.error('发送表情包失败:', error)
        showFeedback('发送表情包失败', 'error')
      })
      updateRecentEmojis(payload.serverUrl)
    } catch (error) {
      logger.error('发送表情包失败:', error)
      showFeedback('发送表情包失败', 'error')
    }
  }, 200)

  const updateRecentEmojis = (emoji: string) => {
    const currentEmojis = [...historyStore.emoji]
    const index = currentEmojis.indexOf(emoji)
    if (index !== -1) {
      currentEmojis.splice(index, 1)
    }
    currentEmojis.unshift(emoji)
    const updatedEmojis = currentEmojis.slice(0, 15)
    historyStore.setEmoji(updatedEmojis)
  }

  const emojiHandle = async (item: string | EmojiUrlPayload, type: 'emoji' | 'emoji-url' = 'emoji') => {
    emojiShow.value = false

    const inp = msgInputDom.value
    if (!inp) {
      return
    }

    if (isMobile() && type === 'emoji-url') {
      const payload: EmojiUrlPayload = isEmojiUrlPayload(item)
        ? item
        : { renderUrl: typeof item === 'string' ? item : '', serverUrl: typeof item === 'string' ? item : '' }
      sendEmojiWithDebounce(payload)
      return
    }

    msgInputRef.value?.focus()

    let lastEditRange: SelectionRange | null = msgInputRef.value?.getLastEditRange() ?? null

    const isRangeInInput = (range: Range | null): boolean => {
      if (!range || !inp) return false
      try {
        return inp.contains(range.commonAncestorContainer)
      } catch {
        return false
      }
    }

    if (!lastEditRange || !isRangeInInput(lastEditRange.range)) {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0 && isRangeInInput(selection.getRangeAt(0))) {
        lastEditRange = {
          range: selection.getRangeAt(0),
          selection
        }
      } else {
        const range = document.createRange()
        range.selectNodeContents(inp)
        range.collapse(false)
        lastEditRange = {
          range,
          selection: window.getSelection()!
        }
      }
    }

    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(lastEditRange.range)
    }

    if (type === 'emoji-url') {
      const payload: EmojiUrlPayload = isEmojiUrlPayload(item)
        ? item
        : { renderUrl: typeof item === 'string' ? item : '', serverUrl: typeof item === 'string' ? item : '' }
      const renderUrl = payload.renderUrl || payload.serverUrl
      const serverUrl = payload.serverUrl || payload.renderUrl
      if (!renderUrl) return

      const imgElement = document.createElement('img')
      imgElement.src = renderUrl
      imgElement.style.maxWidth = '80px'
      imgElement.style.maxHeight = '80px'
      imgElement.dataset.type = 'emoji'
      if (serverUrl) {
        imgElement.dataset.serverUrl = serverUrl
      }

      lastEditRange.range.insertNode(imgElement)

      const range = document.createRange()
      range.setStartAfter(imgElement)
      range.collapse(true)
      selection?.removeAllRanges()
      selection?.addRange(range)
    } else {
      const emojiText = typeof item === 'string' ? item : ''
      insertNodeAtRange(MsgEnum.TEXT, emojiText, inp, lastEditRange)
    }

    msgInputRef.value?.updateSelectionRange()
    triggerInputEvent(inp)
    msgInputRef.value?.focus()

    if (type === 'emoji-url') {
      const payload: EmojiUrlPayload = isEmojiUrlPayload(item)
        ? item
        : { renderUrl: typeof item === 'string' ? item : '', serverUrl: typeof item === 'string' ? item : '' }
      updateRecentEmojis(payload.serverUrl || payload.renderUrl)
    } else {
      updateRecentEmojis(typeof item === 'string' ? item : '')
    }
  }

  return {
    recentEmojis,
    checkIsUrl,
    resolveRecentRenderUrl,
    emojiHandle,
    updateRecentEmojis
  }
}
