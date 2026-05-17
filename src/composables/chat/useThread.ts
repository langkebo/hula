import type { MatrixEvent } from 'matrix-js-sdk'
import {
  matrixThreadService,
  type Thread,
  type ThreadDisplayMessage,
  type ThreadListItem,
  type ThreadStatistics,
  type ThreadSubscription,
  type ThreadViewData
} from '@/services/matrix/messaging/MatrixThreadService'

export type { Thread, ThreadDisplayMessage, ThreadListItem, ThreadStatistics, ThreadSubscription, ThreadViewData }

export function useThread() {
  const createThread = (roomId: string, rootEventId: string, initialReply?: { body: string; html?: string }) => {
    return matrixThreadService.createThread(roomId, rootEventId, initialReply)
  }

  const sendThreadReply = (
    roomId: string,
    threadRootId: string,
    content: { body: string; html?: string; msgtype?: string }
  ) => {
    return matrixThreadService.sendThreadReply(roomId, threadRootId, content)
  }

  const getThread = (roomId: string, threadRootId: string): Thread | null => {
    return matrixThreadService.getThread(roomId, threadRootId)
  }

  const getThreadReplies = (roomId: string, threadRootId: string) => {
    return matrixThreadService.getThreadReplies(roomId, threadRootId)
  }

  const getThreadMessages = (roomId: string, threadRootId: string) => {
    return matrixThreadService.getThreadMessages(roomId, threadRootId)
  }

  const getThreadViewData = (roomId: string, threadRootId: string): ThreadViewData => {
    return matrixThreadService.getThreadViewData(roomId, threadRootId)
  }

  const getThreadsInRoom = (roomId: string): Thread[] => {
    return matrixThreadService.getThreadsInRoom(roomId)
  }

  const isThreadRoot = (event: Parameters<typeof matrixThreadService.isThreadRoot>[0]) => {
    return matrixThreadService.isThreadRoot(event)
  }

  const isInThread = (event: Parameters<typeof matrixThreadService.isInThread>[0]) => {
    return matrixThreadService.isInThread(event)
  }

  const isBodyInThread = (body: Record<string, unknown>) => {
    return matrixThreadService.isBodyInThread(body)
  }

  const getThreadRootId = (event: MatrixEvent) => {
    return matrixThreadService.getThreadRootId(event)
  }

  const getThreadNotificationCount = (roomId: string, threadRootId: string) => {
    return matrixThreadService.getThreadNotificationCount(roomId, threadRootId)
  }

  const markThreadAsRead = (roomId: string, threadRootId: string) => {
    return matrixThreadService.markThreadAsRead(roomId, threadRootId)
  }

  const muteThread = (roomId: string, threadRootId: string, mute: boolean) => {
    return matrixThreadService.muteThread(roomId, threadRootId, mute)
  }

  const freezeThread = (roomId: string, threadRootId: string) => {
    return matrixThreadService.freezeThread(roomId, threadRootId)
  }

  const unfreezeThread = (roomId: string, threadRootId: string) => {
    return matrixThreadService.unfreezeThread(roomId, threadRootId)
  }

  const getUnreadThreads = (roomId?: string) => {
    return matrixThreadService.getUnreadThreads(roomId)
  }

  const isThreadMuted = (threadRootId: string) => {
    return matrixThreadService.isThreadMuted(threadRootId)
  }

  const isThreadFrozen = (threadRootId: string) => {
    return matrixThreadService.isThreadFrozen(threadRootId)
  }

  const getGlobalThreadListViaApi = (limit?: number, from?: string) => {
    return matrixThreadService.getGlobalThreadListViaApi(limit, from)
  }

  const createGlobalThreadViaApi = (roomId: string, rootEventId: string, content?: Record<string, unknown>) => {
    return matrixThreadService.createGlobalThreadViaApi(roomId, rootEventId, content)
  }

  const getSubscribedThreadsViaApi = () => {
    return matrixThreadService.getSubscribedThreadsViaApi()
  }

  const getGlobalUnreadThreadsViaApi = () => {
    return matrixThreadService.getGlobalUnreadThreadsViaApi()
  }

  const createRoomThreadViaApi = (roomId: string, rootEventId: string, content?: Record<string, unknown>) => {
    return matrixThreadService.createRoomThreadViaApi(roomId, rootEventId, content)
  }

  const getRoomThreadListViaApi = (roomId: string, limit?: number, from?: string, includeAll?: boolean) => {
    return matrixThreadService.getRoomThreadListViaApi(roomId, limit, from, includeAll)
  }

  const searchRoomThreadsViaApi = (roomId: string, query: string, limit?: number) => {
    return matrixThreadService.searchRoomThreadsViaApi(roomId, query, limit)
  }

  const getRoomUnreadThreadsViaApi = (roomId: string) => {
    return matrixThreadService.getRoomUnreadThreadsViaApi(roomId)
  }

  const getRoomThreadViaApi = (roomId: string, threadId: string, includeReplies?: boolean, replyLimit?: number) => {
    return matrixThreadService.getRoomThreadViaApi(roomId, threadId, includeReplies, replyLimit)
  }

  const deleteRoomThreadViaApi = (roomId: string, threadId: string) => {
    return matrixThreadService.deleteRoomThreadViaApi(roomId, threadId)
  }

  const freezeThreadViaApi = (roomId: string, threadId: string) => {
    return matrixThreadService.freezeThreadViaApi(roomId, threadId)
  }

  const unfreezeThreadViaApi = (roomId: string, threadId: string) => {
    return matrixThreadService.unfreezeThreadViaApi(roomId, threadId)
  }

  const addThreadReplyViaApi = (
    roomId: string,
    threadId: string,
    content: Record<string, unknown>,
    inReplyToEventId?: string
  ) => {
    return matrixThreadService.addThreadReplyViaApi(roomId, threadId, content, inReplyToEventId)
  }

  const getThreadRepliesViaApi = (roomId: string, threadId: string) => {
    return matrixThreadService.getThreadRepliesViaApi(roomId, threadId)
  }

  const subscribeToThreadViaApi = (roomId: string, threadId: string, notificationLevel?: string) => {
    return matrixThreadService.subscribeToThreadViaApi(roomId, threadId, notificationLevel)
  }

  const unsubscribeFromThreadViaApi = (roomId: string, threadId: string) => {
    return matrixThreadService.unsubscribeFromThreadViaApi(roomId, threadId)
  }

  const muteThreadViaApi = (roomId: string, threadId: string) => {
    return matrixThreadService.muteThreadViaApi(roomId, threadId)
  }

  const markThreadReadViaApi = (roomId: string, threadId: string, eventId: string, originServerTs: number) => {
    return matrixThreadService.markThreadReadViaApi(roomId, threadId, eventId, originServerTs)
  }

  const getThreadStatsViaApi = (roomId: string, threadId: string) => {
    return matrixThreadService.getThreadStatsViaApi(roomId, threadId)
  }

  const redactThreadReplyViaApi = (roomId: string, eventId: string) => {
    return matrixThreadService.redactThreadReplyViaApi(roomId, eventId)
  }

  const getLegacyRoomThreadList = (
    userId: string,
    roomId: string,
    limit?: number,
    from?: string,
    includeAll?: boolean
  ) => {
    return matrixThreadService.getLegacyRoomThreadList(userId, roomId, limit, from, includeAll)
  }

  return {
    createThread,
    sendThreadReply,
    getThread,
    getThreadReplies,
    getThreadMessages,
    getThreadViewData,
    getThreadsInRoom,
    isThreadRoot,
    isInThread,
    isBodyInThread,
    getThreadRootId,
    getThreadNotificationCount,
    markThreadAsRead,
    muteThread,
    freezeThread,
    unfreezeThread,
    getUnreadThreads,
    isThreadMuted,
    isThreadFrozen,
    getGlobalThreadListViaApi,
    createGlobalThreadViaApi,
    getSubscribedThreadsViaApi,
    getGlobalUnreadThreadsViaApi,
    createRoomThreadViaApi,
    getRoomThreadListViaApi,
    searchRoomThreadsViaApi,
    getRoomUnreadThreadsViaApi,
    getRoomThreadViaApi,
    deleteRoomThreadViaApi,
    freezeThreadViaApi,
    unfreezeThreadViaApi,
    addThreadReplyViaApi,
    getThreadRepliesViaApi,
    subscribeToThreadViaApi,
    unsubscribeFromThreadViaApi,
    muteThreadViaApi,
    markThreadReadViaApi,
    getThreadStatsViaApi,
    redactThreadReplyViaApi,
    getLegacyRoomThreadList
  }
}
