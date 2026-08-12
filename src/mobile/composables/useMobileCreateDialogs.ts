import { showFailToast, showToast } from 'vant'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixDirectMessageService, matrixRoomCreationService } from '@/services/matrix'
import { useChatStore } from '@/stores/domains/chat/chat'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileCreateDialogs')

interface CreateDialogsOptions {
  /** 添加菜单关闭时(选择项后)联动关闭蒙板 */
  maskHandler: { close: () => void }
  /** 跳转聊天室 */
  goToChatRoom: (roomId: string) => void
  /** 跳转添加联系人页 */
  goToAddContact: () => void
}

/**
 * 移动端新建会话对话框 composable
 * 负责:添加菜单 popover、新建单聊对话框、创建群组对话框
 */
export function useMobileCreateDialogs(opts: CreateDialogsOptions) {
  const { t } = useI18n()
  const chatStore = useChatStore()

  const showAddPopover = ref(false)
  const addActions = [
    { text: t('mobile_home.menu.new_chat'), value: 'newChat' },
    { text: t('mobile_home.menu.create_group_chat'), value: 'createGroupChat' },
    { text: t('menu.add_contact'), value: '/mobile/mobileFriends/addFriends' }
  ]

  const showNewChatDialog = ref(false)
  const newChatUserId = ref('')
  const showCreateGroupDialog = ref(false)
  const createGroupName = ref('')
  const createGroupMemberIds = ref('')

  const onAddActionSelect = async (action: { text: string; value: string }) => {
    showAddPopover.value = false
    opts.maskHandler.close()

    if (action.value === 'newChat') {
      handleNewChat()
    } else if (action.value === 'createGroupChat') {
      handleCreateGroupChat()
    } else {
      opts.goToAddContact()
    }
  }

  function handleNewChat() {
    newChatUserId.value = ''
    showNewChatDialog.value = true
  }

  async function beforeCloseNewChat(action: string): Promise<boolean> {
    if (action === 'cancel') {
      showNewChatDialog.value = false
      return true
    }

    const userId = newChatUserId.value.trim()
    if (!userId) {
      showFailToast(t('mobile_home.user_id_required'))
      return false
    }

    try {
      showToast({ type: 'loading', message: t('mobile_home.new_chat_creating'), forbidClick: true })
      const roomId = await matrixDirectMessageService.createDm(userId)
      showToast({ type: 'success', message: t('mobile_home.new_chat_success') })
      showNewChatDialog.value = false
      await chatStore.getSessionList(true)
      opts.goToChatRoom(roomId)
      return true
    } catch (e) {
      logger.error('Create DM failed:', e)
      showFailToast(e instanceof Error ? e.message : String(e) || t('mobile_home.new_chat_failed'))
      return false
    }
  }

  function handleCreateGroupChat() {
    createGroupName.value = ''
    createGroupMemberIds.value = ''
    showCreateGroupDialog.value = true
  }

  async function beforeCloseCreateGroup(action: string): Promise<boolean> {
    if (action === 'cancel') {
      showCreateGroupDialog.value = false
      return true
    }

    const name = createGroupName.value.trim()
    if (!name) {
      showFailToast(t('mobile_home.group_name_required'))
      return false
    }

    const memberIds = createGroupMemberIds.value
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)

    try {
      showToast({ type: 'loading', message: t('mobile_home.create_group_creating'), forbidClick: true })
      const room = await matrixRoomCreationService.createGroupRoom({
        name,
        invite: memberIds
      })

      if (room?.roomId) {
        showToast({ type: 'success', message: t('mobile_home.create_group_success') })
        showCreateGroupDialog.value = false
        await chatStore.getSessionList(true)
        opts.goToChatRoom(room.roomId)
      }
      return true
    } catch (e) {
      logger.error('Create group chat failed:', e)
      showFailToast(e instanceof Error ? e.message : String(e) || t('mobile_home.create_group_failed'))
      return false
    }
  }

  return {
    showAddPopover,
    addActions,
    showNewChatDialog,
    newChatUserId,
    showCreateGroupDialog,
    createGroupName,
    createGroupMemberIds,
    onAddActionSelect,
    handleNewChat,
    beforeCloseNewChat,
    handleCreateGroupChat,
    beforeCloseCreateGroup
  }
}

export type MobileCreateDialogsReturn = ReturnType<typeof useMobileCreateDialogs>
