import type { Router } from 'vue-router'
import type { CallTypeEnum } from '@/enums'
import type { useChatStore } from '@/stores/domains/chat/chat'
import type { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'

const logger = createLogger('WsCallHandler')

type WebsocketConnectionStatePayload = {
  type?: string
  state?: string
  isReconnection?: boolean
  is_reconnection?: boolean
}

interface CallHandlerDeps {
  globalStore: ReturnType<typeof useGlobalStore>
  chatStore: ReturnType<typeof useChatStore>
  router: Router
  createRtcCallWindow: (
    isIncoming: boolean,
    remoteUserId: string,
    roomId: string,
    callType: CallTypeEnum
  ) => Promise<void>
  refreshActiveGroupMembers: () => Promise<void>
}

/**
 * 视频通话与 WebSocket 连接状态逻辑：
 * - handleVideoCall: 处理来电/去电的通话窗口唤起（桌面端开窗，移动端路由跳转）。
 * - handleWebsocketEvent: 处理 WebSocket 重连后的会话/群成员数据刷新。
 */
export function createCallHandler(deps: CallHandlerDeps) {
  const { globalStore, chatStore, router, createRtcCallWindow, refreshActiveGroupMembers } = deps

  let lastWsConnectionState: string | null = null
  let isReconnectInFlight = false

  const handleWebsocketEvent = async (event: { payload: WebsocketConnectionStatePayload | null | undefined }) => {
    const payload = event.payload
    if (payload?.type !== 'connectionStateChanged') return

    const previousState = (lastWsConnectionState || '').toUpperCase() || null
    const nextStateRaw = payload.state
    const nextState = typeof nextStateRaw === 'string' ? nextStateRaw.toUpperCase() : ''
    const isReconnectionFlag = payload.isReconnection ?? payload.is_reconnection
    const shouldHandleReconnect = nextState === 'CONNECTED' && isReconnectionFlag

    lastWsConnectionState = nextState || previousState

    if (!shouldHandleReconnect) return
    if (isReconnectInFlight || chatStore.syncLoading) return
    isReconnectInFlight = true

    chatStore.syncLoading = true
    try {
      await chatStore.getSessionList(true)
      await refreshActiveGroupMembers()
      if (globalStore.currentSessionRoomId) {
        const currentRoomId = globalStore.currentSessionRoomId
        const currentSession = chatStore.getSession(currentRoomId)
        await chatStore.fetchCurrentRoomRemoteOnce(20)
        if (currentSession?.unreadCount) {
          chatStore.markSessionRead(currentRoomId)
        }
      }
      globalStore.refreshUnreadBadge()
    } finally {
      chatStore.syncLoading = false
      isReconnectInFlight = false
    }
  }

  const handleVideoCall = async (remotedUid: string, callType: CallTypeEnum) => {
    logger.info(`监听到视频通话调用，remotedUid: ${remotedUid}, callType: ${callType}`)
    const currentSession = globalStore.currentSession
    const targetUid = remotedUid || currentSession?.detailId
    if (!targetUid) {
      logger.warn('当前会话尚未就绪或无法解析对端用户，忽略通话事件')
      return
    }
    if (isMobile()) {
      router.push({
        path: '/mobile/rtcCall',
        query: {
          remoteUserId: targetUid,
          roomId: globalStore.currentSessionRoomId,
          callType: callType,
          isIncoming: 'true'
        }
      })
    } else {
      await createRtcCallWindow(true, targetUid, globalStore.currentSessionRoomId, callType)
    }
  }

  return {
    handleVideoCall,
    handleWebsocketEvent
  }
}
