/**
 * @deprecated 此文件中的类型定义正在迁移到 Matrix SDK 类型
 * 请逐步使用 matrix-js-sdk 提供的类型定义
 * 迁移完成后此文件将被重构
 */
/**
 * 类型定义文件（按域拆分的 barrel 入口）
 *
 * 本文件仅做 re-export，具体类型定义已按域拆分至 `./types/`：
 * - `user.ts`    用户域（RegisterUserReq / UserItem / UserInfoType / BadgeType / ModifyUserInfoType / UserState）
 * - `message.ts` 消息域（消息体 / MsgType / ReplyType / 互动标记）
 * - `notice.ts`  通知域（RequestNoticeAgreeStatus / NoticeType / NoticeItem）
 * - `contact.ts` 联系人/会话域（FriendItem / IsAllUserEnum / SessionItem）
 * - `room.ts`    房间域（DetailsContent / RoomMemberInfo / RoomDetail / RoomInfo）
 * - `misc.ts`    杂项（AIModel / FilesMeta）
 *
 * 注意：请使用TSDoc规范进行注释，以便在使用时能够获得良好提示。
 * @see TSDoc规范 https://tsdoc.org/
 **/

export * from './types/contact'
export * from './types/message'
export * from './types/misc'
export * from './types/notice'
export * from './types/room'
export * from './types/user'
