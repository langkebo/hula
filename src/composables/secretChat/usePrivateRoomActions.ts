import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { openSecretChatUnlock } from '@/composables/secretChat/useSecretChatGate'
import { RoomTypeEnum } from '@/enums'
import { isPrivateRoom, markRoomPrivate, unmarkRoomPrivate } from '@/services/matrix/privateChat/privateRoomRegistry'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { isSecretChatUnlocked } from '@/stores/domains/settings/secretChatSession'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'

const logger = createLogger('PrivateRoomActions')

/**
 * 私密房间的标记 / 取消标记（方案 P0-0-e）。
 *
 * 三条约束：
 * 1. **必须先设密码并已解锁**——否则「私密」只是个标签，谁点都能看；
 * 2. **只允许单聊**——群聊成员无法控制，标成私密会产生假承诺；
 * 3. **登记表是唯一事实源**（`privateRoomRegistry`），`session.hide` 只作兼容镜像同步，
 *    同时把本地 SQLite 的 hide 标志一并更新（Rust 侧联系人列表仍读它）。
 */
export const usePrivateRoomActions = () => {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const settingStore = useSettingStore()
  const chatStore = useChatStore()

  /** 当前房间是否已标记为私密。 */
  const isRoomPrivate = (roomId: string): boolean => isPrivateRoom(roomId)

  /**
   * 切换私密标记。返回是否发生变更（被拦截时为 false）。
   */
  const togglePrivateRoom = async (item: SessionItem): Promise<boolean> => {
    if (!item.roomId) return false

    if (item.type !== RoomTypeEnum.SINGLE) {
      showFeedback(t('home.secret_chat.single_only'), 'warning')
      return false
    }
    if (!settingStore.isSecretChatConfigured()) {
      showFeedback(t('home.secret_chat.no_password'), 'warning')
      return false
    }
    if (!isSecretChatUnlocked()) {
      showFeedback(t('home.secret_chat.locked_hint'), 'warning')
      openSecretChatUnlock()
      return false
    }

    const marked = isPrivateRoom(item.roomId)
    try {
      if (marked) {
        await unmarkRoomPrivate(item.roomId)
      } else {
        await markRoomPrivate(item.roomId)
      }
      // 兼容镜像：旧逻辑读 session.hide，保留一个版本避免两处不一致
      chatStore.updateSession(item.roomId, { hide: !marked })
      if (hasTauriRuntime()) {
        await invokeWithErrorHandler('hide_contact_command', {
          data: { roomId: item.roomId, hide: !marked }
        })
      }
      showFeedback(marked ? t('menu.secret_chat_cancel') : t('menu.secret_chat_success'), 'success')
      return true
    } catch (e) {
      logger.error('切换私密房间标记失败:', e)
      showFeedback(String(e), 'error')
      return false
    }
  }

  return { isRoomPrivate, togglePrivateRoom }
}
