import type { ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import type { EmojiMenuItem } from '@/hooks/chatMain/emojiMenuData'
import { matrixEventService } from '@/services/matrix/MatrixEventService'
import { matrixReactionService } from '@/services/matrix/messaging/MatrixReactionService'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { createLogger } from '@/utils/Logger'
import { toSafeBody } from '@/utils/messageBody'

const logger = createLogger('MessageActions')

type UseMessageActionsOptions = {
  isMe: ComputedRef<boolean>
  emojiList: ComputedRef<EmojiMenuItem[]>
}

export const useMessageActions = (options: UseMessageActionsOptions) => {
  const { isMe, emojiList } = options
  const { t } = useI18n()
  const chatStore = useChatStore()

  const handleRetry = async (item: MessageType): Promise<void> => {
    if (!item?.message) return

    const { id, roomId, body: rawBody, type } = item.message
    const msgBody = toSafeBody(rawBody)

    chatStore.updateMsg({
      msgId: id,
      status: MessageStatusEnum.SENDING
    })

    try {
      let eventId: string

      switch (type) {
        case MsgEnum.TEXT:
          eventId = await matrixEventService.sendTextMessage(roomId, msgBody.text || '')
          break
        case MsgEnum.IMAGE:
          if (msgBody.url) {
            eventId = await matrixEventService.sendImageMessage(roomId, msgBody.url, {
              size: msgBody.size || 0,
              mimetype: msgBody.mimetype || 'image/png',
              width: msgBody.width,
              height: msgBody.height
            })
          } else {
            throw new Error('图片URL不存在')
          }
          break
        case MsgEnum.VIDEO:
          if (msgBody.url) {
            eventId = await matrixEventService.sendVideoMessage(
              roomId,
              msgBody.url,
              {
                size: msgBody.size || 0,
                mimetype: msgBody.mimetype || 'video/mp4',
                width: msgBody.width,
                height: msgBody.height
              },
              msgBody.filename,
              msgBody.thumbnail,
              {
                width: msgBody.thumbnailInfo?.w || 0,
                height: msgBody.thumbnailInfo?.h || 0,
                size: msgBody.thumbnailInfo?.size || 0
              }
            )
          } else {
            throw new Error('视频URL不存在')
          }
          break
        case MsgEnum.AUDIO:
          if (msgBody.url) {
            eventId = await matrixEventService.sendAudioMessage(
              roomId,
              msgBody.url,
              {
                size: msgBody.size || 0,
                mimetype: msgBody.mimetype || 'audio/ogg',
                duration: msgBody.duration
              },
              msgBody.filename
            )
          } else {
            throw new Error('音频URL不存在')
          }
          break
        case MsgEnum.FILE:
          if (msgBody.url) {
            eventId = await matrixEventService.sendFileMessage(
              roomId,
              msgBody.url,
              {
                size: msgBody.size || 0,
                mimetype: msgBody.mimetype || 'application/octet-stream'
              },
              msgBody.filename
            )
          } else {
            throw new Error('文件URL不存在')
          }
          break
        default:
          throw new Error(`不支持的消息类型: ${type}`)
      }

      chatStore.updateMsg({
        msgId: id,
        status: MessageStatusEnum.SUCCESS,
        newMsgId: eventId
      })

      window.$message.success(t('message_container.resend_success'))
    } catch (error) {
      logger.error('消息重发失败:', error)

      chatStore.updateMsg({
        msgId: id,
        status: MessageStatusEnum.FAILED
      })

      window.$message.error(t('message_container.resend_failed'))
    }
  }

  const handleCopyTranslation = (text: string) => {
    if (text) {
      navigator.clipboard.writeText(text)
      window.$message.success(t('message_container.copy_success'))
    }
  }

  const isSingleLineEmojis = (item: MessageType): boolean => {
    if (!item || !item.fromUser || !item.message) return false

    let emojiCount = 0
    for (const emoji of emojiList.value) {
      if (getEmojiCount(item, emoji.value) > 0) {
        emojiCount++
      }
    }

    return isMe.value && emojiCount <= 5
  }

  const cancelReplyEmoji = async (item: MessageType, type: number): Promise<void> => {
    if (!item || !item.message || !item.message.messageMarks) return

    const userMarked = item.message.messageMarks[String(type)]?.userMarked

    if (userMarked) {
      try {
        await matrixReactionService.toggleReaction(item.message.roomId, item.message.id, String(type))
      } catch (error) {
        logger.error('取消表情标记失败:', error)
      }
    }
  }

  const getEmojiCount = (item: MessageType, emojiType: number): number => {
    if (!item || !item.message || !item.message.messageMarks) return 0

    return item.message.messageMarks[String(emojiType)]?.count || 0
  }

  const hasUserMarkedEmoji = (item: MessageType, emojiType: number) => {
    if (!item || !item.message || !item.message.messageMarks) return false

    return item.message.messageMarks[String(emojiType)]?.userMarked
  }

  const handleEmojiSelect = async (
    context: { label: string; value: number; title: string },
    item: MessageType
  ): Promise<void> => {
    if (!item || !item.message) return

    if (!item.message.messageMarks) {
      item.message.messageMarks = {}
    }

    const userMarked = item.message.messageMarks[String(context.value)]?.userMarked
    if (!userMarked) {
      try {
        await matrixReactionService.toggleReaction(item.message.roomId, item.message.id, String(context.value))
      } catch (error) {
        logger.error('标记表情失败:', error)
      }
    } else {
      window.$message.warning(t('message_container.emoji_already_marked'))
    }
  }

  return {
    handleRetry,
    handleCopyTranslation,
    isSingleLineEmojis,
    cancelReplyEmoji,
    getEmojiCount,
    hasUserMarkedEmoji,
    handleEmojiSelect
  }
}
