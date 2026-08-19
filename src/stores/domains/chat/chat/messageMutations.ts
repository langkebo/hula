import { sendNotification } from '@tauri-apps/plugin-notification'
import type { ComputedRef, Ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useMitt } from '@/composables/common/useMitt'
import { type MessageStatusEnum, MittEnum, MsgEnum, RoomTypeEnum } from '@/enums'
import { matrixRoomQueryService } from '@/services/matrix/room/QueryService'
import { matrixRoomRealtimeService } from '@/services/matrix/room/RealtimeService'
import type { useGroupStore } from '@/stores/domains/chat/group'
import type { useUserStore } from '@/stores/domains/user/user'
import type { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import type { createRecallManager } from './recallManager'
import type { SessionItem, useSessionStore } from './session'
import { type MessageType, pageSize, ROOM_MESSAGE_CACHE_LIMIT } from './types'

const logger = createLogger('ChatMessageMutations')

interface MessageMutationsDeps {
  route: RouteLocationNormalizedLoaded
  userStore: ReturnType<typeof useUserStore>
  groupStore: ReturnType<typeof useGroupStore>
  globalStore: ReturnType<typeof useGlobalStore>
  sessionStore: ReturnType<typeof useSessionStore>
  recallMgr: ReturnType<typeof createRecallManager>

  messageMap: Record<string, Record<string, MessageType>>
  sortedMessageKeys: Record<string, string[]>
  replyMapping: Record<string, Record<string, string[]>>
  messageOptions: Record<string, { isLast: boolean; isLoading: boolean; cursor: string; hasLoadedOnce?: boolean }>
  newMsgCount: Record<string, { count: number; isStart: boolean }>

  currentMessageMap: ComputedRef<Record<string, MessageType>>
  currentMessageOptions: { value: { isLast: boolean; isLoading: boolean; cursor: string; hasLoadedOnce?: boolean } }
  currentReplyMap: { value: Record<string, string[]> }
  currentMsgReply: Ref<Partial<MessageType>>

  ensureSortedMessageState: (roomId: string) => void
  rebuildSortedMessageKeyIndex: (roomId: string) => void
  setSortedMessageKeys: (roomId: string, keys: string[]) => void
  findMessageInsertIndex: (roomId: string, messageKey: string) => number
  getCurrentSortedMessageKeys: (roomId: string) => string[]

  setMessageRoomIndex: (msgId: string, roomId: string) => void
  deleteMessageRoomIndex: (msgId: string) => void
  rebuildMessageRoomIndex: (roomId: string) => void
  findRoomIdByMsgId: (msgId: string) => string

  removeReplyReferences: (roomId: string, sourceMsgId: string) => void
  upsertReplyReference: (roomId: string, sourceMsgId: string, msg?: MessageType) => void
  syncReplyReference: (roomId: string, sourceMsgId: string, msg?: MessageType) => void
  rebuildReplyMapping: (roomId: string) => void
  migrateReplyTargetReferences: (roomId: string, oldMsgId: string, newMsgId: string) => void
}

export const createMessageMutations = (deps: MessageMutationsDeps) => {
  const {
    route,
    userStore,
    groupStore,
    globalStore,
    sessionStore,
    recallMgr,
    messageMap,
    sortedMessageKeys,
    replyMapping,
    messageOptions,
    newMsgCount,
    currentMessageMap,
    currentMessageOptions,
    currentReplyMap,
    currentMsgReply,
    ensureSortedMessageState,
    rebuildSortedMessageKeyIndex,
    setSortedMessageKeys,
    findMessageInsertIndex,
    getCurrentSortedMessageKeys,
    setMessageRoomIndex,
    deleteMessageRoomIndex,
    rebuildMessageRoomIndex,
    findRoomIdByMsgId,
    removeReplyReferences,
    upsertReplyReference,
    syncReplyReference,
    rebuildReplyMapping,
    migrateReplyTargetReferences
  } = deps

  const clearRedundantMessages = (roomId: string, limit: number = pageSize) => {
    const currentMessages = messageMap[roomId]
    if (!currentMessages) return

    const currentKeys = getCurrentSortedMessageKeys(roomId)

    if (currentKeys.length <= limit) return

    const keptKeys = currentKeys.slice(-limit)
    const keepMessageIds = new Set(keptKeys)
    const fallbackCursor = keptKeys[0] || ''

    for (const msgId in currentMessages) {
      if (!keepMessageIds.has(msgId)) {
        delete currentMessages[msgId]
        deleteMessageRoomIndex(msgId)
      }
    }
    setSortedMessageKeys(roomId, keptKeys)
    rebuildMessageRoomIndex(roomId)
    rebuildReplyMapping(roomId)

    if (!messageOptions[roomId]) {
      messageOptions[roomId] = { isLast: false, isLoading: false, cursor: '', hasLoadedOnce: false }
    }

    if (fallbackCursor) {
      messageOptions[roomId] = {
        ...messageOptions[roomId],
        cursor: fallbackCursor,
        isLast: false
      }
    }

    logger.info(
      'trim',
      `roomId=${roomId}`,
      `removed=${currentKeys.length - keptKeys.length}`,
      `kept=${keptKeys.length}`,
      `limit=${limit}`
    )
  }

  const pushMsg = async (msg: MessageType, options: { isActiveChatView?: boolean; activeRoomId?: string } = {}) => {
    // 防御性归一化：确保 fromUser 始终有有效结构
    if (!msg.fromUser || typeof msg.fromUser !== 'object') {
      msg.fromUser = { uid: '', username: '', avatar: '' }
    }
    msg.fromUser.uid = msg.fromUser.uid ?? ''

    if (!msg.message.id) {
      msg.message.id = `${msg.message.roomId}_${msg.message.sendTime}_${msg.fromUser.uid || 'unknown'}`
    }
    const messageKey = msg.message.id

    let roomMessages = messageMap[msg.message.roomId]
    if (!roomMessages) {
      roomMessages = {}
      messageMap[msg.message.roomId] = roomMessages
    }

    // 幂等性检查：如果消息已存在且不是自己发送的更新状态，直接忽略
    const existedMsg = roomMessages[messageKey]
    if (existedMsg) {
      // 允许发送过程中的状态更新（如：发送中 -> 成功）
      if (existedMsg.message.sendTime === msg.message.sendTime) {
        return
      }
    }

    roomMessages[messageKey] = msg
    setMessageRoomIndex(messageKey, msg.message.roomId)
    syncReplyReference(msg.message.roomId, messageKey, msg)

    // 二分查找插入，维持有序性
    ensureSortedMessageState(msg.message.roomId)

    if (!existedMsg) {
      const keys = sortedMessageKeys[msg.message.roomId]
      const low = findMessageInsertIndex(msg.message.roomId, messageKey)
      keys.splice(low, 0, messageKey)
      rebuildSortedMessageKeyIndex(msg.message.roomId)
    }

    const targetRoomId = options.activeRoomId ?? globalStore.currentSessionRoomId ?? ''
    let isActiveChatView = options.isActiveChatView
    if (isActiveChatView === undefined) {
      const currentPath = route?.path
      isActiveChatView =
        (currentPath === '/message' || currentPath?.startsWith('/mobile/chatRoom')) &&
        targetRoomId === msg.message.roomId
    }

    const uid = msg.fromUser?.uid ?? ''
    const cacheUser = groupStore.getUserInfo(uid)

    const session = sessionStore.getSession(msg.message.roomId)
    if (session) {
      const lastMsgUserName = cacheUser?.name
      const formattedText =
        msg.message.type === MsgEnum.RECALL
          ? session.type === RoomTypeEnum.GROUP
            ? `${lastMsgUserName}:撤回了一条消息`
            : msg.fromUser?.uid === userStore.userInfo?.uid
              ? '你撤回了一条消息'
              : '对方撤回了一条消息'
          : msg.message.body?.content || msg.message.body?.body || ''

      const updateData: Partial<SessionItem> = {
        text: formattedText,
        activeTime: Date.now()
      }

      const isSelfMessage = msg.fromUser?.uid === userStore.userInfo?.uid
      const shouldIncreaseUnread = !isSelfMessage && (!isActiveChatView || msg.message.roomId !== targetRoomId)

      if (shouldIncreaseUnread) {
        updateData.unreadCount = (session.unreadCount || 0) + 1
        logger.debug('增加未读数:', msg.message.roomId, updateData.unreadCount)
      }

      sessionStore.updateSession(msg.message.roomId, updateData)
    } else {
      try {
        const room = await matrixRoomQueryService.getRoom(msg.message.roomId, false)
        if (room) {
          // 复用 convertRoomToSession：其会为 SINGLE 房间填充 detailId/account（对方 MXID），
          // 保证下游按 counterpart 的会话去重（useSessionListState dmSeen）能正确合并同一联系人的
          // 多个历史 DM 房间，避免消息列表出现重复成员。unreadCount/activeTime 按新会话语义覆盖。
          const newSession = {
            ...matrixRoomRealtimeService.convertRoomToSession(room),
            unreadCount: 0,
            activeTime: Date.now()
          }
          sessionStore.addSession(newSession)
          const isSelfMessage = msg.fromUser?.uid === userStore.userInfo?.uid
          const shouldIncreaseUnread = !isSelfMessage && (!isActiveChatView || msg.message.roomId !== targetRoomId)
          if (shouldIncreaseUnread) {
            sessionStore.updateSession(msg.message.roomId, { unreadCount: 1 })
          }
        }
      } catch (err) {
        logger.error(
          'Failed to fetch room for new session, message received but session not created:',
          msg.message.roomId,
          err
        )
      }
    }

    if (msg.message.body.atUidList?.includes(userStore.userInfo?.uid ?? '') && cacheUser) {
      sendNotification({
        title: cacheUser.name as string,
        body: msg.message.body.content || msg.message.body.body || '',
        icon: cacheUser.avatar as string
      })
    }

    if (!isActiveChatView || msg.message.roomId !== targetRoomId) {
      clearRedundantMessages(msg.message.roomId, ROOM_MESSAGE_CACHE_LIMIT)
    }
  }

  const updateMsg = ({
    msgId,
    status,
    newMsgId,
    body,
    uploadProgress,
    timeBlock,
    roomId,
    isBurning,
    isBurned,
    burnRemainingSeconds
  }: {
    msgId: string
    status?: MessageStatusEnum
    newMsgId?: string
    body?: Record<string, unknown>
    uploadProgress?: number
    timeBlock?: number
    roomId?: string
    isBurning?: boolean
    isBurned?: boolean
    burnRemainingSeconds?: number
  }) => {
    const resolvedRoomId =
      (roomId && messageMap[roomId]?.[msgId] ? roomId : undefined) ??
      (messageMap[globalStore.currentSessionRoomId]?.[msgId] ? globalStore.currentSessionRoomId : undefined) ??
      findRoomIdByMsgId(msgId)

    if (!resolvedRoomId) return

    const roomMessages = messageMap[resolvedRoomId]
    if (!roomMessages) return

    const msg = roomMessages[msgId]
    if (!msg) return
    const previousMessageId = msg.message.id

    if (status !== undefined) {
      msg.message.status = status
    }
    // Fix 4: 支持 burn 状态字段更新，驱动 BurnMessage 组件的倒计时生命周期
    if (isBurning !== undefined) {
      msg.message.isBurning = isBurning
    }
    if (isBurned !== undefined) {
      msg.message.isBurned = isBurned
    }
    if (burnRemainingSeconds !== undefined) {
      msg.message.burnRemainingSeconds = burnRemainingSeconds
    }
    if (timeBlock !== undefined) {
      msg.timeBlock = timeBlock
    }
    if (body) {
      msg.message.body = body
    }

    const nextMsgId = newMsgId ?? msg.message.id
    if (newMsgId) {
      msg.message.id = newMsgId
    }

    if (uploadProgress !== undefined) {
      logger.debug(`更新消息进度: ${uploadProgress}% (消息ID: ${msgId})`)
      roomMessages[nextMsgId] = { ...msg, uploadProgress }
      setMessageRoomIndex(nextMsgId, resolvedRoomId)
      messageMap[resolvedRoomId] = { ...roomMessages }
    } else {
      roomMessages[nextMsgId] = msg
      setMessageRoomIndex(nextMsgId, resolvedRoomId)
    }

    removeReplyReferences(resolvedRoomId, previousMessageId)
    if (newMsgId && previousMessageId !== newMsgId) {
      migrateReplyTargetReferences(resolvedRoomId, previousMessageId, newMsgId)
      removeReplyReferences(resolvedRoomId, newMsgId)
    }
    upsertReplyReference(resolvedRoomId, nextMsgId, roomMessages[nextMsgId])

    if (newMsgId && msgId !== newMsgId) {
      delete roomMessages[msgId]
      deleteMessageRoomIndex(msgId)
      if (sortedMessageKeys[resolvedRoomId]) {
        setSortedMessageKeys(
          resolvedRoomId,
          sortedMessageKeys[resolvedRoomId].filter((id) => id !== msgId)
        )

        if (!sortedMessageKeys[resolvedRoomId].includes(newMsgId)) {
          const keys = sortedMessageKeys[resolvedRoomId]
          const low = findMessageInsertIndex(resolvedRoomId, newMsgId)
          keys.splice(low, 0, newMsgId)
          rebuildSortedMessageKeyIndex(resolvedRoomId)
        }
      }
      messageMap[resolvedRoomId] = { ...roomMessages }
    }
  }

  const deleteMsg = (msgId: string) => {
    if (currentMessageMap.value && msgId in currentMessageMap.value) {
      const roomId = globalStore.currentSessionRoomId
      delete currentMessageMap.value[msgId]
      deleteMessageRoomIndex(msgId)
      removeReplyReferences(roomId, msgId)
      if (sortedMessageKeys[roomId]) {
        setSortedMessageKeys(
          roomId,
          sortedMessageKeys[roomId].filter((id) => id !== msgId)
        )
      }
    }
  }

  const clearRoomMessages = (roomId: string) => {
    if (!roomId) return

    if (messageMap[roomId]) {
      messageMap[roomId] = {}
    }
    rebuildMessageRoomIndex(roomId)
    replyMapping[roomId] = {}

    setSortedMessageKeys(roomId, [])

    const defaultOptions = {
      isLast: true,
      isLoading: false,
      cursor: '',
      hasLoadedOnce: false
    }

    if (globalStore.currentSessionRoomId === roomId) {
      currentMessageOptions.value = defaultOptions
      currentReplyMap.value = {}
      currentMsgReply.value = {}
    } else {
      messageOptions[roomId] = defaultOptions
    }

    newMsgCount[roomId] = { count: 0, isStart: false }
  }

  const updateMarkCount = async (
    markList: Array<{ msgId: string; markType: number; markCount: number; actType: number; uid: string }>
  ) => {
    await logger.info('保存消息标记到本地数据库')
    for (const mark of markList) {
      const { msgId, markType, markCount, actType, uid } = mark

      const msgItem = currentMessageMap.value?.[String(msgId)]
      if (msgItem?.message.messageMarks) {
        const currentMarkStat = msgItem.message.messageMarks[String(markType)] || {
          count: 0,
          userMarked: false
        }

        if (actType === 1) {
          if (uid === userStore.userInfo?.uid) {
            currentMarkStat.userMarked = true
          }
          currentMarkStat.count = markCount
        } else if (actType === 2) {
          if (uid === userStore.userInfo?.uid) {
            currentMarkStat.userMarked = false
          }
          currentMarkStat.count = markCount
        }

        msgItem.message.messageMarks[String(markType)] = currentMarkStat
      }
    }
  }

  const recordRecallMsg = (data: {
    recallUid: string
    msg: MessageType
    originalType?: number
    originalContent?: string
  }) => {
    recallMgr.recordRecallMsg({
      messageId: data.msg.message.id,
      content: data.originalContent ?? data.msg.message.body.content ?? data.msg.message.body.body ?? '',
      originalType: data.originalType ?? data.msg.message.type,
      isSelf: data.recallUid === userStore.userInfo?.uid
    })
  }

  const updateRecallMsg = async (data: { msgId: string; recallUid?: string; roomId?: string }) => {
    const { msgId } = data
    const resolvedRoomId = data.roomId || findRoomIdByMsgId(msgId)
    const session = resolvedRoomId ? sessionStore.getSession(resolvedRoomId) : undefined
    const sessionType = session?.type ?? RoomTypeEnum.SINGLE
    const roomMessages = resolvedRoomId ? messageMap[resolvedRoomId] : undefined
    const message = roomMessages?.[msgId] || currentMessageMap.value?.[msgId]
    let recallMessageBody = ''

    if (message && typeof data.recallUid === 'string') {
      const currentUid = userStore.userInfo?.uid ?? ''
      const senderUid = message.fromUser?.uid ?? ''

      const isRecallerCurrentUser = data.recallUid === currentUid
      const isSenderCurrentUser = senderUid === currentUid
      const recallerUser = groupStore.getUserInfo(data.recallUid, resolvedRoomId)
      const recallerName = recallerUser?.myName || recallerUser?.name || data.recallUid || ''
      const senderUser = groupStore.getUserInfo(senderUid, resolvedRoomId)
      const senderName = senderUser?.myName || senderUser?.name || message.fromUser?.username || senderUid
      const isGroupChat = sessionType === RoomTypeEnum.GROUP

      if (isRecallerCurrentUser) {
        if (data.recallUid === senderUid) {
          recallMessageBody = '你撤回了一条消息'
        } else {
          recallMessageBody = `你撤回了${senderName}的一条消息`
        }
      } else {
        if (isGroupChat) {
          const recallerLabel = recallerName || '对方'
          if (isSenderCurrentUser) {
            recallMessageBody = `${recallerLabel}撤回了你的一条消息`
          } else {
            recallMessageBody = `${recallerLabel}撤回了一条消息`
          }
        } else {
          if (isSenderCurrentUser) {
            recallMessageBody = '对方撤回了你的一条消息'
          } else {
            recallMessageBody = '对方撤回了一条消息'
          }
        }
      }

      message.message.type = MsgEnum.RECALL
      message.message.body.content = recallMessageBody
      message.message.body.body = recallMessageBody
    }

    if (resolvedRoomId) {
      const sess = sessionStore.getSession(resolvedRoomId)
      if (sess && recallMessageBody) {
        sessionStore.updateSession(resolvedRoomId, { text: recallMessageBody })
      }
      useMitt.emit(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: resolvedRoomId })
    }

    const roomReplyMap = resolvedRoomId ? replyMapping[resolvedRoomId] : undefined
    const messageList = roomReplyMap?.[msgId]
    if (messageList) {
      for (const id of messageList) {
        const msg = roomMessages?.[id] || currentMessageMap.value?.[id]
        if (msg && typeof msg.message.body === 'object' && msg.message.body.reply) {
          msg.message.body.reply.body = '原消息已被撤回'
        }
      }
    }
  }

  return {
    pushMsg,
    updateMsg,
    deleteMsg,
    clearRoomMessages,
    clearRedundantMessages,
    updateMarkCount,
    recordRecallMsg,
    updateRecallMsg
  }
}
