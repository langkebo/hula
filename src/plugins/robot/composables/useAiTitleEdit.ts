import { type Ref, ref } from 'vue'
import { useMitt } from '@/hooks/useMitt.ts'
import { conversationService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AiTitleEdit')

interface UseAiTitleEditOptions {
  currentChat: Ref<{ id: string; title: string }>
}

export const useAiTitleEdit = ({ currentChat }: UseAiTitleEditOptions) => {
  const isEdit = ref(false)
  const originalTitle = ref('')

  const handleBlur = async () => {
    isEdit.value = false
    if (originalTitle.value === currentChat.value.title) {
      return
    }
    if (currentChat.value.title === '') {
      currentChat.value.title = `新的聊天${currentChat.value.id}`
    }

    try {
      await conversationService.update({
        id: currentChat.value.id,
        title: currentChat.value.title
      })
      useMitt.emit('update-chat-title', { title: currentChat.value.title, id: currentChat.value.id })
    } catch (error) {
      logger.error('更新会话标题失败:', error)
      window.$message.error('重命名失败')
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
