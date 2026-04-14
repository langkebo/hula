import { ref, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { createLogger } from '@/utils/Logger'
import { useEmojiStore } from '@/stores/emoji'
import { useChatStore } from '@/stores/chat'
import { useGlobalStore } from '@/stores/global'
import { useContactStore } from '@/stores/contacts'
import { RoomTypeEnum } from '@/enums'

const logger = createLogger('useChatFooter')

export interface EmojiUrlPayload {
  renderUrl: string
  serverUrl: string
}

export function useChatFooter() {
  const emojiStore = useEmojiStore()
  const _chatStore = useChatStore()
  const globalStore = useGlobalStore()
  const contactStore = useContactStore()

  const emojiShow = ref(false)
  const recentlyTip = ref(false)
  const isBurnAfterRead = ref(false)

  const recentEmojis = computed(() => {
    const recent = localStorage.getItem('recentEmojis')
    return recent ? JSON.parse(recent) : []
  })

  const isSingleChat = computed(() => {
    const session = globalStore.currentSession
    return session?.type === RoomTypeEnum.SINGLE
  })

  const isFriend = computed(() => {
    const targetUserId = globalStore.currentSession?.id
    if (!targetUserId) return false
    return contactStore.contactsList.some((contact) => contact.userId === targetUserId)
  })

  watch(emojiShow, (newValue) => {
    if (newValue === true) {
      recentlyTip.value = false
    }
  })

  const checkIsUrl = (str: string): boolean => {
    try {
      new URL(str)
      return true
    } catch {
      return false
    }
  }

  const resolveRecentRenderUrl = (url: string): string => {
    const matched = emojiStore.emojiList.find((item) => item.expressionUrl === url)
    return matched?.localUrl || url
  }

  const updateRecentEmojis = (emoji: string) => {
    const recent = [...recentEmojis.value]
    const index = recent.indexOf(emoji)
    if (index > -1) {
      recent.splice(index, 1)
    }
    recent.unshift(emoji)
    if (recent.length > 20) {
      recent.pop()
    }
    localStorage.setItem('recentEmojis', JSON.stringify(recent))
  }

  const sendEmojiWithDebounce = useDebounceFn((payload: EmojiUrlPayload, sendFn: (url: string) => Promise<void>) => {
    try {
      sendFn(payload.serverUrl).catch((error: unknown) => {
        logger.error('发送表情包失败:', error)
        window.$message?.error?.('发送表情包失败')
      })
      updateRecentEmojis(payload.serverUrl)
    } catch (error) {
      logger.error('发送表情包失败:', error)
      window.$message?.error?.('发送表情包失败')
    }
  }, 200)

  const emojiHandle = async (
    item: string | EmojiUrlPayload,
    type: 'emoji' | 'emoji-url' = 'emoji',
    sendFn?: (url: string) => Promise<void>,
    inputDom?: HTMLInputElement
  ) => {
    if (type === 'emoji-url') {
      const payload = item as EmojiUrlPayload
      if (sendFn) {
        sendEmojiWithDebounce(payload, sendFn)
      }
    } else {
      const emoji = item as string
      updateRecentEmojis(emoji)
      if (inputDom) {
        insertTextAtCursor(inputDom, emoji)
      }
    }
  }

  const insertTextAtCursor = (input: HTMLInputElement, text: string) => {
    const start = input.selectionStart ?? 0
    const end = input.selectionEnd ?? 0
    const value = input.value
    input.value = value.slice(0, start) + text + value.slice(end)
    input.selectionStart = input.selectionEnd = start + text.length
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const toggleBurnAfterRead = () => {
    isBurnAfterRead.value = !isBurnAfterRead.value
  }

  return {
    emojiShow,
    recentlyTip,
    isBurnAfterRead,
    recentEmojis,
    isSingleChat,
    isFriend,
    checkIsUrl,
    resolveRecentRenderUrl,
    updateRecentEmojis,
    emojiHandle,
    toggleBurnAfterRead
  }
}
