import { type Ref, ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { useI18nGlobal } from '@/services/i18n'
import { aiService } from '@/services/matrix/ai/AIService'
import type { ChatRole } from '@/services/matrix/ai/ChatRoleService'
import { conversationService } from '@/services/matrix/ai/ConversationService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AiRoleManagement')
const { t } = useI18nGlobal()

interface UseAiRoleManagementOptions {
  currentChat: Ref<{ id: string }>
}

export const useAiRoleManagement = ({ currentChat }: UseAiRoleManagementOptions) => {
  const { showFeedback, clearFeedback } = useActionFeedback()
  const showRolePopover = ref(false)
  const selectedRole = ref<ChatRole | null>(null)
  const roleList = ref<ChatRole[]>([])
  const roleLoading = ref(false)

  const loadRoleList = async () => {
    roleLoading.value = true
    try {
      const data = await aiService.chatRolePage({ pageNo: 1, pageSize: 100 })
      roleList.value = ((data.list || []) as ChatRole[]).filter((item) => item.status === 0)
      if (!selectedRole.value && roleList.value.length > 0) {
        selectedRole.value = roleList.value[0]
      }
    } catch (error) {
      logger.error('加载角色列表失败:', error)
      showFeedback(t('ai_assistant.robot.load_role_list_failed'), 'error')
    } finally {
      roleLoading.value = false
    }
  }

  const handleSelectRole = async (role: ChatRole) => {
    selectedRole.value = role ? { ...role } : null
    showRolePopover.value = false

    try {
      if (currentChat.value.id && currentChat.value.id !== '0') {
        await conversationService.update({
          id: currentChat.value.id,
          roleId: role.id,
          modelId: role.modelId || undefined
        })
      } else {
        showFeedback(t('ai_assistant.robot.role_selected', { name: role.name }), 'success')
      }
    } catch (error) {
      logger.error('切换角色失败:', error)
      clearFeedback()
      showFeedback(t('ai_assistant.robot.switch_role_failed'), 'error')
    }
  }

  const handleOpenRoleManagement = () => {
    showRolePopover.value = false
    useMitt.emit('open-role-management')
  }

  const handleRefreshRoleList = () => {
    void loadRoleList()
  }

  return {
    showRolePopover,
    selectedRole,
    roleList,
    roleLoading,
    loadRoleList,
    handleSelectRole,
    handleOpenRoleManagement,
    handleRefreshRoleList
  }
}
