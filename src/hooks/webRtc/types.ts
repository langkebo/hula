import type { CallTypeEnum, RTCCallStatus } from '@/enums'

/**
 * WebRTC signalling message types exchanged over the Matrix VoIP channel.
 */
export enum SignalTypeEnum {
  JOIN = 'join',
  OFFER = 'offer',
  ANSWER = 'answer',
  CANDIDATE = 'candidate',
  LEAVE = 'leave'
}

/**
 * Wire shape of a WebRTC call signalling message.
 */
export interface WSRtcCallMsg {
  roomId: string
  callerId: string
  signalType: SignalTypeEnum
  signal: string
  receiverIds: string[]
  senderId?: string
  status: RTCCallStatus
  video: boolean
  targetUid: string
}

export interface RtcMsgVO {
  roomId: string
  callType: CallTypeEnum
  callerId: string
  [key: string]: unknown
}
