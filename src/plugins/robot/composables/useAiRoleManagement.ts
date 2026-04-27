import { ref, type Ref } from 'vue'
import { useMitt } from '@/hooks/useMitt.ts'
import type { ChatRole } from '@/services/matrix'
import { aiService, conversationService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AiRoleManagement')

interface UseAiRoleManagementOptions {
  currentChat: Ref<{ id: string }>
}

export const useAiRoleManagement = ({ currentChat }: UseAiRoleManagementOptions) => {
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
      window.$message.error('加载角色列表失败')
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
        window.$message.success(`已选择角色: ${role.name}`)
      }
    } catch (error) {
      logger.error('切换角色失败:', error)
      window.$message.destroyAll()
      window.$message.error('切换角色失败')
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
