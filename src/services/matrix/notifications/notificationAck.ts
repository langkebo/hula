import { createLogger } from '@/utils/Logger'
import { matrixHttpClient } from '../MatrixHttpClient'
import { MATRIX_PATHS } from '../paths'

const logger = createLogger('NotificationAck')

/**
 * ack 降级只需要「强制已读回执」这一个能力，因此不引用完整 `MatrixClient`：
 * 结构化的最小接口既避免了 SDK 边界扩散，也让测试可以直接传桩对象。
 */
export interface ReadReceiptCapableClient {
  getReadReceiptsManager(): {
    sendReceiptForce(roomId: string, receiptType: string, eventId: string): Promise<unknown>
  }
}

let ackEndpointAvailableCache: boolean | null = null
let ackCheckTimestamp = 0
const ACK_CHECK_TTL = 5 * 60 * 1000

/** 清空 ack 端点可用性缓存（登出 / 切账号时回收，避免把上一个账号的探测结果带过去）。 */
export function clearAckEndpointCache(): void {
  ackEndpointAvailableCache = null
  ackCheckTimestamp = 0
}

/** 通过服务端 ack 端点确认通知；端点不可用或网络失败时返回 `false`。 */
export async function ackNotification(notificationId: string): Promise<boolean> {
  try {
    await matrixHttpClient.request('POST', MATRIX_PATHS.NOTIFICATION.NOTIFICATIONS_ACK(notificationId))
    logger.info(`[MatrixNotification] 通知确认成功: ${notificationId}`)
    return true
  } catch (err) {
    logger.error(`[MatrixNotification] 通知确认失败: ${err}`)
    return false
  }
}

/** 用强制已读回执兜底：ack 端点不可用时把通知当已读处理。 */
export async function sendReadReceipt(
  client: ReadReceiptCapableClient,
  roomId: string,
  eventId: string
): Promise<boolean> {
  try {
    await client.getReadReceiptsManager().sendReceiptForce(roomId, 'm.read', eventId)
    logger.info(`[MatrixNotification] 已读回执发送成功: ${roomId}/${eventId}`)
    return true
  } catch (err) {
    logger.error(`[MatrixNotification] 已读回执发送失败: ${err}`)
    return false
  }
}

/**
 * 确认通知并带 ack → 已读回执的自动降级。
 *
 * 端点可用性探测结果按 `ACK_CHECK_TTL` 缓存：服务端不支持 ack 时不必每条通知都白试一次，
 * 但缓存过期后会重新探测，避免服务端升级后被永久钉死在回执路径。
 *
 * @param client 已就绪的矩阵客户端（回执兜底需要）
 * @param notificationId 通知 ID
 * @param roomId 兜底回执要标记的房间
 * @param eventId 兜底回执要标记的事件
 */
export async function ackNotificationWithFallback(
  client: ReadReceiptCapableClient,
  notificationId: string,
  roomId: string,
  eventId: string
): Promise<{ success: boolean; method: 'ack' | 'receipt' }> {
  const now = Date.now()
  if (ackEndpointAvailableCache !== null && now - ackCheckTimestamp < ACK_CHECK_TTL) {
    if (ackEndpointAvailableCache) {
      const ok = await ackNotification(notificationId)
      return { success: ok, method: 'ack' }
    }
    const ok = await sendReadReceipt(client, roomId, eventId)
    return { success: ok, method: 'receipt' }
  }

  const ok = await ackNotification(notificationId)
  if (ok) {
    ackEndpointAvailableCache = true
    ackCheckTimestamp = now
    return { success: true, method: 'ack' }
  }

  logger.info(`[MatrixNotification] ack 端点不可用，回退到已读回执: ${notificationId}`)
  ackEndpointAvailableCache = false
  ackCheckTimestamp = now
  const receiptOk = await sendReadReceipt(client, roomId, eventId)
  return { success: receiptOk, method: 'receipt' }
}
