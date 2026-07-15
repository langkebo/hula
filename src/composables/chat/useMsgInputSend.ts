import { BaseDirectory, readFile } from '@tauri-apps/plugin-fs'
import pLimit from 'p-limit'
import type { ComputedRef, Ref } from 'vue'
import { nextTick } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { LimitEnum, MessageStatusEnum, MittEnum, MsgEnum, UploadSceneEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import type { EncryptedAttachmentFile } from '@/services/matrix/crypto/MatrixAttachmentEncryptionService'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import type { SendMessagePayload } from '@/services/matrix/messaging/MatrixMessageService'
import type { UserItem, VoiceBody } from '@/services/types.ts'
import type { MessageType } from '@/stores/domains/chat/chat'
import type { MessageStrategy } from '@/strategy/MessageStrategy'
import { getStrategy } from '@/strategy/MessageStrategy.ts'
import { isPathUploadFile, type PathUploadFile, type UploadFile } from '@/utils/FileType'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'
import { globalFileUploadQueue } from '../common/useFileUploadQueue'
import { UploadProviderEnum, useUpload } from '../common/useUpload'
import { extractAtUserIds } from './mentionParser'

const logger = createLogger('MsgInputSend')

interface ReplyState {
  avatar: string
  accountName: string
  content: string
  key: string | number
  imgCount: number
}

interface UserSummary {
  name?: string
  avatar?: string
}

interface GlobalStoreLike {
  currentSessionRoomId: string
}

interface GroupStoreLike {
  userList: UserItem[]
  getUserInfo: (uid: string, roomId?: string) => UserSummary | null
}

interface ChatUpdateMsgPayload {
  msgId: string
  status: MessageStatusEnum
  newMsgId?: string
  body?: Record<string, unknown>
  uploadProgress?: number
  timeBlock?: number
  roomId?: string
}

interface ChatStoreLike {
  pushMsg: (msg: MessageType, options?: { isActiveChatView?: boolean; activeRoomId?: string }) => Promise<void>
  updateMsg: (payload: ChatUpdateMsgPayload) => unknown
  updateSessionLastActiveTime: (roomId: string) => unknown
}

interface VoiceUploadResult {
  httpUrl?: string
  mxcUrl?: string
  filename?: string
  eventId?: string
  encryptedFile?: EncryptedAttachmentFile
}

export interface UseMsgInputSendOptions {
  messageInputDom: Ref<HTMLElement>
  msgInput: Ref<string>
  reply: Ref<ReplyState>
  userUid: Ref<string>
  globalStore: GlobalStoreLike
  groupStore: GroupStoreLike
  chatStore: ChatStoreLike
  getMessageContentType: (messageInputDom: Ref<HTMLElement>) => MsgEnum
  resetInput: () => void
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

const createRafProgressUpdater = (chatStore: ChatStoreLike, msgId: string, throttleMs = 200) => {
  let lastTime = 0
  let rafId: number | null = null
  let latestPct = 0

  return (pct: number) => {
    latestPct = pct
    const now = Date.now()

    if (now - lastTime >= throttleMs) {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      chatStore.updateMsg({
        msgId,
        status: MessageStatusEnum.SENDING,
        uploadProgress: latestPct
      })
      lastTime = now
    } else if (!rafId) {
      rafId = requestAnimationFrame(() => {
        chatStore.updateMsg({
          msgId,
          status: MessageStatusEnum.SENDING,
          uploadProgress: latestPct
        })
        lastTime = Date.now()
        rafId = null
      })
    }
  }
}

const retainRawContent = (type: MsgEnum) => [MsgEnum.EMOJI, MsgEnum.IMAGE].includes(type)

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

  const processGenericFile = async (
    file: File,
    tempMsgId: string,
    messageStrategy: MessageStrategy,
    targetRoomId: string
  ): Promise<void> => {
    const msg = await messageStrategy.getMsg('', reply.value as unknown as MessageType, [file])
    const messageBody = messageStrategy.buildMessageBody(msg, reply.value as unknown as MessageType)

    const tempMsg = await Promise.resolve(
      messageStrategy.buildMessageType(tempMsgId, { ...messageBody, url: '' }, globalStore, userUid)
    )
    tempMsg.message.roomId = targetRoomId
    tempMsg.message.status = MessageStatusEnum.SENDING
    chatStore.pushMsg(tempMsg)

    let isProgressActive = true
    const cleanup = () => {
      isProgressActive = false
    }

    try {
      const updateProgress = createRafProgressUpdater(chatStore, tempMsgId)
      const _progressCallback = (pct: number) => {
        if (!isProgressActive) return
        updateProgress(pct)
      }
      void _progressCallback

      // 检查房间是否加密
      const isEncrypted = await cryptoSDKAdapter.isRoomEncrypted(targetRoomId)

      if (isEncrypted) {
        // 使用加密上传
        const result = await matrixMediaService.uploadEncryptedFile(file, _progressCallback)
        cleanup()

        // 更新消息内容为加密文件格式
        messageBody.encryptedFile = result.encryptedFile
        delete (messageBody as Record<string, unknown>).url
      } else {
        // 普通上传
        const { uploadUrl, downloadUrl, config } = await messageStrategy.uploadFile(msg.path as string, {
          provider: UploadProviderEnum.DEFAULT
        })
        const uploadedUrl = await messageStrategy.doUpload(
          msg.path as string,
          uploadUrl,
          config as Record<string, unknown>
        )

        cleanup()

        messageBody.url = uploadedUrl || downloadUrl
      }

      delete (messageBody as Record<string, unknown>).path

      chatStore.updateMsg({
        msgId: tempMsgId,
        body: messageBody,
        status: MessageStatusEnum.SENDING
      })

      await sendWithTracking({
        tempMsgId,
        payload: {
          id: tempMsgId,
          roomId: targetRoomId,
          msgType: MsgEnum.FILE,
          body: messageBody
        }
      })
    } catch (error) {
      cleanup()
      throw error
    }
  }

  const processGenericPathFile = async (
    file: PathUploadFile,
    tempMsgId: string,
    messageStrategy: MessageStrategy,
    targetRoomId: string
  ): Promise<void> => {
    const MAX_UPLOAD_SIZE = 500 * 1024 * 1024
    if (file.size > MAX_UPLOAD_SIZE) {
      throw new Error(t('hooks.msg_input.file_size_exceeded'))
    }

    const msg = {
      type: MsgEnum.FILE,
      path: file.path,
      fileName: file.name,
      size: file.size,
      mimeType: file.type,
      reply: reply.value.content
        ? {
            content: reply.value.content,
            key: reply.value.key
          }
        : undefined
    }

    const messageBody = messageStrategy.buildMessageBody(msg, reply.value as unknown as MessageType)

    const tempMsg = await Promise.resolve(
      messageStrategy.buildMessageType(tempMsgId, { ...messageBody, url: '' }, globalStore, userUid)
    )
    tempMsg.message.roomId = targetRoomId
    tempMsg.message.status = MessageStatusEnum.SENDING
    chatStore.pushMsg(tempMsg)

    let isProgressActive = true
    const cleanup = () => {
      isProgressActive = false
    }

    try {
      const updateProgress = createRafProgressUpdater(chatStore, tempMsgId)
      const _progressCallback = (pct: number) => {
        if (!isProgressActive) return
        updateProgress(pct)
      }
      void _progressCallback

      // 检查房间是否加密
      const isEncrypted = await cryptoSDKAdapter.isRoomEncrypted(targetRoomId)

      if (isEncrypted) {
        // 加密房间：读取文件内容并加密上传
        const fileData = await readFile(file.path)
        const fileBlob = new File([fileData], file.name, { type: file.type })
        const result = await matrixMediaService.uploadEncryptedFile(fileBlob, _progressCallback)
        cleanup()

        // 更新消息内容为加密文件格式
        messageBody.encryptedFile = result.encryptedFile
        delete (messageBody as Record<string, unknown>).url
      } else {
        // 普通上传
        const { uploadUrl, downloadUrl, config } = await messageStrategy.uploadFile(msg.path, {
          provider: UploadProviderEnum.DEFAULT
        })
        const uploadedUrl = await messageStrategy.doUpload(msg.path, uploadUrl, config as Record<string, unknown>)

        cleanup()

        messageBody.url = uploadedUrl || downloadUrl
      }

      delete (messageBody as Record<string, unknown>).path

      chatStore.updateMsg({
        msgId: tempMsgId,
        body: messageBody,
        status: MessageStatusEnum.SENDING
      })

      await sendWithTracking({
        tempMsgId,
        payload: {
          id: tempMsgId,
          roomId: targetRoomId,
          msgType: MsgEnum.FILE,
          body: messageBody
        }
      })
    } catch (error) {
      cleanup()
      throw error
    }
  }

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

    const replyDiv = messageInputDom.value.querySelector('#replyDiv')
    if (replyDiv) {
      replyDiv.remove()
      if (!retainRawContent(contentType)) {
        msgInput.value = messageInputDom.value.innerHTML.replace(replyDiv.outerHTML, '')
      }
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
    chatStore.updateMsg({
      msgId: tempMsgId,
      status: MessageStatusEnum.SENDING
    })

    try {
      let voiceHandledByMatrixService = false

      if (msg.type === MsgEnum.IMAGE || msg.type === MsgEnum.EMOJI) {
        const isEncrypted = await cryptoSDKAdapter.isRoomEncrypted(targetRoomId)

        if (isEncrypted) {
          const fileData = await readFile(msg.path as string, {
            baseDir: isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
          })
          const fileBlob = new File([fileData], (msg.fileName as string) || 'image.png', {
            type: (msg.mimeType as string) || 'image/png'
          })
          const result = await matrixMediaService.uploadEncryptedFile(fileBlob)

          ;(messageBody as Record<string, unknown>).encryptedFile = result.encryptedFile
          delete (messageBody as Record<string, unknown>).url
        } else {
          const { uploadUrl, downloadUrl, config } = await messageStrategy.uploadFile(msg.path as string, {
            provider: UploadProviderEnum.DEFAULT
          })
          const uploadedUrl = await messageStrategy.doUpload(
            msg.path as string,
            uploadUrl,
            config as Record<string, unknown>
          )
          ;(messageBody as Record<string, unknown>).url = uploadedUrl || downloadUrl
        }

        delete (messageBody as Record<string, unknown>).path

        chatStore.updateMsg({
          msgId: tempMsgId,
          body: {
            ...messageBody
          },
          status: MessageStatusEnum.SENDING
        })
      } else if (msg.type === MsgEnum.VIDEO) {
        const isEncrypted = await cryptoSDKAdapter.isRoomEncrypted(targetRoomId)

        if (isEncrypted) {
          // 加密房间：加密视频与缩略图
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

          ;(messageBody as Record<string, unknown>).encryptedFile = videoResult.encryptedFile
          if (thumbnailEncryptedFile) {
            ;(messageBody as Record<string, unknown>).thumbnailEncryptedFile = thumbnailEncryptedFile
          }
          delete (messageBody as Record<string, unknown>).url
          delete (messageBody as Record<string, unknown>).thumbUrl
        } else {
          // 普通上传
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
              .uploadFile(msg.thumbnail as File, {
                provider: UploadProviderEnum.DEFAULT,
                scene: UploadSceneEnum.CHAT
              })
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
          ;(messageBody as Record<string, unknown>).url = uploadedUrl || downloadUrl
          ;(messageBody as Record<string, unknown>).thumbUrl = uploadResult
        }

        delete (messageBody as Record<string, unknown>).path
        ;(messageBody as Record<string, unknown>).thumbSize = (msg.thumbnail as File).size
        ;(messageBody as Record<string, unknown>).thumbWidth = 300
        ;(messageBody as Record<string, unknown>).thumbHeight = 150

        chatStore.updateMsg({
          msgId: tempMsgId,
          body: {
            ...messageBody
          },
          status: MessageStatusEnum.SENDING
        })
      } else if (msg.type === MsgEnum.VOICE) {
        const voiceBody = messageBody as unknown as VoiceBody
        const uploadResult = await uploadVoiceToMatrix(
          targetRoomId,
          msg.localPath as string,
          (voiceBody.fileName || msg.filename || 'voice.webm') as string,
          (voiceBody.mimeType || msg.mimeType || 'audio/mpeg') as string
        )

        if (uploadResult.encryptedFile) {
          voiceBody.encryptedFile = uploadResult.encryptedFile
          voiceBody.url = '' // 设置为空字符串而不是 delete，以满足类型检查
          voiceBody.mxcUrl = undefined
        } else {
          voiceBody.url = uploadResult.httpUrl || uploadResult.mxcUrl || voiceBody.url
          voiceBody.mxcUrl = uploadResult.mxcUrl || undefined
        }
        voiceBody.fileName = voiceBody.fileName || uploadResult.filename

        chatStore.updateMsg({
          msgId: tempMsgId,
          body: {
            ...voiceBody
          },
          status: uploadResult.eventId ? MessageStatusEnum.SUCCESS : MessageStatusEnum.SENDING,
          newMsgId: uploadResult.eventId,
          timeBlock: Date.now()
        })

        if (uploadResult.eventId) {
          useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
          chatStore.updateSessionLastActiveTime(targetRoomId)
          voiceHandledByMatrixService = true
        }
      }

      if (!voiceHandledByMatrixService) {
        const burnPayload: SendMessagePayload = {
          id: tempMsgId,
          roomId: targetRoomId,
          msgType: msg.type as MsgEnum,
          body: messageBody
        }
        if (isBurnAfterRead.value) {
          burnPayload.burnAfterRead = true
          burnPayload.burnExpiresInMs = burnDuration.value * 1000
        }
        await sendWithTracking({
          tempMsgId,
          payload: burnPayload
        })
      }

      if (
        (msg.type === MsgEnum.IMAGE || msg.type === MsgEnum.EMOJI) &&
        typeof (msg as Record<string, unknown>).url === 'string' &&
        ((msg as Record<string, unknown>).url as string).startsWith('blob:')
      ) {
        URL.revokeObjectURL((msg as Record<string, unknown>).url as string)
      }

      if (
        msg.type === MsgEnum.VIDEO &&
        (messageBody as Record<string, unknown>).thumbUrl &&
        typeof (messageBody as Record<string, unknown>).thumbUrl === 'string' &&
        ((messageBody as Record<string, unknown>).thumbUrl as string).startsWith('blob:')
      ) {
        URL.revokeObjectURL((messageBody as Record<string, unknown>).thumbUrl as string)
      }
    } catch (error) {
      logger.error('消息发送失败:', error)
      chatStore.updateMsg({
        msgId: tempMsgId,
        status: MessageStatusEnum.FAILED
      })

      if (
        (msg.type === MsgEnum.IMAGE || msg.type === MsgEnum.EMOJI) &&
        typeof (msg as Record<string, unknown>).url === 'string' &&
        ((msg as Record<string, unknown>).url as string).startsWith('blob:')
      ) {
        URL.revokeObjectURL((msg as Record<string, unknown>).url as string)
      }

      if (
        msg.type === MsgEnum.VIDEO &&
        (messageBody as Record<string, unknown>).thumbUrl &&
        typeof (messageBody as Record<string, unknown>).thumbUrl === 'string' &&
        ((messageBody as Record<string, unknown>).thumbUrl as string).startsWith('blob:')
      ) {
        URL.revokeObjectURL((messageBody as Record<string, unknown>).thumbUrl as string)
      }
    }
  }

  const sendFilesDirect = async (files: UploadFile[]) => {
    const targetRoomId = globalStore.currentSessionRoomId

    globalFileUploadQueue.initQueue(files)

    const baseTempId = Date.now()
    const jobs = files.map((file, index) => {
      const fileId = globalFileUploadQueue.queue.items[index]?.id
      const tempMsgId = String(baseTempId * 1000 + index)
      return { file, fileId, tempMsgId }
    })

    const fileStrategy = await getStrategy(MsgEnum.FILE)
    const replyPayload = reply.value.content
      ? {
          body: reply.value.content,
          id: reply.value.key,
          username: reply.value.accountName,
          type: MsgEnum.FILE
        }
      : undefined

    for (const job of jobs) {
      const tempMsg = await Promise.resolve(
        fileStrategy.buildMessageType(
          job.tempMsgId,
          {
            url: '',
            fileName: job.file.name,
            size: job.file.size,
            mimeType: job.file.type,
            replyMsgId: reply.value.content ? reply.value.key : undefined,
            reply: replyPayload
          },
          globalStore,
          userUid
        )
      )
      tempMsg.message.roomId = targetRoomId
      tempMsg.message.status = MessageStatusEnum.SENDING
      tempMsg.uploadProgress = 0
      void chatStore.pushMsg(tempMsg)
    }
    useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)

    await nextTick()
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })

    const limit = pLimit(3)
    const tasks = jobs.map((job) =>
      limit(async () => {
        const tempMsgId = job.tempMsgId

        try {
          if (job.fileId) {
            globalFileUploadQueue.updateFileStatus(job.fileId, 'uploading', 0)
          }

          const messageStrategy = await getStrategy(MsgEnum.FILE)
          if (isPathUploadFile(job.file)) {
            await processGenericPathFile(job.file, tempMsgId, messageStrategy, targetRoomId)
          } else {
            await processGenericFile(job.file, tempMsgId, messageStrategy, targetRoomId)
          }

          if (job.fileId) {
            globalFileUploadQueue.updateFileStatus(job.fileId, 'completed', 100)
          }
        } catch (error) {
          logger.error(`${job.file.name} 发送失败:`, error)

          if (job.fileId) {
            globalFileUploadQueue.updateFileStatus(job.fileId, 'failed', 0)
          }

          chatStore.updateMsg({
            msgId: tempMsgId,
            status: MessageStatusEnum.FAILED
          })

          showFeedback(t('hooks.msg_input.file_send_failed', { fileName: job.file.name }), 'error')
        }
      })
    )

    await Promise.allSettled(tasks)

    try {
      await nextTick()
      if (
        messageInputDom.value?.querySelectorAll('img').length > 0 &&
        globalStore.currentSessionRoomId === targetRoomId
      ) {
        const contentType = getMessageContentType(messageInputDom)
        if (contentType === MsgEnum.IMAGE || contentType === MsgEnum.EMOJI) {
          await send()
        }
      }
    } catch (error) {
      logger.error('自动发送输入框图片失败:', error)
    }
  }

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
      chatStore.updateMsg({
        msgId: tempMsgId,
        status: MessageStatusEnum.SENDING
      })

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
            body: {
              ...messageBody
            },
            status: MessageStatusEnum.SUCCESS,
            newMsgId: uploadResult.eventId,
            timeBlock: Date.now()
          })
          useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
          chatStore.updateSessionLastActiveTime(targetRoomId)
        } else {
          chatStore.updateMsg({
            msgId: tempMsgId,
            body: {
              ...messageBody
            },
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
          await sendWithTracking({
            tempMsgId,
            payload: burnPayload
          })
        }
      } catch (uploadError) {
        chatStore.updateMsg({
          msgId: tempMsgId,
          status: MessageStatusEnum.FAILED
        })
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
      chatStore.updateMsg({
        msgId: tempMsgId,
        status: MessageStatusEnum.SENDING
      })

      await sendWithTracking({
        tempMsgId,
        payload: {
          id: tempMsgId,
          roomId: targetRoomId,
          msgType,
          body: messageBody
        }
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
    send,
    sendFilesDirect,
    sendVoiceDirect,
    sendBeaconDirect,
    sendLinkPreviewDirect,
    sendLocationDirect,
    sendEmojiDirect
  }
}
