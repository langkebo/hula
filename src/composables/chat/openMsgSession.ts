/**
 * Open / focus a 1:1 or group session by uid.
 *
 * Extracted from `useCommon` so that the hundred-line side-effect chain
 * (route push → fetch session detail → unhide → maybe refetch list →
 * focus + locate + signal toolbar) lives in its own module and can be
 * imported directly from any caller without dragging the rest of
 * `useCommon` along.
 */
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import router from '@/router'
import { useI18nGlobal } from '@/services/i18n'
import { matrixSessionService } from '@/services/matrix/auth/MatrixSessionService'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { invokeWithErrorHandler } from '../../utils/TauriInvokeHandler'

const logger = createLogger('openMsgSession')

const SESSION_READY_TIMEOUT_MS = 1500
const SESSION_READY_POLL_INTERVAL_MS = 100

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function focusSessionRoom(roomId: string) {
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()

  let existingSession = chatStore.getSession(roomId)
  if (!existingSession) {
    chatStore.updateSessionLastActiveTime(roomId)
    await chatStore.getSessionList(true)
    existingSession = chatStore.getSession(roomId)
  }

  if (!existingSession) {
    const deadline = Date.now() + SESSION_READY_TIMEOUT_MS
    while (Date.now() < deadline) {
      await sleep(SESSION_READY_POLL_INTERVAL_MS)
      await chatStore.getSessionList(true)
      existingSession = chatStore.getSession(roomId)
      if (existingSession) {
        break
      }
    }
  }

  // 兜底：轮询超时仍未同步到该 room（降级 / 慢网络 / DM 管理器未就绪），
  // 主动拉取会话详情并写入 store，确保 currentSessionInfo 能派生；
  // 否则消息视图 watch(currentSessionInfo) 不触发 → 会话不切换（按钮“无反应”）。
  if (!existingSession) {
    try {
      const detail = await matrixSessionService.getSessionDetailWithFriends(roomId)
      if (detail) {
        chatStore.addSession?.(detail)
        existingSession = chatStore.getSession(roomId)
      }
    } catch (err) {
      logger.warn(`[openMsgSession] 兜底拉取会话详情失败，会话视图可能不切换: ${err}`)
    }
  }

  globalStore.updateCurrentSessionRoomId(roomId)

  // 跳转条件：当前不在 /message 路由时跳转
  // 直接导航到 /message/:roomId，避免两步导航导致的中间状态问题
  // Tauri 环境下检查窗口 label：仅在 'message' 独立聊天窗口中不重复跳转
  // 其他窗口（home、contact、friend 等）都应跳转到 /message
  const currentPath = router.currentRoute.value.path
  const targetRoute = { name: 'message', params: { roomId } }
  if (currentPath !== '/message') {
    if (hasTauriRuntime()) {
      try {
        const label = WebviewWindow.getCurrent().label
        // 'message' 窗口本身就是聊天窗口，无需跳转；其他窗口都需要跳转
        if (label !== 'message') {
          await router.push(targetRoute)
        }
      } catch {
        // WebviewWindow.getCurrent() 失败时也跳转
        await router.push(targetRoute)
      }
    } else {
      await router.push(targetRoute)
    }
  } else if (router.currentRoute.value.params.roomId !== roomId) {
    // 已在 /message 但 roomId 不同，更新路由参数
    await router.push(targetRoute)
  }

  // 阶段 2：路由驱动后，跳转到 /message 自动隐藏右侧栏详情视图，
  // 无需再通过 mitt 事件显式关闭 DETAILS_SHOW。
  chatStore.markSessionRead?.(roomId)
  useMitt.emit(MittEnum.LOCATE_SESSION, { roomId })
  useMitt.emit(MittEnum.TO_SEND_MSG, { url: 'message' })
}

/**
 * Open the chat session for `uid`. `type` defaults to `2` (single chat).
 *
 * Side-effects, in order:
 * 1. Route to `/message` when the current home window is on a different page.
 * 2. Fetch session detail; surface a toast on failure.
 * 3. Unhide the session if it was previously hidden (best-effort).
 * 4. If the session is new, refresh the session list while preserving the
 *    currently selected room.
 * 5. Update the global current-session id and emit `LOCATE_SESSION` /
 *    `TO_SEND_MSG` so the message list scrolls and the toolbar focuses.
 */
export const openMsgSession = async (uid: string, type: number = 2) => {
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()

  logger.info('打开消息会话')
  const res = await matrixSessionService.getSessionDetailWithFriends({ id: uid, roomType: type })
  if (!res) {
    showFeedback(t('hooks.session.detail_failed'), 'error')
    return
  }

  // 仅在 Tauri 环境下调用 hide_contact_command（本地数据库操作）
  // 非 Tauri 环境下跳过此步骤，不影响后续会话打开流程
  if (hasTauriRuntime()) {
    try {
      await invokeWithErrorHandler('hide_contact_command', { data: { roomId: res.roomId, hide: false } })
    } catch {
      // hide_contact_command 失败不阻止会话打开，降级为 warn
      logger.warn(`hide_contact_command 失败，但不影响会话打开: ${res.roomId}`)
    }
  }

  const chatStore = useChatStore()
  if (!chatStore.getSession(res.roomId)) {
    chatStore.addSession?.(res)
  }

  await focusSessionRoom(res.roomId)
}

export const openMsgSessionByRoomId = async (roomId: string) => {
  if (!roomId) {
    return
  }

  logger.info(`按 roomId 打开消息会话: ${roomId}`)
  await focusSessionRoom(roomId)
}
