import { type Ref, ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/hooks/useMitt.ts'
import { useI18nGlobal } from '@/services/i18n'
import { conversationService } from '@/services/matrix/ai/ConversationService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AiTitleEdit')

interface UseAiTitleEditOptions {
  currentChat: Ref<{ id: string; title: string }>
}

export const useAiTitleEdit = ({ currentChat }: UseAiTitleEditOptions) => {
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()
  const isEdit = ref(false)
  const originalTitle = ref('')

  const handleBlur = async () => {
    isEdit.value = false
    if (originalTitle.value === currentChat.value.title) {
      return
    }
    if (currentChat.value.title === '') {
      currentChat.value.title = t('ai_assistant.robot.new_chat_with_id', { id: currentChat.value.id })
    }

    try {
      await conversationService.update({
        id: currentChat.value.id,
        title: currentChat.value.title
      })
      useMitt.emit('update-chat-title', { title: currentChat.value.title, id: currentChat.value.id })
    } catch (error) {
      logger.error('更新会话标题失败:', error)
      showFeedback(t('ai_assistant.robot.rename_failed'), 'error')
      currentChat.value.title = originalTitle.value
    }
  }

  const handleEdit = () => {
    originalTitle.value = currentChat.value.title
    isEdit.value = true
  }

  return {
    isEdit,
    originalTitle,
    handleBlur,
    handleEdit
  }
}
