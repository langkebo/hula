import { type Ref, ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import { roomStateService } from '@/services/matrix/room/RoomStateService'
import { useGroupStore } from '@/stores/domains/chat/group'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ChatMain.GroupNicknameModal')

export type GroupNicknameModalPayload = {
  roomId: string
  currentUid: string
  originalNickname: string
}

type Options = {
  /** 当前登录用户 uid，用于判断是否在改自己的昵称 */
  userUid: Ref<string | undefined>
  /** 翻译函数（vue-i18n t） */
  t: (key: string) => string
  /** 是否监听 mitt 打开事件 —— 老接口兼容开关 */
  enableMitt?: boolean
}

/**
 * 群昵称修改弹窗状态与提交逻辑。
 *
 * 从 useChatMain 抽出：一个可见性/输入/错误/loading/上下文的 5-ref 组，
 * 加一个提交动作和（可选）mitt 订阅。订阅的反注册由调用方通过
 * `onUnmounted(() => useMitt.off(...))` 负责 —— 这里保持与原实现一致的
 * 注册时机（当前 useChatMain 也没显式 off）。
 */
export const useGroupNicknameModal = ({ userUid, t, enableMitt = false }: Options) => {
  const groupStore = useGroupStore()
  const { showFeedback } = useActionFeedback()

  const groupNicknameModalVisible = ref(false)
  const groupNicknameValue = ref('')
  const groupNicknameError = ref('')
  const groupNicknameSubmitting = ref(false)
  const groupNicknameContext = ref<GroupNicknameModalPayload | null>(null)

  const openGroupNicknameModal = (payload: GroupNicknameModalPayload) => {
    groupNicknameContext.value = payload
    groupNicknameValue.value = payload.originalNickname || ''
    groupNicknameError.value = ''
    groupNicknameSubmitting.value = false
    groupNicknameModalVisible.value = true
  }

  const handleGroupNicknameConfirm = async () => {
    if (!groupNicknameContext.value) {
      return
    }

    const trimmedName = groupNicknameValue.value.trim()
    if (!trimmedName) {
      groupNicknameError.value = t('home.chat_main.group_nickname.error.empty')
      return
    }

    if (trimmedName === groupNicknameContext.value.originalNickname) {
      groupNicknameModalVisible.value = false
      return
    }

    const { roomId, currentUid } = groupNicknameContext.value
    if (!roomId) {
      showFeedback(t('home.chat_main.group_nickname.error.invalid_room'), 'error')
      return
    }

    try {
      groupNicknameSubmitting.value = true
      await roomStateService.setMemberDisplayName(roomId, trimmedName)
      groupStore.updateUserItem(currentUid, { myName: trimmedName }, roomId)
      await groupStore.updateGroupDetail(roomId, { myName: trimmedName })
      if (currentUid === userUid.value) {
        groupStore.myNameInCurrentGroup = trimmedName
      }
      groupNicknameModalVisible.value = false
    } catch (error) {
      logger.error('修改群昵称失败', error)
      groupNicknameSubmitting.value = false
    }
  }

  if (enableMitt) {
    useMitt.on(MittEnum.OPEN_GROUP_NICKNAME_MODAL, openGroupNicknameModal as (payload: unknown) => void)
  }

  return {
    groupNicknameModalVisible,
    groupNicknameValue,
    groupNicknameError,
    groupNicknameSubmitting,
    groupNicknameContext,
    openGroupNicknameModal,
    handleGroupNicknameConfirm
  }
}
