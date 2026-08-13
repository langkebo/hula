/**
 * 通知域类型定义
 * 注意：请使用TSDoc规范进行注释，以便在使用时能够获得良好提示。
 * @see TSDoc规范 https://tsdoc.org/
 */

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
