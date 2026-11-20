/**
 * 发送事件响应夹具。
 *
 * 契约来源：`matrixMessageService.sendTextMessage()` 的返回（SDK `ISendEventResponse`）。
 */
import type { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'

export type SendTextMessageResponse = Awaited<ReturnType<typeof matrixMessageService.sendTextMessage>>

export function makeSendTextMessageResponse(eventId = '$event:example.org'): SendTextMessageResponse {
  return { event_id: eventId }
}
