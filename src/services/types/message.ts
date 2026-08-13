/**
 * 消息域类型定义（消息体 / 消息实体 / 互动标记）
 * 注意：请使用TSDoc规范进行注释，以便在使用时能够获得良好提示。
 * @see TSDoc规范 https://tsdoc.org/
 */
import type { ActEnum, MarkEnum, MessageStatusEnum, MsgEnum } from '@/enums'
import type { EncryptedAttachmentFile } from '@/services/matrix/crypto/MatrixAttachmentEncryptionService'

/**
 * 消息互动信息
 */
export type MessageMarkType = Record<
  string,
  {
    /** 该表情的计数 */
    count: number
    /** 当前用户是否标记了该表情 */
    userMarked: boolean
  }
>

/** 图片消息体 */
export type ImageBody = {
  size: number
  url: string
  width: number
  height: number
  mimetype?: string
  fileName?: string
  localPath?: string
  thumbnailPath?: string
  encryptedFile?: EncryptedAttachmentFile
}
/** 语音消息体 */
export type VoiceBody = {
  size: number
  second: number
  url: string
  mxcUrl?: string
  localPath?: string
  fileName?: string
  mimeType?: string
  encryptedFile?: EncryptedAttachmentFile
}

export type MergeBodyBody = {
  messageId: string
  uid: string
}

export type MergeBody = {
  body: MergeBodyBody[]
  content: string[]
}
/** 视频 */
export type VideoBody = {
  size: number
  url: string
  filename: string
  thumbSize?: number
  thumbWidth?: number
  thumbHeight?: number
  thumbUrl?: string
  thumbnailEncryptedFile?: EncryptedAttachmentFile
  thumbnailPath?: string
  localPath?: string
  encryptedFile?: EncryptedAttachmentFile
}
/** 文件消息体 */
export type FileBody = {
  size: number
  fileName: string
  url: string
  localPath?: string
  encryptedFile?: EncryptedAttachmentFile
}
/** 文本消息体 */
export type TextBody = {
  /** 消息内容 */
  content: string
  /** 回复 */
  reply?: ReplyType
  /** @用户uid列表，用于精准渲染高亮 */
  atUidList?: string[] | null
  /**
   * 消息链接映射
   */
  urlContentMap?: Record<
    string,
    {
      title: string
      description: string
      image: string
    }
  >
}
/** 公告消息体 */
export type AnnouncementBody = TextBody & {
  /** 公告ID */
  id: string
  /** 创建时间 */
  createTime: number
  /** 更新时间 */
  updateTime: number
}
/** 表情消息 */
export type EmojiBody = {
  url: string
  localPath?: string
}

/** 位置消息体 */
export type LocationBody = {
  /** 纬度 */
  latitude: string
  /** 经度 */
  longitude: string
  /** 地址描述 */
  address: string
  /** 精度描述 */
  precision: string
  /** 时间戳 */
  timestamp: string
}

export type BeaconBody = {
  /** 描述 */
  description: string
  /** 持续时间（毫秒） */
  timeout: number
  /** 是否为实时共享 */
  isLive: boolean
  /** 资产类型，通常是 'm.self' 或 'm.pin' */
  assetType?: string
  /** 最后更新时间 */
  lastUpdateTs?: number
  /** URI (Matrix MSC3489) */
  uri?: string
}

export type LinkPreviewBody = {
  /** 原始 URL */
  url: string
  /** 页面标题 */
  title: string
  /** 页面描述 */
  description?: string
  /** 预览图 URL */
  imageUrl?: string
  /** 网站名称 */
  siteName?: string
}

export type MessageBody =
  | TextBody
  | ImageBody
  | VoiceBody
  | VideoBody
  | FileBody
  | EmojiBody
  | LocationBody
  | BeaconBody
  | LinkPreviewBody
  | (Record<string, unknown> & {
      content?: string
      url?: string
      thumbUrl?: string
      second?: number
      fileName?: string
    })
export type MsgType = {
  /** 消息ID */
  id: string
  /**  房间 ID */
  roomId: string
  /** 消息类型 */
  type: MsgEnum
  /** 动态消息体-`根据消息类型变化` */
  body: MessageBody
  /** 发送时间戳 */
  sendTime: number
  /** 消息互动信息 */
  messageMarks: MessageMarkType
  /** 消息发送状态 */
  status: MessageStatusEnum
  /** 是否阅后即焚 */
  burnAfterRead?: boolean
  /** 阅后即焚剩余秒数 */
  burnRemainingSeconds?: number
  /** 是否正在销毁中 */
  isBurning?: boolean
  /** 是否已销毁 */
  isBurned?: boolean
}

export type ReplyType = {
  id: string
  username: string
  type: MsgEnum
  body: string | object
  /**
   * 是否可消息跳转
   * @enum {number}  `0`否 `1`是
   */
  canCallback: number
  /** 跳转间隔的消息条数  */
  gapCount: number
}

export type RevokedMsgType = {
  /** 消息ID */
  msgId: string
  /** 会话ID */
  roomId?: string
  /** 撤回人ID */
  recallUid?: string
}

export type MarkItemType = {
  /** 操作用户 */
  uid: string
  /** 消息id */
  msgId: string
  /** 操作类型 */
  markType: MarkEnum
  /** 数量 */
  markCount: number
  /** 动作类型 1确认 2取消 */
  actType: ActEnum
}

export type EmojiItem = {
  expressionUrl: string
  id: string
  /** 本地缓存路径，存在时用于渲染展示 */
  localUrl?: string
}

export type RightMouseMessageItem = {
  createId: string | null
  updateId: string | null
  fromUser: {
    uid: string
    nickname: string | null
  }
  message: {
    id: string
    roomId: string
    sendTime: number
    type: number
    body: {
      size: string
      url: string
      fileName: string
      replyMsgId: string | null
      atUidList: string[] | null
      reply: ReplyType | null
    }
    messageMarks: {
      [key: string]: {
        count: number
        userMarked: boolean
      }
    }
  }
  createTime: number | null
  updateTime: number | null
  _index: number
}
