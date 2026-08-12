/**
 * useMsgInputSend — main message send composable.
 *
 * Orchestrates message sending by type (text/image/video/voice/file).
 * File upload and direct-send logic are delegated to:
 *  - useMsgInputFileUpload: processGenericFile, processGenericPathFile, sendFilesDirect
 *  - useMsgInputDirectSend: sendVoiceDirect, sendStructuredDirect, sendBeaconDirect, ...
 */

import { BaseDirectory, readFile } from '@tauri-apps/plugin-fs'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { LimitEnum, MessageStatusEnum, MittEnum, MsgEnum, UploadSceneEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import type { EncryptedAttachmentFile } from '@/services/matrix/crypto/MatrixAttachmentEncryptionService'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import type { SendMessagePayload } from '@/services/matrix/messaging/MatrixMessageService'
import type { VoiceBody } from '@/services/types.ts'
import type { MessageType } from '@/stores/domains/chat/chat'
import type { MessageStrategy } from '@/strategy/MessageStrategy'
import { getStrategy } from '@/strategy/MessageStrategy.ts'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'
import { UploadProviderEnum, useUpload } from '../common/useUpload'
import { extractAtUserIds } from './mentionParser'
import type { UseMsgInputSendOptions } from './msgInputTypes'
import { revokeBlobUrl } from './msgInputTypes'
import { useMsgInputDirectSend } from './useMsgInputDirectSend'
import { useMsgInputFileUpload } from './useMsgInputFileUpload'

const logger = createLogger('MsgInputSend')

export function useMsgInputSend(options: UseMsgInputSendOptions) {
  const {
    messageInputDom,
    msgInput,
    reply,
    userUid,
    globalStore,
    groupStore,
    chatStore,
    getMessageContentType,
    resetInput,
    sendWithTracking,
    uploadVoiceToMatrix,
    isBurnAfterRead,
    burnDuration
  } = options
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()

  const send = async () => {
    const targetRoomId = globalStore.currentSessionRoomId
    if (messageInputDom.value.querySelectorAll('img').length > LimitEnum.COM_COUNT) {
      showFeedback(t('hooks.msg_input.upload_limit', { count: LimitEnum.COM_COUNT }), 'warning')
      return
    }

    const contentType = getMessageContentType(messageInputDom) as MsgEnum
    const messageStrategy = await getStrategy(contentType)
    if (!messageStrategy) {
      showFeedback(t('hooks.msg_input.type_not_supported'), 'warning')
      return
    }

    const msg = await messageStrategy.getMsg(msgInput.value, reply.value as unknown as MessageType)
    const atUidList = extractAtUserIds(msgInput.value, groupStore.userList)
    const tempMsgId = 'T' + Date.now().toString()

    const messageBody = {
      ...messageStrategy.buildMessageBody(msg, reply.value as unknown as MessageType),
      atUidList
    }

    const tempMsg = await Promise.resolve(
      messageStrategy.buildMessageType(tempMsgId, messageBody, globalStore, userUid)
    )
    resetInput()

    tempMsg.message.status = MessageStatusEnum.SENDING
    chatStore.pushMsg(tempMsg)
    chatStore.updateMsg({ msgId: tempMsgId, status: MessageStatusEnum.SENDING })

    try {
      let voiceHandledByMatrixService = false

      if (msg.type === MsgEnum.IMAGE || msg.type === MsgEnum.EMOJI) {
        await handleImageMessage(msg, messageBody, targetRoomId, tempMsgId, messageStrategy)
      } else if (msg.type === MsgEnum.VIDEO) {
        await handleVideoMessage(msg, messageBody, targetRoomId, tempMsgId, messageStrategy)
      } else if (msg.type === MsgEnum.VOICE) {
        voiceHandledByMatrixService = await handleVoiceMessage(msg, messageBody, targetRoomId, tempMsgId)
      }

      if (!voiceHandledByMatrixService) {
        await sendWithTracking({
          tempMsgId,
          payload: buildBurnPayload(tempMsgId, targetRoomId, msg.type as MsgEnum, messageBody)
        })
      }

      cleanupBlobUrls(msg, messageBody)
    } catch (error) {
      logger.error('消息发送失败:', error)
      chatStore.updateMsg({ msgId: tempMsgId, status: MessageStatusEnum.FAILED })
      cleanupBlobUrls(msg, messageBody)
    }
  }

  async function handleImageMessage(
    msg: Record<string, unknown>,
    messageBody: Record<string, unknown>,
    targetRoomId: string,
    tempMsgId: string,
    messageStrategy: MessageStrategy
  ): Promise<void> {
    const isEncrypted = await cryptoSDKAdapter.isRoomEncrypted(targetRoomId)

    if (isEncrypted) {
      const fileData = await readFile(msg.path as string, {
        baseDir: isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      })
      const fileBlob = new File([fileData], (msg.fileName as string) || 'image.png', {
        type: (msg.mimeType as string) || 'image/png'
      })
      const result = await matrixMediaService.uploadEncryptedFile(fileBlob)
      messageBody.encryptedFile = result.encryptedFile
      delete messageBody.url
    } else {
      const { uploadUrl, downloadUrl, config } = await messageStrategy.uploadFile(msg.path as string, {
        provider: UploadProviderEnum.DEFAULT
      })
      const uploadedUrl = await messageStrategy.doUpload(
        msg.path as string,
        uploadUrl,
        config as Record<string, unknown>
      )
      messageBody.url = uploadedUrl || downloadUrl
    }

    delete messageBody.path
    chatStore.updateMsg({ msgId: tempMsgId, body: { ...messageBody }, status: MessageStatusEnum.SENDING })
  }

  async function handleVideoMessage(
    msg: Record<string, unknown>,
    messageBody: Record<string, unknown>,
    targetRoomId: string,
    tempMsgId: string,
    messageStrategy: MessageStrategy
  ): Promise<void> {
    const isEncrypted = await cryptoSDKAdapter.isRoomEncrypted(targetRoomId)

    if (isEncrypted) {
      let thumbnailEncryptedFile: EncryptedAttachmentFile | undefined
      if (msg.thumbnail) {
        const thumbnailResult = await matrixMediaService.uploadEncryptedFile(msg.thumbnail as File)
        thumbnailEncryptedFile = thumbnailResult.encryptedFile
      }

      const fileData = await readFile(msg.path as string, {
        baseDir: isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      })
      const fileBlob = new File([fileData], (msg.fileName as string) || 'video.mp4', {
        type: (msg.mimeType as string) || 'video/mp4'
      })
      const videoResult = await matrixMediaService.uploadEncryptedFile(fileBlob)

      messageBody.encryptedFile = videoResult.encryptedFile
      if (thumbnailEncryptedFile) {
        messageBody.thumbnailEncryptedFile = thumbnailEncryptedFile
      }
      delete messageBody.url
      delete messageBody.thumbUrl
    } else {
      let uploadResult: string
      if (messageStrategy.uploadThumbnail && messageStrategy.doUploadThumbnail) {
        const thumbnailUploadInfo = await messageStrategy.uploadThumbnail(msg.thumbnail as File, {
          provider: UploadProviderEnum.DEFAULT
        })
        const thumbnailUploadResult = await messageStrategy.doUploadThumbnail(
          msg.thumbnail as File,
          thumbnailUploadInfo.uploadUrl,
          thumbnailUploadInfo.config as Record<string, unknown>
        )
        uploadResult = thumbnailUploadResult || thumbnailUploadInfo.downloadUrl
      } else {
        uploadResult = await useUpload()
          .uploadFile(msg.thumbnail as File, { provider: UploadProviderEnum.DEFAULT, scene: UploadSceneEnum.CHAT })
          .then((result) => result?.downloadUrl || '')
      }

      const { uploadUrl, downloadUrl, config } = await messageStrategy.uploadFile(msg.path as string, {
        provider: UploadProviderEnum.DEFAULT
      })
      const uploadedUrl = await messageStrategy.doUpload(
        msg.path as string,
        uploadUrl,
        config as Record<string, unknown>
      )
      messageBody.url = uploadedUrl || downloadUrl
      messageBody.thumbUrl = uploadResult
    }

    delete messageBody.path
    messageBody.thumbSize = (msg.thumbnail as File).size
    messageBody.thumbWidth = 300
    messageBody.thumbHeight = 150
    chatStore.updateMsg({ msgId: tempMsgId, body: { ...messageBody }, status: MessageStatusEnum.SENDING })
  }

  async function handleVoiceMessage(
    msg: Record<string, unknown>,
    messageBody: Record<string, unknown>,
    targetRoomId: string,
    tempMsgId: string
  ): Promise<boolean> {
    const voiceBody = messageBody as unknown as VoiceBody
    const uploadResult = await uploadVoiceToMatrix(
      targetRoomId,
      msg.localPath as string,
      (voiceBody.fileName || msg.filename || 'voice.webm') as string,
      (voiceBody.mimeType || msg.mimeType || 'audio/mpeg') as string
    )

    if (uploadResult.encryptedFile) {
      voiceBody.encryptedFile = uploadResult.encryptedFile
      voiceBody.url = ''
      voiceBody.mxcUrl = undefined
    } else {
      voiceBody.url = uploadResult.httpUrl || uploadResult.mxcUrl || voiceBody.url
      voiceBody.mxcUrl = uploadResult.mxcUrl || undefined
    }
    voiceBody.fileName = voiceBody.fileName || uploadResult.filename

    chatStore.updateMsg({
      msgId: tempMsgId,
      body: { ...voiceBody },
      status: uploadResult.eventId ? MessageStatusEnum.SUCCESS : MessageStatusEnum.SENDING,
      newMsgId: uploadResult.eventId,
      timeBlock: Date.now()
    })

    if (uploadResult.eventId) {
      useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
      chatStore.updateSessionLastActiveTime(targetRoomId)
      return true
    }
    return false
  }

  function buildBurnPayload(
    tempMsgId: string,
    targetRoomId: string,
    msgType: MsgEnum,
    messageBody: Record<string, unknown>
  ): SendMessagePayload {
    const payload: SendMessagePayload = { id: tempMsgId, roomId: targetRoomId, msgType, body: messageBody }
    if (isBurnAfterRead.value) {
      payload.burnAfterRead = true
      payload.burnExpiresInMs = burnDuration.value * 1000
    }
    return payload
  }

  function cleanupBlobUrls(msg: Record<string, unknown>, messageBody: Record<string, unknown>): void {
    if (msg.type === MsgEnum.IMAGE || msg.type === MsgEnum.EMOJI) {
      revokeBlobUrl(msg.url)
    }
    if (msg.type === MsgEnum.VIDEO) {
      revokeBlobUrl(messageBody.thumbUrl)
    }
  }

  // ===== 子 composable 组合 =====

  const { sendFilesDirect } = useMsgInputFileUpload(
    messageInputDom,
    {
      reply,
      userUid,
      globalStore,
      chatStore,
      sendWithTracking,
      getMessageContentType
    },
    send
  )

  const { sendVoiceDirect, sendBeaconDirect, sendLinkPreviewDirect, sendLocationDirect, sendEmojiDirect } =
    useMsgInputDirectSend({
      reply,
      userUid,
      globalStore,
      groupStore,
      chatStore,
      sendWithTracking,
      uploadVoiceToMatrix,
      isBurnAfterRead,
      burnDuration
    })

  return {
    send,
    sendFilesDirect,
    sendVoiceDirect,
    sendBeaconDirect,
    sendLinkPreviewDirect,
    sendLocationDirect,
    sendEmojiDirect
  }
}
