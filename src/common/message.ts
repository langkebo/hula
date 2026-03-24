import { MsgEnum } from '@/enums'

// 消息回复映射表
export const MSG_REPLY_TEXT_MAP: Record<number, string> = {
  [MsgEnum.UNKNOWN]: '[不支持的消息类型]',
  [MsgEnum.RECALL]: '[撤回消息]',
  [MsgEnum.IMAGE]: '[图片]',
  [MsgEnum.FILE]: '[文件]',
  [MsgEnum.VOICE]: '[语音]',
  [MsgEnum.VIDEO]: '[视频]',
  [MsgEnum.EMOJI]: '[动画表情]',
  [MsgEnum.MERGE]: '[聊天记录]',
  [MsgEnum.NOTICE]: '[公告]',
  [MsgEnum.VIDEO_CALL]: '[视频通话]',
  [MsgEnum.AUDIO_CALL]: '[语音通话]',
  [MsgEnum.BOT]: '[小管家]',
  [MsgEnum.LOCATION]: '[位置]',
  [MsgEnum.BEACON]: '[实时位置共享]',
  [MsgEnum.LINK_PREVIEW]: '[链接预览]'
}
