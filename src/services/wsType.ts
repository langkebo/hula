/**
 * @deprecated 此文件已废弃，Matrix 使用同步 API 替代 WebSocket
 * 请使用 matrix-js-sdk 的同步机制
 * 迁移完成后此文件将被删除
 */
import type { UserInfoType } from '@/services/types'

export enum WsResponseMessageType {
  NO_INTERNET = 'noInternet',
  LOGIN_SUCCESS = 'loginSuccess',
  RECEIVE_MESSAGE = 'receiveMessage',
  ONLINE = 'online',
  TOKEN_EXPIRED = 'tokenExpired',
  INVALID_USER = 'invalidUser',
  MSG_MARK_ITEM = 'msgMarkItem',
  MSG_RECALL = 'msgRecall',
  REQUEST_NEW_FRIEND = 'requestNewFriend',
  WS_MEMBER_CHANGE = 'ws-member-change',
  GROUP_SET_ADMIN_SUCCESS = 'groupSetAdmin',
  OFFLINE = 'offline',
  REQUEST_APPROVAL_FRIEND = 'requestApprovalFriend',
  NOTIFY_EVENT = 'notifyEvent',
  USER_STATE_CHANGE = 'userStateChange',
  ROOM_INFO_CHANGE = 'roomInfoChange',
  MY_ROOM_INFO_CHANGE = 'myRoomInfoChange',
  ROOM_DISSOLUTION = 'roomDissolution',
  JoinVideo = 'JoinVideo',
  ROOM_GROUP_NOTICE_MSG = 'roomGroupNoticeMsg',
  ROOM_EDIT_GROUP_NOTICE_MSG = 'roomEditGroupNoticeMsg',
  ROOM_GROUP_NOTICE_READ_MSG = 'roomGroupNoticeReadMsg',
  VideoCallRequest = 'VideoCallRequest',
  CallAccepted = 'CallAccepted',
  CallRejected = 'CallRejected',
  RoomClosed = 'RoomClosed',
  MediaControl = 'MediaControl',
  TIMEOUT = 'TIMEOUT',
  DROPPED = 'DROPPED',
  LeaveVideo = 'LeaveVideo',
  ScreenSharingStarted = 'ScreenSharingStarted',
  ScreenSharingStopped = 'ScreenSharingStopped',
  NetworkPoor = 'NetworkPoor',
  UserKicked = 'UserKicked',
  WEBRTC_SIGNAL = 'WEBRTC_SIGNAL',
  AllMuted = 'AllMuted',
  CANCEL = 'CANCEL'
}

export enum NoticeTypeEnum {
  GROUP_SET_ADMIN = 8,
  GROUP_RECALL_ADMIN = 9
}

export enum WsRequestMsgType {
  RequestLoginQrCode = 1,
  HeartBeatDetection,
  Authorization,
  VIDEO_HEARTBEAT,
  VIDEO_CALL_REQUEST,
  VIDEO_CALL_RESPONSE,
  MEDIA_MUTE_AUDIO,
  MEDIA_MUTE_VIDEO,
  MEDIA_MUTE_ALL,
  SCREEN_SHARING,
  CLOSE_ROOM,
  KICK_USER,
  NETWORK_REPORT,
  WEBRTC_SIGNAL
}

export type WsReqMsgContentType = {
  type: WsRequestMsgType
  data?: Record<string, unknown>
}
export type LoginInitResType = { loginUrl: string }

export type LoginSuccessResType = Pick<UserInfoType, 'avatar' | 'name' | 'uid' | 'account'> & {
  token: string
}

export type OnStatusChangeType = {
  uid: string
  type: number
  roomId: string
  lastOptTime: number
}

export type WsTokenExpire = {
  uid: string
  ip: string
  client: string
}

export type UserStateType = {
  id: string
  title: string
  url: string
}

export interface VideoCallRequestData {
  targetUid: string
  roomId: string
  mediaType: 'AudioSignal' | 'VideoSignal'
}

export interface CallResponseData {
  callerUid: string
  targetUid: string
  roomId: string
  accepted: boolean
}

export interface SignalData {
  roomId: string
  signal: unknown
  mediaType: 'AudioSignal' | 'VideoSignal'
}

export interface SignalSdp {
  sdp: string
  type: string
}

export interface CallSignalMessage {
  callerUid: string
  roomId: string
  signal: string
  signalType: string
  targetUid: string
  video: boolean
}

export interface RoomActionData {
  roomId: string
  uid: string
}

export enum CallResponseStatus {
  TIMEOUT = -1,
  REJECTED = 0,
  ACCEPTED = 1,
  DROPPED = 2,
  CANCEL = 3
}

export const CallResponseStatusDesc: Record<CallResponseStatus, string> = {
  [CallResponseStatus.TIMEOUT]: '超时未接听',
  [CallResponseStatus.REJECTED]: '已拒绝',
  [CallResponseStatus.ACCEPTED]: '已接听',
  [CallResponseStatus.DROPPED]: '已挂断',
  [CallResponseStatus.CANCEL]: '已取消'
}

export function getCallResponseStatus(code: number): CallResponseStatus | undefined {
  return Object.values(CallResponseStatus).includes(code) ? (code as CallResponseStatus) : undefined
}

export function getCallResponseStatusDesc(code: number): string {
  const status = getCallResponseStatus(code)
  return status !== undefined ? CallResponseStatusDesc[status] : '未知状态'
}
