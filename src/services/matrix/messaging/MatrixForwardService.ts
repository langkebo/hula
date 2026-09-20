import type { MatrixEvent } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { cryptoSDKAdapter } from '../crypto/CryptoSDKAdapter'
import { matrixEventService } from '../MatrixEventService'
import { matrixMessageService } from './MatrixMessageService'

const logger = createLogger('MatrixForwardService')

interface ForwardResult {
  roomId: string
  success: boolean
  eventId?: string
  error?: string
}

type EventContent = Record<string, unknown>

/**
 * 判断内容是否携带**已解密**的加密附件描述符。
 *
 * SDK 的 `event.getContent()` 返回解密后的内容，因此加密房间里的附件会带着
 * `file.key.k`（AES 解密密钥）出现在这里。把它原样发进明文房间等于公开该密钥。
 *
 * @param content 事件内容
 */
function hasEncryptedFile(content: EventContent): boolean {
  const file = content.file
  if (typeof file !== 'object' || file === null) return false
  const key = (file as { key?: unknown }).key
  const url = (file as { url?: unknown }).url
  return typeof url === 'string' && typeof key === 'object' && key !== null
}

/** 判断内容是否携带加密缩略图描述符 */
function hasEncryptedThumbnail(content: EventContent): boolean {
  return hasEncryptedFile({ file: content.thumbnail_file })
}

class MatrixForwardService {
  async forwardEvent(event: MatrixEvent, roomId: string): Promise<string> {
    try {
      const eventType = event.getType()
      const content = event.getContent() as EventContent
      const carriesEncryptedMedia = hasEncryptedFile(content) || hasEncryptedThumbnail(content)

      // 安全门：带加密描述符的消息只能转发进加密房间。
      // 明文房间会把它当作普通 file/url 存储并公开 key.k，导致附件失去端到端保护。
      if (carriesEncryptedMedia && !(await cryptoSDKAdapter.isRoomEncrypted(roomId))) {
        throw new Error('无法转发加密附件到未加密房间：这会泄露该附件的解密密钥。请先为目标房间开启加密。')
      }

      return await matrixEventService.sendEvent(roomId, eventType, {
        ...content,
        'm.relates_to': {
          rel_type: 'm.reference',
          event_id: event.getId()
        }
      })
    } catch (err) {
      logger.error(`[Forward] 转发事件失败: ${err}`)
      throw err
    }
  }

  async forwardEventToMultipleRooms(event: MatrixEvent, roomIds: string[]): Promise<ForwardResult[]> {
    const results = await Promise.all(
      roomIds.map(async (roomId): Promise<ForwardResult> => {
        try {
          const eventId = await this.forwardEvent(event, roomId)
          logger.info(`[MatrixForward] 转发成功: ${event.getId()} -> ${roomId}`)
          return {
            roomId,
            success: true,
            eventId
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : '转发失败'
          logger.error(`[MatrixForward] 转发失败: ${event.getId()} -> ${roomId}, ${message}`)
          return {
            roomId,
            success: false,
            error: message
          }
        }
      })
    )

    return results
  }

  async forwardRoomMessages(
    sourceRoomId: string,
    eventIds: string[],
    targetRoomIds: string[]
  ): Promise<ForwardResult[]> {
    const results: ForwardResult[] = []

    for (const eventId of eventIds) {
      const event = await matrixMessageService.getRoomMessage(sourceRoomId, eventId)
      if (!event) {
        const message = `源消息不存在: ${eventId}`
        logger.error(`[MatrixForward] ${message}, source=${sourceRoomId}`)
        results.push(
          ...targetRoomIds.map((roomId) => ({
            roomId,
            success: false,
            error: message
          }))
        )
        continue
      }

      const forwarded = await this.forwardEventToMultipleRooms(event, targetRoomIds)
      results.push(...forwarded)
    }

    return results
  }
}

export const matrixForwardService = new MatrixForwardService()
