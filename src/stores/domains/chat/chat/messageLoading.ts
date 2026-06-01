import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import pLimit from 'p-limit'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import matrixEventService from '@/services/matrix/MatrixEventService'
import type { useGlobalStore } from '@/stores/domains/widget/global'
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
  const { showFeedback } = useActionFeedback()
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
    try {
      if (showLoadingBar && window.$loadingBar) {
        window.$loadingBar.start()
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
      if (showLoadingBar && window.$loadingBar) {
        window.$loadingBar.finish()
      }
    } catch (err) {
      logger.error('获取消息失败:', err)
      if (showLoadingBar && window.$loadingBar) {
        window.$loadingBar.error()
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

  const changeRoom = async () => {
    const currentWindowLabel = WebviewWindow.getCurrent()
    if (currentWindowLabel.label !== 'home' && currentWindowLabel.label !== 'mobile-home') {
      return
    }

    if (!globalStore.currentSessionRoomId) return

    const roomId = globalStore.currentSessionRoomId
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
      logger.error('无法加载消息:', err)
      currentMessageOptions.value = {
        isLast: false,
        isLoading: false,
        cursor: '',
        hasLoadedOnce: true
      }
    }

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
