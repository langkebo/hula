import { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'

interface HistoryMessageGroup {
  messages: MessageType[]
  timestamp: number
}

/**
 * 按发送日期分组聊天记录，排除 BOT / SYSTEM / 撤回类消息。
 *
 * 组内保持传入顺序（时间线顺序）；组的时间戳取该日期首条消息的发送时间，
 * 供模板按日期标签升序渲染。
 */
export function groupHistoryMessages(messages: MessageType[]): Record<string, HistoryMessageGroup> {
  const groups: Record<string, HistoryMessageGroup> = {}

  messages.forEach((item) => {
    if (
      item.message.sendTime &&
      item.message.type !== MsgEnum.BOT &&
      item.message.type !== MsgEnum.SYSTEM &&
      item.message.type !== MsgEnum.RECALL
    ) {
      const date = new Date(item.message.sendTime).toDateString()
      groups[date] ??= {
        messages: [],
        timestamp: item.message.sendTime
      }
      groups[date].messages.push(item)
    }
  })

  return groups
}
