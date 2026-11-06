import type { Ref } from 'vue'
import { useTyping } from '@/composables/chat/useTyping'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'

interface Options {
  messageInputDom: Ref<HTMLElement | undefined>
  currentSessionRoomId: Ref<string>
  isAIMode: () => boolean
  isAIStreaming: () => boolean
  send: () => Promise<void>
  inputKeyDown: (event: KeyboardEvent) => void | Promise<void>
  handleInput: (event: Event) => void
  emitInput: (event: Event) => void
  emitSendAi: (content: string) => void
  emitStopAi: () => void
}

/**
 * 输入区发送入口：输入中状态（typing）、表单提交、AI/普通消息发送与回车分发。
 */
export const useMsgInputSendEntry = ({
  messageInputDom,
  currentSessionRoomId,
  isAIMode,
  isAIStreaming,
  send,
  inputKeyDown,
  handleInput,
  emitInput,
  emitSendAi,
  emitStopAi
}: Options) => {
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()
  const { startTyping, stopTyping } = useTyping()

  const typingTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
  const isTyping = ref(false)

  const handleFormSubmit = async (e: Event) => {
    e.preventDefault()
    if (currentSessionRoomId.value && isTyping.value) {
      isTyping.value = false
      if (typingTimeout.value) clearTimeout(typingTimeout.value)
      stopTyping(currentSessionRoomId.value)
    }
    await send()
  }

  const handleInternalInput = (e: Event) => {
    handleInput(e)
    emitInput(e)

    if (currentSessionRoomId.value && !isTyping.value) {
      isTyping.value = true
      startTyping(currentSessionRoomId.value, 30000)
    }

    if (typingTimeout.value) clearTimeout(typingTimeout.value)

    typingTimeout.value = setTimeout(() => {
      if (currentSessionRoomId.value && isTyping.value) {
        isTyping.value = false
        stopTyping(currentSessionRoomId.value)
      }
    }, 3000)
  }

  const getInputContent = (): string => {
    if (messageInputDom.value) {
      const innerHTML = messageInputDom.value.innerHTML || ''
      if (innerHTML.includes('data-type="emoji"')) return 'emoji'
      if (innerHTML.includes('<img') || innerHTML.includes('data-type=')) return 'image'
      return messageInputDom.value.textContent?.trim() || ''
    }
    return ''
  }

  const determineSendType = (): 'ai' | 'im' => {
    if (isAIMode()) return 'ai'
    return 'im'
  }

  const clearInput = () => {
    if (messageInputDom.value) {
      messageInputDom.value.textContent = ''
      const event = new Event('input', { bubbles: true })
      messageInputDom.value.dispatchEvent(event)
    }
  }

  const handleAISend = async () => {
    const content = getInputContent()
    if (!content.trim()) {
      showFeedback(t('message.empty_input'), 'warning')
      return
    }
    emitSendAi(content)
    clearInput()
  }

  const handleMobileSend = async () => {
    if (isAIMode() && isAIStreaming()) {
      useMitt.emit(MittEnum.AI_STOP_STREAMING)
    } else {
      await send()
    }
  }

  const handleDesktopSend = async () => {
    if (isAIMode() && isAIStreaming()) {
      useMitt.emit(MittEnum.AI_STOP_STREAMING)
    } else {
      await send()
    }
  }

  const handleEnterKey = (e: KeyboardEvent) => {
    if (determineSendType() === 'ai') {
      e.preventDefault()
      e.stopPropagation()
      if (isAIStreaming()) {
        emitStopAi()
        return
      }
      handleAISend()
    } else {
      inputKeyDown(e)
    }
  }

  return {
    handleFormSubmit,
    handleInternalInput,
    handleAISend,
    handleMobileSend,
    handleDesktopSend,
    handleEnterKey
  }
}
