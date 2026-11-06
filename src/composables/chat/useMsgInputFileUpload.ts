/**
 * useMsgInputFileUpload — file upload sub-composable extracted from useMsgInputSend.
 *
 * Handles:
 *  - processGenericFile: uploading a File object (with encryption awareness)
 *  - processGenericPathFile: uploading a file referenced by local path
 *  - sendFilesDirect: batch file sending with concurrency control
 */

import { readFile } from '@tauri-apps/plugin-fs'
import pLimit from 'p-limit'
import type { Ref } from 'vue'
import { nextTick } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { MessageStatusEnum, MittEnum, MsgEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import type { SendMessagePayload } from '@/services/matrix/messaging/MatrixMessageService'
import type { MessageStrategy } from '@/strategy/MessageStrategy'
import { getStrategy } from '@/strategy/MessageStrategy.ts'
import { isPathUploadFile, type PathUploadFile, type UploadFile } from '@/utils/FileType'
import { createLogger } from '@/utils/Logger'
import { globalFileUploadQueue } from '../common/useFileUploadQueue'
import { UploadProviderEnum } from '../common/useUpload'
import { isImageUpload, withImageInfo } from './imageUploadBody'
import {
  type ChatStoreLike,
  createRafProgressUpdater,
  type GlobalStoreLike,
  type ReplyState,
  type StrategyReplyArg
} from './msgInputTypes'

const logger = createLogger('MsgInputFileUpload')

interface FileUploadContext {
  reply: Ref<ReplyState>
  userUid: Ref<string>
  globalStore: GlobalStoreLike
  chatStore: ChatStoreLike
  sendWithTracking: (options: { tempMsgId: string; payload: SendMessagePayload }) => Promise<unknown>
  getMessageContentType: (messageInputDom: Ref<HTMLElement>) => MsgEnum
}

async function processGenericFile(
  file: File,
  tempMsgId: string,
  messageStrategy: MessageStrategy,
  targetRoomId: string,
  ctx: FileUploadContext
): Promise<void> {
  const { reply, globalStore, userUid, chatStore, sendWithTracking } = ctx
  // 上传链统一走 FILE 策略（500MB 上限、blob/path 双通道）；图片只改发送时的 msgtype 与 info 字段。
  const msgType = isImageUpload(file) ? MsgEnum.IMAGE : MsgEnum.FILE
  const msg = await messageStrategy.getMsg('', reply.value as StrategyReplyArg, [file])
  const messageBody = messageStrategy.buildMessageBody(msg, reply.value as StrategyReplyArg)

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
    const progressCallback = (pct: number) => {
      if (!isProgressActive) return
      updateProgress(pct)
    }

    const isEncrypted = await cryptoSDKAdapter.requireRoomEncryptionState(targetRoomId)

    // 两条上传链：
    //  - path 版（strategy.uploadFile/doUpload）：只在「path 指向真实本地文件」时可用（Tauri）；
    //  - blob 版（matrixMediaService.uploadFile）：浏览器 / Web / van-uploader 选出的 File。
    //
    // 历史缺陷：无路径时也走 path 版，把 `undefined` 透给 Tauri fs，抛的是
    // `TypeError: Cannot read properties of undefined (reading 'isFile')`，
    // 用户只看到「文件上传失败，请重试」，附件选完永远发不出去。
    // 现在不仅按「有没有 path」分流，**path 版失败也会回退 blob** —— 因为沙箱/WebView
    // 里 `hasTauriRuntime()` 可能为真，但 fs 实际不可用（e2e 的 Tauri shim 就是如此）。
    const localPath = typeof msg.path === 'string' ? msg.path : ''

    const uploadFromBlob = async (): Promise<void> => {
      const result = await matrixMediaService.uploadFile(file, progressCallback)
      messageBody.url = result.contentUri
    }

    if (isEncrypted) {
      const result = await matrixMediaService.uploadEncryptedFile(file, progressCallback)
      messageBody.encryptedFile = result.encryptedFile
      delete (messageBody as Record<string, unknown>).url
    } else if (!localPath) {
      await uploadFromBlob()
    } else {
      try {
        const { uploadUrl, downloadUrl, config } = await messageStrategy.uploadFile(localPath, {
          provider: UploadProviderEnum.DEFAULT
        })
        const uploadedUrl = await messageStrategy.doUpload(localPath, uploadUrl, config as Record<string, unknown>)
        messageBody.url = uploadedUrl || downloadUrl
      } catch (error) {
        logger.warn('path 版上传不可用，回退 blob 直传:', error)
        await uploadFromBlob()
      }
    }
    cleanup()

    delete (messageBody as Record<string, unknown>).path

    const finalBody = msgType === MsgEnum.IMAGE ? await withImageInfo(messageBody, file) : messageBody

    chatStore.updateMsg({
      msgId: tempMsgId,
      body: finalBody,
      type: msgType,
      status: MessageStatusEnum.SENDING
    })

    await sendWithTracking({
      tempMsgId,
      payload: { id: tempMsgId, roomId: targetRoomId, msgType, body: finalBody }
    })
  } catch (error) {
    cleanup()
    throw error
  }
}

async function processGenericPathFile(
  file: PathUploadFile,
  tempMsgId: string,
  messageStrategy: MessageStrategy,
  targetRoomId: string,
  ctx: FileUploadContext
): Promise<void> {
  const { reply, globalStore, userUid, chatStore, sendWithTracking } = ctx
  const { t } = useI18nGlobal()
  const MAX_UPLOAD_SIZE = 500 * 1024 * 1024
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error(t('hooks.msg_input.file_size_exceeded'))
  }

  const msgType = isImageUpload(file) ? MsgEnum.IMAGE : MsgEnum.FILE
  const msg = {
    type: msgType,
    path: file.path,
    fileName: file.name,
    size: file.size,
    mimeType: file.type,
    reply: reply.value.content ? { content: reply.value.content, key: reply.value.key } : undefined
  }

  const messageBody = messageStrategy.buildMessageBody(msg, reply.value as StrategyReplyArg)

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
    const progressCallback = (pct: number) => {
      if (!isProgressActive) return
      updateProgress(pct)
    }

    const isEncrypted = await cryptoSDKAdapter.requireRoomEncryptionState(targetRoomId)

    if (isEncrypted) {
      // file.path 可能是两种来源，均可通过收窄后的 fs:read-files scope：
      //  1. dialog open() 选中的原始路径 —— Tauri v2 会自动把选中文件加入 fs scope；
      //  2. 拖拽路径 —— 已由 FileUtil.copyDroppedFilesToAppScope 复制到 $APPDATA/userData/dropped。
      const fileData = await readFile(file.path)
      const fileBlob = new File([fileData], file.name, { type: file.type })
      const result = await matrixMediaService.uploadEncryptedFile(fileBlob, progressCallback)
      cleanup()
      messageBody.encryptedFile = result.encryptedFile
      delete (messageBody as Record<string, unknown>).url
    } else {
      const { uploadUrl, downloadUrl, config } = await messageStrategy.uploadFile(msg.path, {
        provider: UploadProviderEnum.DEFAULT
      })
      const uploadedUrl = await messageStrategy.doUpload(msg.path, uploadUrl, config as Record<string, unknown>)
      cleanup()
      messageBody.url = uploadedUrl || downloadUrl
    }

    delete (messageBody as Record<string, unknown>).path

    const finalBody = msgType === MsgEnum.IMAGE ? await withImageInfo(messageBody, file) : messageBody

    chatStore.updateMsg({
      msgId: tempMsgId,
      body: finalBody,
      type: msgType,
      status: MessageStatusEnum.SENDING
    })

    await sendWithTracking({
      tempMsgId,
      payload: { id: tempMsgId, roomId: targetRoomId, msgType, body: finalBody }
    })
  } catch (error) {
    cleanup()
    throw error
  }
}

export function useMsgInputFileUpload(
  messageInputDom: Ref<HTMLElement>,
  ctx: FileUploadContext,
  send: () => Promise<void>
) {
  const { globalStore, reply, userUid, chatStore } = ctx
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()

  const sendFilesDirect = async (files: UploadFile[]) => {
    const targetRoomId = globalStore.currentSessionRoomId

    // 上传前配额预检：接口不可用时 checkQuota 返回 null，直接放行，不阻断上传主链。
    const quota = await matrixMediaService.checkQuota()
    if (quota && quota.limit > 0) {
      const totalSize = files.reduce((sum, file) => sum + file.size, 0)
      if (quota.remaining < totalSize) {
        showFeedback(t('setting.storage.quota_exceeded_upload'), 'warning')
        return
      }
    }

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
            await processGenericPathFile(job.file, tempMsgId, messageStrategy, targetRoomId, ctx)
          } else {
            await processGenericFile(job.file, tempMsgId, messageStrategy, targetRoomId, ctx)
          }

          if (job.fileId) {
            globalFileUploadQueue.updateFileStatus(job.fileId, 'completed', 100)
          }
        } catch (error) {
          logger.error(`${job.file.name} 发送失败:`, error)

          if (job.fileId) {
            globalFileUploadQueue.updateFileStatus(job.fileId, 'failed', 0)
          }

          chatStore.updateMsg({ msgId: tempMsgId, status: MessageStatusEnum.FAILED })
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
        const contentType = ctx.getMessageContentType(messageInputDom)
        if (contentType === MsgEnum.IMAGE || contentType === MsgEnum.EMOJI) {
          await send()
        }
      }
    } catch (error) {
      logger.error('自动发送输入框图片失败:', error)
    }
  }

  return { sendFilesDirect, processGenericFile, processGenericPathFile }
}
