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
import { MittEnum, RoomTypeEnum } from '@/enums'
import router from '@/router'
import { useI18nGlobal } from '@/services/i18n'
import { matrixSessionService } from '@/services/matrix/auth/MatrixSessionService'
import matrixClientService from '@/services/matrix/MatrixClientService'
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
      // 此处手里是 roomId（!xxx:server），不能走默认 SINGLE 分支——
      // 那条链路把参数当 userId 喂给 DM 管理器（getDmForUser/createDm），
      // 触发 "Invalid user ID format: !xxx" ValidationError。
      // 按 roomId 直接取已同步房间构建会话；房间尚未同步时再退回
      // GROUP 详情查询（同样按 roomId 定位），两条路径都不经过 DM 管理器。
      const client = matrixClientService.getRoom(roomId)
      const detail = client
        ? matrixSessionService.buildSessionFromRoomPublic(client, null)
        : await matrixSessionService.getSessionDetailWithFriends({ id: roomId, roomType: RoomTypeEnum.GROUP })
      if (detail) {
        const { detailId, account, ...sessionBase } = detail
        chatStore.addSession?.({
          ...sessionBase,
          ...(detailId === undefined ? {} : { detailId }),
          ...(account === undefined ? {} : { account })
        })
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
  const sessionDetail = await matrixSessionService.getSessionDetailWithFriends({ id: uid, roomType: type })
  if (!sessionDetail) {
    showFeedback(t('hooks.session.detail_failed'), 'error')
    return
  }

  // 仅在 Tauri 环境下调用 hide_contact_command（本地数据库操作）
  // 非 Tauri 环境下跳过此步骤，不影响后续会话打开流程
  if (hasTauriRuntime()) {
    try {
      await invokeWithErrorHandler('hide_contact_command', { data: { roomId: sessionDetail.roomId, hide: false } })
    } catch {
      // hide_contact_command 失败不阻止会话打开，降级为 warn
      logger.warn(`hide_contact_command 失败，但不影响会话打开: ${sessionDetail.roomId}`)
    }
  }

  const chatStore = useChatStore()
  if (!chatStore.getSession(sessionDetail.roomId)) {
    const { detailId, account, ...sessionBase } = sessionDetail
    chatStore.addSession?.({
      ...sessionBase,
      ...(detailId === undefined ? {} : { detailId }),
      ...(account === undefined ? {} : { account })
    })
  }

  await focusSessionRoom(sessionDetail.roomId)
}

/**
 * F-6：进入会话时补投别名。
 *
 * 挂在这里而不是「建 DM 之后」的原因：DM 可能由**服务端**创建、由通知点击进入、
 * 由搜索/深链打开 —— 建 DM 的入口有四五处，而"进入会话"只有一个共同出口。
 * 一个钩子覆盖全部路径，也不会漏掉"服务端已经建好房间"的情况。
 *
 * fire-and-forget：别名投递失败不该挡住会话打开。
 */
async function syncContactAliasForRoom(roomId: string): Promise<void> {
  try {
    const client = matrixClientService.getClient()
    const myUserId = matrixClientService.getUserId()
    if (!client || !myUserId) return

    const room = client.getRoom(roomId)
    const members = room?.getJoinedMembers() ?? []
    if (members.length !== 2) return
    const peer = members.find((m) => m.userId !== myUserId)
    if (!peer) return

    const { applyAliasToDmRoom } = await import('@/services/matrix/aliases/applyContactAlias')
    const { hasContactAlias, loadContactAliases } = await import('@/services/matrix/aliases/contactAliasRegistry')
    await loadContactAliases()
    if (!hasContactAlias(peer.userId)) return
    await applyAliasToDmRoom(peer.userId)
  } catch (err) {
    logger.warn('补投联系人别名失败（忽略）:', err)
  }
}

export const openMsgSessionByRoomId = async (roomId: string) => {
  if (!roomId) {
    return
  }

  logger.info(`按 roomId 打开消息会话: ${roomId}`)
  void syncContactAliasForRoom(roomId)
  await focusSessionRoom(roomId)
}
