import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { openSecretChatUnlock } from '@/composables/secretChat/useSecretChatGate'
import { RoomTypeEnum } from '@/enums'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
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
 * 等待房间加密在**本地 room state** 生效的轮询参数。
 *
 * `enableEncryption` 只发送 `m.room.encryption` state event，而 SDK 的出站加密
 * 依据 `room.hasEncryptionStateEvent()`——本地 state 要等下一次 sync 才更新。
 * 若不等待就标记私密成功，窗口期内发出的消息仍是明文，等于对用户说谎。
 */
const ENCRYPTION_CONFIRM_ATTEMPTS = 5
const ENCRYPTION_CONFIRM_INTERVAL_MS = 1000

export interface TogglePrivateRoomOptions {
  /** 用户确认「开启不可逆的房间加密」；返回 false 则放弃设为私密。 */
  confirmEnableEncryption?: () => Promise<boolean>
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * 同一房间的在途切换。桌面菜单与移动端长按共用本 composable，
 * 而「设为私密」最长会等待约 4 秒（加密状态轮询），期间重复点击必须直接忽略，
 * 否则会重复弹「不可撤销」确认、重发 state event、重复写登记表。
 */
const inflightRoomIds = new Set<string>()

/** 有界轮询，直到本地 room state 确认已加密；超时返回 false。 */
const waitForEncryptionEffective = async (roomId: string): Promise<boolean> => {
  for (let attempt = 0; attempt < ENCRYPTION_CONFIRM_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(ENCRYPTION_CONFIRM_INTERVAL_MS)
    if ((await matrixCryptoService.getRoomEncryptionState(roomId)) === 'encrypted') return true
  }
  return false
}

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
  const togglePrivateRoom = async (item: SessionItem, options: TogglePrivateRoomOptions = {}): Promise<boolean> => {
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

    const roomId = item.roomId
    if (inflightRoomIds.has(roomId)) return false
    inflightRoomIds.add(roomId)

    try {
      const marked = isPrivateRoom(roomId)
      let encryptedNow = false

      // 只能单向：Matrix 房间加密不可关闭，取消私密不撤销加密。
      if (!marked) {
        const alreadyEncrypted = await matrixCryptoService.isRoomEncrypted(roomId)
        if (!alreadyEncrypted) {
          if (options.confirmEnableEncryption && !(await options.confirmEnableEncryption())) {
            return false
          }
          try {
            await matrixCryptoService.enableEncryption(roomId)
          } catch (e) {
            logger.error('开启房间加密失败:', e)
            showFeedback(t('home.secret_chat.encryption_failed'), 'error')
            return false
          }
          // 发出 state event 不等于本地已生效：等到本地 room state 确认，
          // 否则窗口期内发送的消息仍会明文出站，却被提示「已加密」。
          if (!(await waitForEncryptionEffective(roomId))) {
            logger.warn('房间加密已提交但本地状态未生效，跳过私密标记:', roomId)
            showFeedback(t('home.secret_chat.encryption_not_effective'), 'warning')
            return false
          }
          encryptedNow = true
        }
      }

      try {
        if (marked) {
          await unmarkRoomPrivate(roomId)
        } else {
          await markRoomPrivate(roomId)
        }
        // 兼容镜像：旧逻辑读 session.hide，保留一个版本避免两处不一致
        chatStore.updateSession(roomId, { hide: !marked })
        if (hasTauriRuntime()) {
          await invokeWithErrorHandler('hide_contact_command', {
            data: { roomId, hide: !marked }
          })
        }
        const successKey = marked
          ? 'menu.secret_chat_cancel'
          : encryptedNow
            ? 'menu.secret_chat_success_encrypted'
            : 'menu.secret_chat_success'
        showFeedback(t(successKey), 'success')
        return true
      } catch (e) {
        logger.error('切换私密房间标记失败:', e)
        showFeedback(String(e), 'error')
        return false
      }
    } finally {
      inflightRoomIds.delete(roomId)
    }
  }

  return { isRoomPrivate, togglePrivateRoom }
}
