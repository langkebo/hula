/**
 * useMsgInputDirectSend — direct-send sub-composable extracted from useMsgInputSend.
 *
 * Handles:
 *  - sendVoiceDirect: voice message sending with Matrix upload
 *  - sendStructuredDirect: generic structured message (beacon/link/location/emoji)
 *  - sendBeaconDirect, sendLinkPreviewDirect, sendLocationDirect, sendEmojiDirect
 */

import type { ComputedRef, Ref } from 'vue'
import { useMitt } from '@/composables/common/useMitt'
import { MessageStatusEnum, MittEnum, MsgEnum } from '@/enums'
import type { SendMessagePayload } from '@/services/matrix/messaging/MatrixMessageService'
import type { VoiceBody } from '@/services/types.ts'
import type { MessageType } from '@/stores/domains/chat/chat'
import { getStrategy } from '@/strategy/MessageStrategy.ts'
import { createLogger } from '@/utils/Logger'
import type { ChatStoreLike, GlobalStoreLike, GroupStoreLike, ReplyState, VoiceUploadResult } from './msgInputTypes'

const logger = createLogger('MsgInputDirectSend')

interface DirectSendContext {
  reply: Ref<ReplyState>
  userUid: Ref<string>
  globalStore: GlobalStoreLike
  groupStore: GroupStoreLike
  chatStore: ChatStoreLike
  sendWithTracking: (options: { tempMsgId: string; payload: SendMessagePayload }) => Promise<unknown>
  uploadVoiceToMatrix: (
    roomId: string,
    localPath: string,
    filename: string,
    mimeType: string
  ) => Promise<VoiceUploadResult>
  isBurnAfterRead: ComputedRef<boolean>
  burnDuration: ComputedRef<number>
}

export function useMsgInputDirectSend(ctx: DirectSendContext) {
  const {
    reply,
    userUid,
    globalStore,
    groupStore,
    chatStore,
    sendWithTracking,
    uploadVoiceToMatrix,
    isBurnAfterRead,
    burnDuration
  } = ctx

  const sendVoiceDirect = async (voiceData: {
    localPath: string
    size: number
    duration: number
    filename: string
    type?: string
  }) => {
    const targetRoomId = globalStore.currentSessionRoomId
    try {
      const msg = {
        type: MsgEnum.VOICE,
        url: `asset://${voiceData.localPath}`,
        size: voiceData.size,
        duration: voiceData.duration,
        filename: voiceData.filename,
        mimeType: voiceData.type || 'audio/mpeg'
      }
      const tempMsgId = 'T' + Date.now().toString()

      const messageBody: VoiceBody = {
        url: msg.url,
        size: msg.size,
        second: Math.round(msg.duration),
        fileName: msg.filename,
        mimeType: msg.mimeType
      }

      const userInfo = groupStore.getUserInfo(userUid.value)
      const tempMsg: MessageType = {
        clientKey: tempMsgId,
        fromUser: {
          uid: String(userUid.value || 0),
          username: userInfo?.name || '',
          avatar: userInfo?.avatar || ''
        },
        message: {
          id: tempMsgId,
          roomId: targetRoomId,
          sendTime: Date.now(),
          status: MessageStatusEnum.PENDING,
          type: MsgEnum.VOICE,
          body: messageBody,
          messageMarks: {}
        },
        sendTime: Date.now(),
        loading: false
      }

      chatStore.pushMsg(tempMsg)
      chatStore.updateMsg({ msgId: tempMsgId, status: MessageStatusEnum.SENDING })

      try {
        const uploadResult = await uploadVoiceToMatrix(targetRoomId, voiceData.localPath, msg.filename, msg.mimeType)
        if (uploadResult.encryptedFile) {
          messageBody.encryptedFile = uploadResult.encryptedFile
          messageBody.url = ''
          messageBody.mxcUrl = undefined
        } else {
          messageBody.url = uploadResult.httpUrl || uploadResult.mxcUrl || msg.url
          messageBody.mxcUrl = uploadResult.mxcUrl || undefined
        }

        if (uploadResult.eventId) {
          chatStore.updateMsg({
            msgId: tempMsgId,
            body: { ...messageBody },
            status: MessageStatusEnum.SUCCESS,
            newMsgId: uploadResult.eventId,
            timeBlock: Date.now()
          })
          useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
          chatStore.updateSessionLastActiveTime(targetRoomId)
        } else {
          chatStore.updateMsg({
            msgId: tempMsgId,
            body: { ...messageBody },
            status: MessageStatusEnum.SENDING
          })

          const burnPayload: SendMessagePayload = {
            id: tempMsgId,
            roomId: targetRoomId,
            msgType: MsgEnum.VOICE,
            body: messageBody
          }
          if (isBurnAfterRead.value) {
            burnPayload.burnAfterRead = true
            burnPayload.burnExpiresInMs = burnDuration.value * 1000
          }
          await sendWithTracking({ tempMsgId, payload: burnPayload })
        }
      } catch (uploadError) {
        chatStore.updateMsg({ msgId: tempMsgId, status: MessageStatusEnum.FAILED })
        throw uploadError
      }
    } catch (error) {
      logger.error('语音消息发送失败:', error)
    }
  }

  const sendStructuredDirect = async (msgType: MsgEnum, content: string, errorLabel: string, rethrow = false) => {
    const targetRoomId = globalStore.currentSessionRoomId
    try {
      const tempMsgId = 'T' + Date.now().toString()
      const messageStrategy = await getStrategy(msgType)
      const msg = (await Promise.resolve(
        messageStrategy.getMsg(content, reply.value as unknown as MessageType)
      )) as Record<string, unknown>
      const messageBody = messageStrategy.buildMessageBody(msg, reply.value as unknown as MessageType)

      const tempMsg = await Promise.resolve(
        messageStrategy.buildMessageType(tempMsgId, messageBody, globalStore, userUid)
      )
      tempMsg.message.status = MessageStatusEnum.SENDING

      chatStore.pushMsg(tempMsg)
      chatStore.updateMsg({ msgId: tempMsgId, status: MessageStatusEnum.SENDING })

      await sendWithTracking({
        tempMsgId,
        payload: { id: tempMsgId, roomId: targetRoomId, msgType, body: messageBody }
      })
    } catch (error) {
      logger.error(errorLabel, error)
      if (rethrow) throw error
    }
  }

  const sendBeaconDirect = async (beaconData: { description: string; timeout: number; isLive: boolean }) => {
    await sendStructuredDirect(MsgEnum.BEACON, JSON.stringify(beaconData), '实时位置共享消息发送失败:')
  }

  const sendLinkPreviewDirect = async (linkData: {
    url: string
    title: string
    description?: string
    imageUrl?: string
    siteName?: string
  }) => {
    await sendStructuredDirect(MsgEnum.LINK_PREVIEW, JSON.stringify(linkData), '链接预览消息发送失败:')
  }

  const sendLocationDirect = async (locationData: {
    latitude: number
    longitude: number
    accuracy?: number
    description?: string
    timestamp: number
  }) => {
    await sendStructuredDirect(MsgEnum.LOCATION, JSON.stringify(locationData), '位置消息发送失败:')
  }

  const sendEmojiDirect = async (emojiUrl: string) => {
    await sendStructuredDirect(MsgEnum.EMOJI, emojiUrl, '表情包消息发送失败:', true)
  }

  return {
    sendVoiceDirect,
    sendStructuredDirect,
    sendBeaconDirect,
    sendLinkPreviewDirect,
    sendLocationDirect,
    sendEmojiDirect
  }
}
