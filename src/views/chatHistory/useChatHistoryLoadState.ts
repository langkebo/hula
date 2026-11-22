import { type ComputedRef, computed, type Ref, ref } from 'vue'
import { useI18nGlobal } from '@/services/i18n'
import type { MessageType } from '@/stores/domains/chat/chat'
import { classifyLoadFailure, type MessageLoadFailureCategory } from '@/stores/domains/chat/chat/messageLoadFailure'

type LoadFailureIllustration = 'network-error' | 'server-error' | 'generic-error'

interface ChatHistoryLoadState {
  initialLoading: ComputedRef<boolean>
  initialLoadFailed: ComputedRef<boolean>
  isEmptyResult: ComputedRef<boolean>
  loadFailureMessage: ComputedRef<string>
  loadFailureIllustration: ComputedRef<LoadFailureIllustration>
  markLoadFailed: (err: unknown) => void
  resetLoadError: () => void
}

/**
 * 聊天记录页的首屏三态与失败分级展示。
 *
 * 文案分级复用会话消息加载的同一套归类（`classifyLoadFailure`），
 * 归类后回落到聊天主列表已注册的文案 key，避免两处各写一份措辞。
 */
export function useChatHistoryLoadState(messages: Ref<MessageType[]>, loading: Ref<boolean>): ChatHistoryLoadState {
  const { t } = useI18nGlobal()
  const loadError = ref<MessageLoadFailureCategory | null>(null)

  /** 首屏三态判定：仅在列表为空时生效，翻页加载不打断已有消息 */
  const initialLoading = computed(() => loading.value && messages.value.length === 0)
  const initialLoadFailed = computed(() => loadError.value !== null && messages.value.length === 0)
  const isEmptyResult = computed(() => messages.value.length === 0)

  const loadFailureMessage = computed(() => {
    switch (loadError.value) {
      case 'network':
        return t('home.chat_main.load_failed_network')
      case 'permission':
        return t('home.chat_main.load_failed_permission')
      case 'server':
        return t('home.chat_main.load_failed_server')
      default:
        return t('home.chat_main.load_failed_desc')
    }
  })

  const loadFailureIllustration = computed<LoadFailureIllustration>(() => {
    switch (loadError.value) {
      case 'network':
        return 'network-error'
      case 'server':
        return 'server-error'
      default:
        return 'generic-error'
    }
  })

  const markLoadFailed = (err: unknown) => {
    loadError.value = classifyLoadFailure(err)
  }

  const resetLoadError = () => {
    loadError.value = null
  }

  return {
    initialLoading,
    initialLoadFailed,
    isEmptyResult,
    loadFailureMessage,
    loadFailureIllustration,
    markLoadFailed,
    resetLoadError
  }
}
