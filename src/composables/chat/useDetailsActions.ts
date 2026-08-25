import { storeToRefs } from 'pinia'
import type { PropType } from 'vue'
import { nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { openMsgSession } from '@/composables/chat/openMsgSession'
import { useEnterChat } from '@/composables/chat/useEnterChat'
import { useIndependentChatWindow } from '@/composables/chat/useIndependentChatWindow'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useWindow } from '@/composables/common/useWindow'
import { CallTypeEnum, RoomTypeEnum } from '@/enums'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { isMobile } from '@/utils/PlatformConstants'

type ContentProp = { type: RoomTypeEnum; uid: string }

/**
 * 共享操作处理器 — 单聊和群聊详情面板共用的操作逻辑
 */
export function useDetailsActions(content: PropType<ContentProp> | ContentProp) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const { startRtcCall } = useWindow()
  const { enterChat } = useEnterChat()

  const contentValue = content as ContentProp

  /** 单聊对方离线校验：离线直接提示并中止拨号（群聊跳过） */
  const ensurePeerOnline = async (): Promise<boolean> => {
    const uid = contentValue.uid
    if (contentValue.type === RoomTypeEnum.GROUP || !uid) return true
    try {
      const presence = await matrixPresenceService.getPresence(uid)
      if (presence.presence === 'offline') {
        showFeedback(t('friend.context.friend_offline'), 'warning')
        return false
      }
    } catch {
      // presence 查询失败不阻断拨号，交给通话窗口处理应答超时
    }
    return true
  }

  const ensureSessionReady = async () => {
    const uid = contentValue.uid
    if (!uid) {
      showFeedback(t('home.chat_details.single.friend_info_missing'), 'warning')
      return false
    }

    const sessionType = contentValue.type === RoomTypeEnum.GROUP ? RoomTypeEnum.GROUP : RoomTypeEnum.SINGLE
    await openMsgSession(uid, sessionType)
    await nextTick()
    return true
  }

  const handleSendMessage = async () => {
    const uid = contentValue.uid
    if (!uid) {
      showFeedback(t('home.chat_details.single.friend_info_missing'), 'warning')
      return
    }
    const targetType = contentValue.type === RoomTypeEnum.GROUP ? 'room' : 'friend'
    await enterChat(uid, targetType)
  }

  const handleVoiceCall = async () => {
    if (!(await ensureSessionReady())) return
    if (!(await ensurePeerOnline())) return
    await startRtcCall(CallTypeEnum.AUDIO)
  }

  const handleVideoCall = async () => {
    if (!(await ensureSessionReady())) return
    if (!(await ensurePeerOnline())) return
    await startRtcCall(CallTypeEnum.VIDEO)
  }

  const handleOpenInNewWindow = async () => {
    const { openInNewWindow } = useIndependentChatWindow()
    if (contentValue.type === RoomTypeEnum.GROUP) {
      if (!contentValue.uid) {
        showFeedback(t('home.chat_details.single.friend_info_missing'), 'warning')
        return
      }
      await openInNewWindow(contentValue.uid)
      return
    }
    await handleSendMessage()
    const { currentSessionRoomId } = storeToRefs(useGlobalStore())
    if (currentSessionRoomId.value) {
      await openInNewWindow(currentSessionRoomId.value)
    }
  }

  return {
    isMobile,
    ensureSessionReady,
    handleSendMessage,
    handleVoiceCall,
    handleVideoCall,
    handleOpenInNewWindow
  }
}
