/**
 * 联系人/会话域类型定义
 * 注意：请使用TSDoc规范进行注释，以便在使用时能够获得良好提示。
 * @see TSDoc规范 https://tsdoc.org/
 */
import type { NotificationTypeEnum, OnlineEnum, RoomTypeEnum, SessionOperateEnum } from '@/enums'

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
