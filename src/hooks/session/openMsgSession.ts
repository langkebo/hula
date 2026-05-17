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
import { info } from '@tauri-apps/plugin-log'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import router from '@/router'
import { useI18nGlobal } from '@/services/i18n'
import { matrixSessionService } from '@/services/matrix/auth/MatrixSessionService'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { invokeWithErrorHandler } from '../../utils/TauriInvokeHandler'

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

  globalStore.updateCurrentSessionRoomId(roomId)

  const label = WebviewWindow.getCurrent().label
  if (router.currentRoute.value.path !== '/message' && label === 'home') {
    await router.push('/message')
  }

  useMitt.emit(MittEnum.DETAILS_SHOW, { detailsShow: false, context: undefined })
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

  info('打开消息会话')
  const res = await matrixSessionService.getSessionDetailWithFriends({ id: uid, roomType: type })
  if (!res) {
    showFeedback(t('hooks.session.detail_failed'), 'error')
    return
  }

  try {
    await invokeWithErrorHandler('hide_contact_command', { data: { roomId: res.roomId, hide: false } })
  } catch {
    showFeedback(t('hooks.session.show_failed'), 'error')
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

  info(`按 roomId 打开消息会话: ${roomId}`)
  await focusSessionRoom(roomId)
}
