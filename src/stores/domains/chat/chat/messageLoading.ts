import type { Ref } from 'vue'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import pLimit from 'p-limit'
import matrixEventService from '@/services/matrix/MatrixEventService'
import { createLogger } from '@/utils/Logger'
import type { useGlobalStore } from '@/stores/domains/widget/global'
import type { useSessionStore } from './session'
import { pageSize, type MessageType } from './types'

const logger = createLogger('ChatMessageLoading')

interface MessageLoadingDeps {
  globalStore: ReturnType<typeof useGlobalStore>
  sessionStore: ReturnType<typeof useSessionStore>

  messageMap: Record<string, Record<string, MessageType>>
  messageOptions: Record<string, { isLast: boolean; isLoading: boolean; cursor: string }>
  replyMapping: Record<string, Record<string, string[]>>

  currentMessageOptions: { value: { isLast: boolean; isLoading: boolean; cursor: string } }
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

  const getPageMsg = async (size: number, roomId: string, cursor: string = '', _async?: boolean) => {
    try {
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
        cursor: result.cursor
      }
    } catch (err) {
      logger.error('获取消息失败:', err)
      messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '' }
    }
  }

  const getMsgList = async (size = pageSize, async?: boolean) => {
    await info('获取消息列表')
    const requestRoomId = globalStore.currentSessionRoomId
    await getPageMsg(size, requestRoomId, currentMessageOptions.value?.cursor, async)
  }

  const setAllSessionMsgList = async (size = pageSize) => {
    await info('初始设置所有会话消息列表')
    if (sessionStore.sessionList.length === 0) return

    const sortedSessions = [...sessionStore.sessionList].sort((a, b) => b.activeTime - a.activeTime)
    const limit = pLimit(5)
    const tasks = sortedSessions.map((session) => limit(() => getPageMsg(size, session.roomId, '', true)))
    const results = await Promise.allSettled(tasks)

    const successCount = results.filter((r) => r.status === 'fulfilled').length
    const failCount = results.filter((r) => r.status === 'rejected').length
    await info(`会话消息加载完成: 成功 ${successCount}/${sortedSessions.length}, 失败 ${failCount}`)
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
      const opts = messageOptions[roomId] || { isLast: false, isLoading: false, cursor: '' }
      opts.cursor = ''
      messageOptions[roomId] = opts
      await getPageMsg(size, roomId, '')
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
      isLoading: false,
      cursor: ''
    }

    if (currentReplyMap.value) {
      for (const key in currentReplyMap.value) {
        delete currentReplyMap.value[key]
      }
    }

    try {
      await getPageMsg(pageSize, roomId, '')
    } catch (err) {
      logger.error('无法加载消息:', err)
      currentMessageOptions.value = {
        isLast: false,
        isLoading: false,
        cursor: ''
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
        cursor: ''
      }

      const currentReplyMapping = replyMapping[requestRoomId]
      if (currentReplyMapping) {
        for (const key in currentReplyMapping) {
          delete currentReplyMapping[key]
        }
      }

      await getPageMsg(pageSize, requestRoomId, '')

      logger.debug('已重置并刷新当前聊天室的消息列表')
    } catch (err) {
      logger.error('重置并刷新消息列表失败:', err)
      if (globalStore.currentSessionRoomId === requestRoomId) {
        messageOptions[requestRoomId] = {
          isLast: false,
          isLoading: false,
          cursor: ''
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
