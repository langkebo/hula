/**
 * VoIP 服务 — 类型定义模块。
 *
 * 从 MatrixVoIPService 抽离，包含通话、媒体流、参与者、统计等接口。
 */

export interface VoIPCall {
  callId: string
  roomId: string
  isVideo: boolean
  on(event: string, callback: (...args: unknown[]) => void): void
  off(event: string, callback: (...args: unknown[]) => void): void
  hangup(reason?: string): void
  answer(audio?: boolean, video?: boolean): Promise<void>
  placeCall(audio: boolean, video: boolean): Promise<void>
  setLocalVideoMuted(muted: boolean): Promise<boolean>
  setMicrophoneMuted(muted: boolean): Promise<boolean>
  setScreensharingEnabled(enabled: boolean, opts?: { audio: boolean }): Promise<boolean>
  peerConn?: RTCPeerConnection
}

export interface VoIPCallFeed {
  stream: MediaStream
  purpose: string
  audioMuted: boolean
  videoMuted: boolean
  isLocal(): boolean
  setAudioMuted(muted: boolean): void
  setVideoMuted(muted: boolean): void
}

export interface CallInfo {
  callId: string
  roomId: string
  isVideo: boolean
  isGroup: boolean
  state: CallState
  localStream?: MediaStream
  remoteStream?: MediaStream
  participants: CallParticipant[]
}

export interface CallParticipant {
  userId: string
  displayName?: string
  avatarUrl?: string
  isMuted: boolean
  isVideoMuted: boolean
  isSpeaking: boolean
  stream?: MediaStream
}

export type CallState = 'ringing' | 'connecting' | 'connected' | 'ended' | 'error'

export interface CallOptions {
  audio: boolean
  video: boolean
  screenshare?: boolean
}

export interface CallStats {
  bytesReceived: number
  bytesSent: number
  packetsLost: number
  jitter: number
  roundTripTime: number
}

export interface TurnServerConfig {
  username: string
  password: string
  uris: string[]
  ttl: number
}
