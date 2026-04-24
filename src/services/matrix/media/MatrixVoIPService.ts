import type { MatrixClient } from 'matrix-js-sdk'
import matrixClientService from '../MatrixClientService'
import { info, error, warn } from '@tauri-apps/plugin-log'

interface VoIPCall {
  callId: string
  roomId: string
  isVideo: boolean
  on(event: string, callback: (...args: unknown[]) => void): void
  off(event: string, callback: (...args: unknown[]) => void): void
  hangup(reason?: string): void
  answer(stream?: MediaStream, video?: boolean): void
  setLocalVideoMuted(muted: boolean): void
  setLocalAudioMuted(muted: boolean): void
  setScreensharingEnabled(enabled: boolean, opts?: { audio: boolean }): Promise<boolean>
  peerConn?: RTCPeerConnection
}

interface VoIPCallFeed {
  stream: MediaStream
  purpose: string
  audioMuted: boolean
  videoMuted: boolean
  isLocal(): boolean
  setAudioMuted(muted: boolean): void
  setVideoMuted(muted: boolean): void
}

interface VoIPCallHandler {
  calls: Record<string, VoIPCall>
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

class MatrixVoIPService {
  private calls: Map<string, CallInfo> = new Map()
  private callHandlers: Map<string, Set<(call: CallInfo) => void>> = new Map()
  private localStream: MediaStream | null = null
  private screenStream: MediaStream | null = null
  private observedClient: MatrixClient | null = null
  private readonly incomingCallListener = (call: VoIPCall) => {
    this.handleIncomingCall(call)
  }
  private readonly hangupCallListener = (call: VoIPCall) => {
    this.handleCallHangup(call)
  }
  private readonly replacedCallListener = (newCall: VoIPCall, oldCall: VoIPCall) => {
    this.handleCallReplaced(newCall, oldCall)
  }

  async initialize(): Promise<void> {
    const client = matrixClientService.getClient() as MatrixClient
    if (!client) {
      warn('[VoIP] 客户端未初始化')
      return
    }

    try {
      if (this.observedClient && this.observedClient !== client) {
        this.detachCallHandlers(this.observedClient)
        this.resetRuntimeState()
        this.observedClient = null
      }

      if (client.voipHandler) {
        if (this.observedClient === client) {
          return
        }
        this.setupCallHandlers(client)
        this.observedClient = client
        info('[VoIP] VoIP 模块初始化成功')
      } else {
        warn('[VoIP] VoIP 模块不可用')
      }
    } catch (err) {
      error(`[VoIP] 初始化失败: ${err}`)
    }
  }

  private setupCallHandlers(client: MatrixClient): void {
    client.on('Call.incoming', this.incomingCallListener)
    client.on('Call.hangup', this.hangupCallListener)
    client.on('Call.replaced', this.replacedCallListener)
  }

  private detachCallHandlers(client: MatrixClient): void {
    client.off('Call.incoming', this.incomingCallListener)
    client.off('Call.hangup', this.hangupCallListener)
    client.off('Call.replaced', this.replacedCallListener)
  }

  private resetRuntimeState(): void {
    this.calls.clear()
    this.callHandlers.clear()

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop())
      this.screenStream = null
    }
  }

  private handleIncomingCall(call: VoIPCall): void {
    const callId = call.callId
    const roomId = call.roomId

    info(`[VoIP] 收到来电: ${callId}`)

    const callInfo: CallInfo = {
      callId,
      roomId,
      isVideo: call.isVideo || false,
      isGroup: false,
      state: 'ringing',
      participants: []
    }

    this.calls.set(callId, callInfo)
    this.notifyCallUpdate(callId)
  }

  private handleCallHangup(call: VoIPCall): void {
    const callId = call.callId
    info(`[VoIP] 通话结束: ${callId}`)

    const callInfo = this.calls.get(callId)
    if (callInfo) {
      callInfo.state = 'ended'
      this.notifyCallUpdate(callId)
      this.calls.delete(callId)
    }
  }

  private handleCallReplaced(newCall: VoIPCall, oldCall: VoIPCall): void {
    info(`[VoIP] 通话被替换: ${oldCall.callId} -> ${newCall.callId}`)
    this.handleCallHangup(oldCall)
    this.handleIncomingCall(newCall)
  }

  async startCall(roomId: string, options: CallOptions): Promise<string> {
    const client = matrixClientService.getClient() as MatrixClient
    if (!client) {
      throw new Error('[VoIP] 客户端未初始化')
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: options.audio,
        video: options.video
      }

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)

      const call = client.createCall(roomId, undefined, {
        audio: options.audio,
        video: options.video
      })

      if (!call) {
        throw new Error('[VoIP] 无法创建通话')
      }

      const callId = call.callId

      const callInfo: CallInfo = {
        callId,
        roomId,
        isVideo: options.video,
        isGroup: false,
        state: 'connecting',
        localStream: this.localStream,
        participants: []
      }

      this.calls.set(callId, callInfo)
      this.setupCallEventHandlers(call, callId)

      await call.placeCall(this.localStream, options.video)

      info(`[VoIP] 发起通话: ${callId}`)
      return callId
    } catch (err) {
      error(`[VoIP] 发起通话失败: ${err}`)
      throw err
    }
  }

  async answerCall(callId: string, options: CallOptions = { audio: true, video: false }): Promise<void> {
    const client = matrixClientService.getClient() as MatrixClient
    if (!client) {
      throw new Error('[VoIP] 客户端未初始化')
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: options.audio,
        video: options.video
      }

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)

      const call = this.getCallById(callId, client)
      if (!call) {
        throw new Error(`[VoIP] 通话不存在: ${callId}`)
      }

      const callInfo = this.calls.get(callId)
      if (callInfo) {
        callInfo.localStream = this.localStream
        callInfo.state = 'connecting'
        this.notifyCallUpdate(callId)
      }

      await call.answer(this.localStream, options.video)

      info(`[VoIP] 接听通话: ${callId}`)
    } catch (err) {
      error(`[VoIP] 接听通话失败: ${err}`)
      throw err
    }
  }

  async rejectCall(callId: string): Promise<void> {
    const client = matrixClientService.getClient() as MatrixClient
    if (!client) {
      throw new Error('[VoIP] 客户端未初始化')
    }

    try {
      const call = this.getCallById(callId, client)
      if (call) {
        call.hangup('user_busy')
      }

      this.calls.delete(callId)
      info(`[VoIP] 拒绝通话: ${callId}`)
    } catch (err) {
      error(`[VoIP] 拒绝通话失败: ${err}`)
      throw err
    }
  }

  async hangupCall(callId: string): Promise<void> {
    const client = matrixClientService.getClient() as MatrixClient
    if (!client) {
      throw new Error('[VoIP] 客户端未初始化')
    }

    try {
      const call = this.getCallById(callId, client)
      if (call) {
        call.hangup('user_hangup')
      }

      this.cleanupCall(callId)
      info(`[VoIP] 挂断通话: ${callId}`)
    } catch (err) {
      error(`[VoIP] 挂断通话失败: ${err}`)
      throw err
    }
  }

  private getCallById(callId: string, client: MatrixClient): VoIPCall | undefined {
    const calls = (client as unknown as { getCallHandler?: () => VoIPCallHandler }).getCallHandler?.()?.calls || {}
    return calls[callId]
  }

  private setupCallEventHandlers(call: VoIPCall, callId: string): void {
    call.on('feeds_changed', (...args: unknown[]) => {
      const feeds = args[0] as VoIPCallFeed[]
      this.handleFeedsChanged(callId, feeds)
    })

    call.on('hangup', () => {
      this.cleanupCall(callId)
    })

    call.on('error', (...args: unknown[]) => {
      const err = args[0] as Error
      error(`[VoIP] 通话错误: ${err}`)
      const callInfo = this.calls.get(callId)
      if (callInfo) {
        callInfo.state = 'error'
        this.notifyCallUpdate(callId)
      }
    })

    call.on('state', (...args: unknown[]) => {
      const state = args[0] as string
      const callInfo = this.calls.get(callId)
      if (callInfo) {
        if (state === 'connected') {
          callInfo.state = 'connected'
        }
        this.notifyCallUpdate(callId)
      }
    })
  }

  private handleFeedsChanged(callId: string, feeds: VoIPCallFeed[]): void {
    const callInfo = this.calls.get(callId)
    if (!callInfo) return

    const remoteStream = new MediaStream()
    for (const feed of feeds) {
      if (feed.stream) {
        feed.stream.getTracks().forEach((track: MediaStreamTrack) => {
          remoteStream.addTrack(track)
        })
      }
    }

    callInfo.remoteStream = remoteStream
    this.notifyCallUpdate(callId)
  }

  private cleanupCall(callId: string): void {
    const callInfo = this.calls.get(callId)
    if (callInfo) {
      callInfo.state = 'ended'
      this.notifyCallUpdate(callId)
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop())
      this.screenStream = null
    }

    this.calls.delete(callId)
  }

  async toggleMute(callId: string): Promise<boolean> {
    if (!this.localStream) return false

    const audioTrack = this.localStream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      info(`[VoIP] ${audioTrack.enabled ? '取消静音' : '静音'}: ${callId}`)
      return !audioTrack.enabled
    }
    return false
  }

  async toggleVideo(callId: string): Promise<boolean> {
    if (!this.localStream) return false

    const videoTrack = this.localStream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      info(`[VoIP] ${videoTrack.enabled ? '开启视频' : '关闭视频'}: ${callId}`)
      return !videoTrack.enabled
    }
    return false
  }

  async startScreenshare(callId: string): Promise<void> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })

      const client = matrixClientService.getClient() as MatrixClient
      const call = this.getCallById(callId, client)

      if (call && this.screenStream) {
        await call.setScreensharingEnabled(true, { audio: false })
      }

      info(`[VoIP] 开始屏幕共享: ${callId}`)
    } catch (err) {
      error(`[VoIP] 屏幕共享失败: ${err}`)
      throw err
    }
  }

  async stopScreenshare(callId: string): Promise<void> {
    const client = matrixClientService.getClient() as MatrixClient
    const call = this.getCallById(callId, client)

    if (call) {
      await call.setScreensharingEnabled(false)
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop())
      this.screenStream = null
    }

    info(`[VoIP] 停止屏幕共享: ${callId}`)
  }

  getCall(callId: string): CallInfo | undefined {
    return this.calls.get(callId)
  }

  getActiveCalls(): CallInfo[] {
    return Array.from(this.calls.values()).filter((call) => call.state !== 'ended')
  }

  onCallUpdate(callId: string, handler: (call: CallInfo) => void): () => void {
    if (!this.callHandlers.has(callId)) {
      this.callHandlers.set(callId, new Set())
    }
    this.callHandlers.get(callId)!.add(handler)

    return () => {
      this.callHandlers.get(callId)?.delete(handler)
    }
  }

  private notifyCallUpdate(callId: string): void {
    const callInfo = this.calls.get(callId)
    if (!callInfo) return

    const handlers = this.callHandlers.get(callId)
    if (handlers) {
      handlers.forEach((handler) => handler(callInfo))
    }
  }

  async getCallStats(callId: string): Promise<CallStats | null> {
    const client = matrixClientService.getClient() as MatrixClient
    if (!client) return null

    const call = this.getCallById(callId, client)
    if (!call) return null

    try {
      const pc = call.peerConn
      if (!pc) return null

      const stats = await pc.getStats()
      let bytesReceived = 0
      let bytesSent = 0
      let packetsLost = 0
      let jitter = 0
      let roundTripTime = 0

      stats.forEach((report: any) => {
        if (report.type === 'inbound-rtp') {
          bytesReceived += report.bytesReceived || 0
          packetsLost = report.packetsLost || 0
          jitter = report.jitter || 0
        }
        if (report.type === 'outbound-rtp') {
          bytesSent += report.bytesSent || 0
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          roundTripTime = report.currentRoundTripTime || 0
        }
      })

      return {
        bytesReceived,
        bytesSent,
        packetsLost,
        jitter,
        roundTripTime
      }
    } catch {
      return null
    }
  }

  async checkMediaPermissions(): Promise<{ audio: boolean; video: boolean }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const hasAudio = devices.some((d) => d.kind === 'audioinput')
      const hasVideo = devices.some((d) => d.kind === 'videoinput')
      return { audio: hasAudio, video: hasVideo }
    } catch {
      return { audio: false, video: false }
    }
  }

  async getMediaDevices(): Promise<{ audio: MediaDeviceInfo[]; video: MediaDeviceInfo[] }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return {
        audio: devices.filter((d) => d.kind === 'audioinput'),
        video: devices.filter((d) => d.kind === 'videoinput')
      }
    } catch {
      return { audio: [], video: [] }
    }
  }
}

export const matrixVoIPService = new MatrixVoIPService()
export default matrixVoIPService
