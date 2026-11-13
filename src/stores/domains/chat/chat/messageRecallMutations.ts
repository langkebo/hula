import { useMitt } from '@/composables/common/useMitt'
import { MittEnum, MsgEnum, RoomTypeEnum } from '@/enums'
import { createLogger } from '@/utils/Logger'
import type { MessageMutationsDeps } from './messageMutationsDeps'
import type { MessageType } from './types'

const logger = createLogger('ChatMessageMutations')

/**
 * 消息标记与撤回类操作。
 * 从 `messageMutations.ts` 拆出（原文件 564 行）。
 */
export const createMessageRecallMutations = (deps: MessageMutationsDeps) => {
  const {
    userStore,
    groupStore,
    sessionStore,
    recallMgr,
    messageMap,
    replyMapping,
    currentMessageMap,
    findRoomIdByMsgId
  } = deps

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
    updateMarkCount,
    recordRecallMsg,
    updateRecallMsg
  }
}
