/**
 * 用户域类型定义
 * 注意：请使用TSDoc规范进行注释，以便在使用时能够获得良好提示。
 * @see TSDoc规范 https://tsdoc.org/
 */
import type { IsYesEnum, OnlineEnum, SexEnum } from '@/enums'

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
