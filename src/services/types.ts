/**
 * @deprecated 此文件中的类型定义正在迁移到 Matrix SDK 类型
 * 请逐步使用 matrix-js-sdk 提供的类型定义
 * 迁移完成后此文件将被重构
 */
/**
 * 类型定义文件
 * 注意：请使用TSDoc规范进行注释，以便在使用时能够获得良好提示。
 * @see TSDoc规范https://tsdoc.org/
 **/
import type {
  ActEnum,
  IsYesEnum,
  MarkEnum,
  MessageStatusEnum,
  MsgEnum,
  NotificationTypeEnum,
  OnlineEnum,
  RoomTypeEnum,
  SessionOperateEnum,
  SexEnum
} from '@/enums'
import type { EncryptedAttachmentFile } from '@/services/matrix/crypto/MatrixAttachmentEncryptionService'

/* ======================================================== */

export type RegisterUserReq = {
  /** 默认随机头像 */
  avatar: string
  /** 昵称 */
  nickName: string
  /** 邮箱 */
  email: string
  /** 密码 */
  password: string
  /** 邮箱验证码 */
  code: string
  /** 识别码 */
  uuid: string
  key?: string
  confirmPassword: string
  systemType: number
}

export type UserItem = {
  /** 在线状态 */
  activeStatus: OnlineEnum
  /** 头像 */
  avatar: string
  /** 最后一次上下线时间 */
  lastOptTime: number
  /** 用户名称 */
  name: string
  /** uid */
  uid: string
  /** 角色ID */
  roleId?: number
  /** 账号 */
  account: string
  /** 我的群昵称 */
  myName?: string
  /** 用户状态 */
  userStateId?: string
  /** 是否绑定 Gitee */
  linkedGitee?: boolean
  /** 是否绑定 GitHub */
  linkedGithub?: boolean
  /** 已绑定的 OAuth 提供商 */
  oauthProviders?: ('gitee' | 'github')[]
}

export type UserInfoType = {
  /** 用户唯一标识 */
  uid: string
  /** 用户账号 */
  account: string
  /** 邮箱 */
  email: string
  /** 密码 */
  password?: string
  /** 用户头像 */
  avatar: string
  /** 用户名 */
  name: string
  /** 剩余改名次数 */
  modifyNameChance: number
  /** 性别 1为男性，2为女性 */
  sex: SexEnum
  /** 权限 */
  power?: number
  /** 手机号 */
  phone?: string
  /** 用户状态id */
  userStateId: string
  /** 头像更新时间 */
  avatarUpdateTime: number
  /** 客户端 */
  client: string
  /** 个人简介 */
  resume: string
  /** 当前在线状态（前端缓存，登录/presence 同步时写入） */
  activeStatus?: number
  /** 最近活跃时间戳（毫秒） */
  lastOptTime?: number
  /** 最近一次成功登录绑定的 homeserver */
  homeserverUrl?: string
  /** 最近一次成功登录绑定的 identity server */
  identityServerUrl?: string
  /** 是否绑定 Gitee */
  linkedGitee?: boolean
  /** 是否绑定 GitHub */
  linkedGithub?: boolean
  /** 已绑定的 OAuth 提供商 */
  oauthProviders?: ('gitee' | 'github')[]
}

export type BadgeType = {
  // 徽章描述
  describe: string
  // 徽章id
  id: string
  // 徽章图标
  img: string
  // 是否拥有 0否 1是
  obtain: IsYesEnum
  // 是否佩戴 0否 1是
  wearing: IsYesEnum
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

export type RevokedMsgType = {
  /** 消息ID */
  msgId: string
  /** 会话ID */
  roomId?: string
  /** 撤回人ID */
  recallUid?: string
}

export type EmojiItem = {
  expressionUrl: string
  id: string
  /** 本地缓存路径，存在时用于渲染展示 */
  localUrl?: string
}

// -------------------- ⬇消息体类型定义⬇ ----------------

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

/** 通知状态 */
export enum RequestNoticeAgreeStatus {
  /** 待审批 */
  UNTREATED = 0,
  /** 同意 */
  ACCEPTED,
  /** 拒绝 */
  REJECTED,
  /** 忽略 */
  IGNORE
}

/** 通知事件 */
export enum NoticeType {
  /** 好友申请 */
  FRIEND_APPLY = 1,
  /** 好友被申请 */
  ADD_ME = 6,
  /** 加群申请 */
  GROUP_APPLY = 2,
  /** 群邀请 */
  GROUP_INVITE = 3,
  /** 被邀请进群 */
  GROUP_INVITE_ME = 7,
  /** 移除群成员 */
  GROUP_MEMBER_DELETE = 5,
  /** 设置群管理员 */
  GROUP_SET_ADMIN = 8,
  /** 取消群管理员 */
  GROUP_RECALL_ADMIN = 9
}

export interface NoticeItem {
  /** 实体ID */
  id?: string
  /** 通知类型:1-好友申请;2-群申请;3-群邀请;5-移除群成员;6-好友被申请;7-被邀请进群 */
  eventType: number
  /** 通知类型 1群聊 2加好友 */
  type: number
  /** 发起人UID */
  senderId: string
  /** 接收人UID */
  receiverId: string
  /** 申请ID */
  applyId: string
  /** 房间ID */
  roomId: string
  /** 被操作的人 */
  operateId?: string
  /** 通知内容 申请时填写的 */
  content: string
  /** 处理状态:0-未处理;1-已同意;2-已拒绝;3-忽略 */
  status: number
  /** 是否已读 */
  isRead: boolean
  /** 创建时间 */
  createTime?: number
}

/** 联系人的列表项 */
export type FriendItem = {
  /** 好友id */
  uid: string
  /** 好友备注 */
  remark: string
  /** 在线状态 1在线 2离线 */
  activeStatus: OnlineEnum
  /** 最后一次上下线时间 */
  lastOptTime: number
  /** 不让他看我（0-允许，1-禁止） */
  hideMyPosts: boolean
  /** 不看他（0-允许，1-禁止） */
  hideTheirPosts: boolean
}

/** 是否全员展示的会话 0否 1是 */
export enum IsAllUserEnum {
  /** 0否 */
  Not,
  /** 1是 */
  Yes
}

/** 会话列表项 */
export type SessionItem = {
  /** tjg号 */
  account: string
  /** 房间最后活跃时间(用来排序) */
  activeTime: number
  /** 会话头像 */
  avatar: string
  /** 会话id */
  id: string
  /** 如果是单聊，则是对方的uid，如果是群聊，则是群id */
  detailId: string
  /** 是否全员展示的会话 0否 1是 */
  hotFlag: IsAllUserEnum
  /** 会话名称 */
  name: string
  /** 房间id */
  roomId: string
  /** 最新消息 */
  text: string
  /** 房间类型 1群聊 2单聊 */
  type: RoomTypeEnum
  /** 未读数 */
  unreadCount: number
  /** 是否置顶 0否 1是 */
  top: boolean
  /** 会话操作 */
  operate: SessionOperateEnum
  /** 在线状态 1在线 2离线 */
  activeStatus?: OnlineEnum
  /** 隐藏会话 */
  hide: boolean
  /** 免打扰类型 */
  muteNotification: NotificationTypeEnum
  /** 屏蔽消息 */
  shield: boolean
  /** 群成员数 */
  memberNum?: number
  /** 群备注 */
  remark?: string
  /** 我的群昵称 */
  myName?: string
  /** 是否选中（非后端） */
  isCheck?: boolean
  allowScanEnter: boolean
}

/** AI模型 */
export type AIModel = {
  uid: string
  type: 'Ollama' | 'OpenAI'
  name: string
  value: string
  avatar: string
}

/** 修改用户基础信息的类型 */
export type ModifyUserInfoType = {
  name: string
  avatar: string
  sex?: number
  phone?: string
  resume?: string
  /** 昵称修改次数 */
  modifyNameChance: number
}

/** 用户状态 */
export type UserState = {
  /** id */
  id: string
  /** 标题 */
  title: string
  /** 链接 */
  url: string
  /** 背景颜色 */
  bgColor?: string
}

/* ======================================================== */
export type FilesMeta = {
  name: string
  path: string
  file_type: string
  mime_type: string
  exists: boolean
}[]

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

export type DetailsContent =
  | {
      type: 'apply'
      applyType: 'friend' | 'group'
    }
  | {
      type: RoomTypeEnum
      uid: string
    }

export interface RoomMemberInfo {
  userId: string
  name: string
  avatarUrl?: string
  powerLevel?: number
}

export interface RoomDetail {
  roomId: string
  topic: string | null
  memberCount: number
  joinedCount: number
  ownerId: string | null
  joinRule: 'public' | 'invite' | 'knock' | 'private' | null
  canonicalAlias: string | null
  avatarUrl: string | null
  createdTs: number | null
  isPublic: boolean | null
}

export interface RoomInfo {
  roomId: string
  name: string
  avatarUrl: string | null
  isDirect: boolean
  isEncrypted: boolean
  unreadCount: number
  highlightCount: number
  notificationCount: number
  lastMessage: string | null
  lastMessageTime: number | null
  members: RoomMemberInfo[]
  detail?: RoomDetail
}
