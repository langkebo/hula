/** 房间/群组相关枚举 */

/** 房间类型 1群聊 2单聊 3空间 */
export enum RoomTypeEnum {
  /** 1群聊 */
  GROUP = 1,
  /** 2单聊 */
  SINGLE = 2,
  /** 3空间 */
  SPACE = 3
}

/** 房间操作 */
export enum RoomActEnum {
  /** 退出群聊 */
  EXIT_GROUP,
  /** 解散群聊 */
  DISSOLUTION_GROUP,
  /** 删除好友 */
  DELETE_FRIEND,
  /** 删除记录 */
  DELETE_RECORD,
  /** 屏蔽好友 */
  BLOCK_FRIEND,
  /** 修改群名称 */
  UPDATE_GROUP_NAME,
  /** 修改群信息 */
  UPDATE_GROUP_INFO
}

/** 变更类型 1 加入群组，2： 移除群组 */
export enum ChangeTypeEnum {
  /** 1 加入群组 */
  JOIN = 1,
  /** 2 移除群组 */
  REMOVE,
  /** 3 退出群组 */
  EXIT_GROUP
}

// 成员角色 1群主 2管理员 3普通成员 4踢出群聊
export enum RoleEnum {
  /** 1群主 */
  LORD = 1,
  /** 2管理员 */
  ADMIN,
  /** 3普通成员 */
  NORMAL
  /** 4踢出群聊 */
}
