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
import { MittEnum } from '@/enums'
import { useMessage } from '@/hooks/useMessage.ts'
import { useMitt } from '@/hooks/useMitt.ts'
import router from '@/router'
import { matrixSessionService } from '@/services/matrix/auth/MatrixSessionService'
import { useChatStore } from '@/stores/domains/chat/chat'
import type { SessionItem } from '@/stores/domains/chat/chat/session'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { invokeWithErrorHandler } from '../../utils/TauriInvokeHandler'

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
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()
  const { handleMsgClick } = useMessage()

  const label = WebviewWindow.getCurrent().label
  if (router.currentRoute.value.name !== '/message' && label === 'home') {
    router.push('/message')
  }

  info('打开消息会话')
  const res = await matrixSessionService.getSessionDetailWithFriends({ id: uid, roomType: type })
  if (!res) {
    window.$message.error('获取会话详情失败')
    return
  }

  try {
    await invokeWithErrorHandler('hide_contact_command', { data: { roomId: res.roomId, hide: false } })
  } catch {
    window.$message.error('显示会话失败')
  }

  const existingSession = chatStore.getSession(res.roomId)
  if (!existingSession) {
    chatStore.updateSessionLastActiveTime(res.roomId)
    await chatStore.getSessionList(true)
  }
  globalStore.updateCurrentSessionRoomId(res.roomId)

  useMitt.emit(MittEnum.LOCATE_SESSION, { roomId: res.roomId })
  handleMsgClick(res as unknown as SessionItem)
  useMitt.emit(MittEnum.TO_SEND_MSG, { url: 'message' })
}
