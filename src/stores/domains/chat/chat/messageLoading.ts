import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import pLimit from 'p-limit'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import matrixEventService from '@/services/matrix/MatrixEventService'
import { matrixRoomQueryService } from '@/services/matrix/room/QueryService'
import { matrixRoomRealtimeService } from '@/services/matrix/room/RealtimeService'
import type { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import type { useSessionStore } from './session'
import { type MessageType, pageSize } from './types'

const logger = createLogger('ChatMessageLoading')

interface MessageLoadingDeps {
  globalStore: ReturnType<typeof useGlobalStore>
  sessionStore: ReturnType<typeof useSessionStore>

  messageMap: Record<string, Record<string, MessageType>>
  messageOptions: Record<string, { isLast: boolean; isLoading: boolean; cursor: string; hasLoadedOnce?: boolean }>
  replyMapping: Record<string, Record<string, string[]>>

  currentMessageOptions: { value: { isLast: boolean; isLoading: boolean; cursor: string; hasLoadedOnce?: boolean } }
  currentReplyMap: { value: Record<string, string[]> }
  currentMsgReply: Ref<Partial<MessageType>>

  ensureSortedMessageState: (roomId: string) => void
  setSortedMessageKeys: (roomId: string, keys: string[]) => void
  mergeSortedMessageKeys: (roomId: string, incomingKeys: string[]) => void
  setMessageRoomIndex: (msgId: string, roomId: string) => void
  syncReplyReference: (roomId: string, sourceMsgId: string, msg?: MessageType) => void

  cleanupExpiredRecalledMessages: () => void
  clearOtherRoomsMessages: (currentRoomId: string) => void
  clearRoomMessagesExceptTransient: (roomId: string) => void
}

export const createMessageLoading = (deps: MessageLoadingDeps) => {
  const { t } = useI18n()
  const { showFeedback, startLoading, finishLoading, errorLoading } = useActionFeedback()
  const {
    globalStore,
    sessionStore,
    messageMap,
    messageOptions,
    replyMapping,
    currentMessageOptions,
    currentReplyMap,
    currentMsgReply,
    ensureSortedMessageState,
    setSortedMessageKeys,
    mergeSortedMessageKeys,
    setMessageRoomIndex,
    syncReplyReference,
    cleanupExpiredRecalledMessages,
    clearOtherRoomsMessages,
    clearRoomMessagesExceptTransient
  } = deps

  const getPageMsg = async (size: number, roomId: string, cursor: string = '', showLoadingBar = false) => {
    logger.info(`[getPageMsg] 开始加载房间消息 roomId=${roomId} cursor=${cursor}`)
    try {
      if (showLoadingBar) {
        startLoading()
      }
      const currentOptions = messageOptions[roomId] || {
        isLast: false,
        isLoading: false,
        cursor: '',
        hasLoadedOnce: false
      }
      messageOptions[roomId] = {
        ...currentOptions,
        isLoading: true
      }
      const result = await matrixEventService.getPagedRoomMessages(roomId, size, cursor)

      if (!messageMap[roomId]) {
        messageMap[roomId] = {}
      }
      ensureSortedMessageState(roomId)

      const newKeys: string[] = []
      for (const msg of result.messages) {
        const msgId = msg.message.id
        messageMap[roomId][msgId] = msg
        setMessageRoomIndex(msgId, roomId)
        syncReplyReference(roomId, msgId, msg)
        newKeys.push(msgId)
      }

      mergeSortedMessageKeys(roomId, newKeys)

      messageOptions[roomId] = {
        isLast: result.isLast,
        isLoading: false,
        cursor: result.cursor,
        hasLoadedOnce: true
      }
      if (showLoadingBar) {
        finishLoading()
      }
      logger.info(
        `[getPageMsg] 加载房间消息完成 roomId=${roomId} messages=${result.messages.length} isLast=${result.isLast} hasLoadedOnce=true`
      )
    } catch (err) {
      logger.error(`[getPageMsg] 获取消息失败 roomId=${roomId}:`, err)
      if (showLoadingBar) {
        errorLoading()
      }
      showFeedback(t('message.load_messages_failed'), 'error')
      messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '', hasLoadedOnce: true }
    }
  }

  const getMsgList = async (size = pageSize, showLoadingBar = false) => {
    await logger.info('获取消息列表')
    const requestRoomId = globalStore.currentSessionRoomId
    await getPageMsg(size, requestRoomId, currentMessageOptions.value?.cursor, showLoadingBar)
  }

  const setAllSessionMsgList = async (size = pageSize) => {
    await logger.info('初始设置所有会话消息列表')
    if (sessionStore.sessionList.length === 0) return

    const sortedSessions = [...sessionStore.sessionList].sort((a, b) => b.activeTime - a.activeTime)
    const limit = pLimit(5)
    const tasks = sortedSessions.map((session) => limit(() => getPageMsg(size, session.roomId, '', false)))
    const results = await Promise.allSettled(tasks)

    const successCount = results.filter((r) => r.status === 'fulfilled').length
    const failCount = results.filter((r) => r.status === 'rejected').length
    await logger.info(`会话消息加载完成: 成功 ${successCount}/${sortedSessions.length}, 失败 ${failCount}`)
  }

  const loadMore = async (size?: number) => {
    if (currentMessageOptions.value?.isLast) return
    await getMsgList(size, true)
  }

  const remoteSyncLocks = new Set<string>()
  const fetchCurrentRoomRemoteOnce = async (size = pageSize) => {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId) return
    if (remoteSyncLocks.has(roomId)) return
    remoteSyncLocks.add(roomId)
    try {
      const opts = messageOptions[roomId] || { isLast: false, isLoading: false, cursor: '', hasLoadedOnce: false }
      opts.cursor = ''
      messageOptions[roomId] = opts
      await getPageMsg(size, roomId, '', true)
    } finally {
      remoteSyncLocks.delete(roomId)
    }
  }

  const ensureSessionForRoom = async (roomId: string) => {
    if (!roomId) return
    if (sessionStore.getSession(roomId)) return
    try {
      const room = await matrixRoomQueryService.getRoom(roomId, false)
      if (!room) return
      const session = matrixRoomRealtimeService.convertRoomToSession(room)
      sessionStore.addSession({ ...session })
    } catch (err) {
      logger.warn('为缺失会话补充最小会话元信息失败:', roomId, err)
    }
  }

  // 已知不参与消息加载的窗口标签。
  // 主窗口是 'home'，移动端主窗口是 'mobile-home'，独立聊天窗口是 'message'。
  // 其它窗口（登录、截图、托盘等）不应执行 changeRoom。
  const NON_CHAT_WINDOW_LABELS = new Set(['login', 'capture', 'tray', 'notify', 'update', 'checkupdate'])

  const changeRoom = async () => {
    const currentWindowLabel = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
    const label = currentWindowLabel?.label ?? 'browser'
    if (currentWindowLabel && NON_CHAT_WINDOW_LABELS.has(label)) {
      logger.debug(`[changeRoom] 当前窗口 ${label} 不参与消息加载，直接返回`)
      return
    }

    const roomId = globalStore.currentSessionRoomId
    if (!roomId) {
      logger.debug('[changeRoom] 无当前会话 roomId，直接返回')
      return
    }

    logger.info(`[changeRoom] 开始切换房间 window=${label} roomId=${roomId}`)

    // 兜底：当用户从通知/搜索/好友页等入口打开一个尚未进入 sessionList 的会话时，
    // 消息能拉到但 session 取不到，会导致 ChatHeader 等依赖 currentSessionInfo 的 UI 缺数据。
    // 这里用实时 client 中的 Room 投影出一个最小会话补进去，使会话元信息就绪。
    await ensureSessionForRoom(roomId)
    clearOtherRoomsMessages(roomId)
    cleanupExpiredRecalledMessages()
    clearRoomMessagesExceptTransient(roomId)

    currentMessageOptions.value = {
      isLast: false,
      isLoading: true,
      cursor: '',
      hasLoadedOnce: false
    }

    if (currentReplyMap.value) {
      for (const key in currentReplyMap.value) {
        delete currentReplyMap.value[key]
      }
    }

    try {
      await getPageMsg(pageSize, roomId, '', true)
    } catch (err) {
      logger.error('[changeRoom] 无法加载消息:', err)
      currentMessageOptions.value = {
        isLast: false,
        isLoading: false,
        cursor: '',
        hasLoadedOnce: true
      }
    }

    logger.info(
      `[changeRoom] 切换房间结束 window=${label} roomId=${roomId} hasLoadedOnce=${currentMessageOptions.value?.hasLoadedOnce}`
    )

    if (globalStore.currentSessionRoomId) {
      sessionStore.markSessionRead(globalStore.currentSessionRoomId)
    }

    currentMsgReply.value = {}
  }

  const resetAndRefreshCurrentRoomMessages = async () => {
    if (!globalStore.currentSessionRoomId) return

    const requestRoomId = globalStore.currentSessionRoomId

    try {
      if (messageMap[requestRoomId]) {
        messageMap[requestRoomId] = {}
      }
      setSortedMessageKeys(requestRoomId, [])
      replyMapping[requestRoomId] = {}

      messageOptions[requestRoomId] = {
        isLast: false,
        isLoading: true,
        cursor: '',
        hasLoadedOnce: false
      }

      const currentReplyMapping = replyMapping[requestRoomId]
      if (currentReplyMapping) {
        for (const key in currentReplyMapping) {
          delete currentReplyMapping[key]
        }
      }

      await getPageMsg(pageSize, requestRoomId, '', true)

      logger.debug('已重置并刷新当前聊天室的消息列表')
    } catch (err) {
      logger.error('重置并刷新消息列表失败:', err)
      if (globalStore.currentSessionRoomId === requestRoomId) {
        messageOptions[requestRoomId] = {
          isLast: false,
          isLoading: false,
          cursor: '',
          hasLoadedOnce: true
        }
      }
    }
  }

  return {
    getPageMsg,
    getMsgList,
    setAllSessionMsgList,
    loadMore,
    fetchCurrentRoomRemoteOnce,
    changeRoom,
    resetAndRefreshCurrentRoomMessages
  }
}
