import type { MatrixClient } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import {
  checkMediaPermissions as checkMediaPerms,
  checkTurnAvailability as checkTurn,
  checkVoipAvailability as checkVoip,
  getCallById,
  getCallStatsFromPeerConn,
  getMediaDeviceList,
  getTurnServerConfig
} from './voipHelpers'
import type { CallInfo, CallOptions, CallState, VoIPCall, VoIPCallFeed } from './voipTypes'

const logger = createLogger('MatrixVoIP')

/**
 * Matrix VoIP 服务 — 通话管理、媒体控制、设备检测。
 *
 * 实现已拆分为两个子模块：
 * - voipTypes：通话/媒体流/参与者/统计等类型定义
 * - voipHelpers：通话查找、统计提取、设备检测、TURN 配置等纯函数
 *
 * 本文件保留：通话生命周期管理、事件处理、媒体控制、状态订阅。
 */
class MatrixVoIPService extends BaseMatrixService {
  private calls: Map<string, CallInfo> = new Map()
  private callHandlers: Map<string, Set<(call: CallInfo) => void>> = new Map()
  private localStream: MediaStream | null = null
  private screenStream: MediaStream | null = null
  private observedClient: MatrixClient | null = null
  private readonly incomingCallListener = (call: VoIPCall) => this.handleIncomingCall(call)
  private readonly hangupCallListener = (call: VoIPCall) => this.handleCallHangup(call)
  private readonly replacedCallListener = (newCall: VoIPCall, oldCall: VoIPCall) =>
    this.handleCallReplaced(newCall, oldCall)

  // ── 初始化 ──

  async initialize(): Promise<void> {
    let client: MatrixClient
    try {
      client = this.getClient()
    } catch (err) {
      logger.warn('initialize getClient failed:', err)
      return
    }

    try {
      if (this.observedClient && this.observedClient !== client) {
        this.detachCallHandlers(this.observedClient)
        this.resetRuntimeState()
        this.observedClient = null
      }

      if (client.voipHandler) {
        if (this.observedClient === client) return
        this.setupCallHandlers(client)
        this.observedClient = client
        logger.info('[VoIP] VoIP 模块初始化成功')
      } else {
        logger.warn('[VoIP] VoIP 模块不可用')
      }
    } catch (err) {
      logger.error(`[VoIP] 初始化失败: ${err}`)
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
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    this.screenStream?.getTracks().forEach((t) => t.stop())
    this.screenStream = null
  }

  // ── 通话事件处理 ──

  private handleIncomingCall(call: VoIPCall): void {
    logger.info(`[VoIP] 收到来电: ${call.callId}`)
    this.calls.set(call.callId, {
      callId: call.callId,
      roomId: call.roomId,
      isVideo: call.isVideo || false,
      isGroup: false,
      state: 'ringing',
      participants: []
    })
    this.notifyCallUpdate(call.callId)
  }

  private handleCallHangup(call: VoIPCall): void {
    logger.info(`[VoIP] 通话结束: ${call.callId}`)
    const callInfo = this.calls.get(call.callId)
    if (callInfo) {
      callInfo.state = 'ended'
      this.notifyCallUpdate(call.callId)
      this.calls.delete(call.callId)
    }
  }

  private handleCallReplaced(newCall: VoIPCall, oldCall: VoIPCall): void {
    logger.info(`[VoIP] 通话被替换: ${oldCall.callId} -> ${newCall.callId}`)
    this.handleCallHangup(oldCall)
    this.handleIncomingCall(newCall)
  }

  // ── 通话操作 ──

  async startCall(roomId: string, options: CallOptions): Promise<string> {
    const client = this.getClient()
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: options.audio, video: options.video })
      const call = client.createCall(roomId, undefined, { audio: options.audio, video: options.video })
      if (!call) throw new Error(this.t('matrix_error.media.voip_call_creation_failed'))

      const callId = call.callId
      this.calls.set(callId, {
        callId,
        roomId,
        isVideo: options.video,
        isGroup: false,
        state: 'connecting',
        localStream: this.localStream,
        participants: []
      })
      this.setupCallEventHandlers(call, callId)
      await call.placeCall(this.localStream, options.video)
      logger.info(`[VoIP] 发起通话: ${callId}`)
      return callId
    } catch (err) {
      logger.error(`[VoIP] 发起通话失败: ${err}`)
      throw err
    }
  }

  async answerCall(callId: string, options: CallOptions = { audio: true, video: false }): Promise<void> {
    const client = this.getClient()
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: options.audio, video: options.video })
      const call = getCallById(callId, client)
      if (!call) throw new Error(this.t('matrix_error.media.voip_call_not_found', { callId }))

      const callInfo = this.calls.get(callId)
      if (callInfo) {
        callInfo.localStream = this.localStream
        callInfo.state = 'connecting'
        this.notifyCallUpdate(callId)
      }
      await call.answer(this.localStream, options.video)
      logger.info(`[VoIP] 接听通话: ${callId}`)
    } catch (err) {
      logger.error(`[VoIP] 接听通话失败: ${err}`)
      throw err
    }
  }

  async rejectCall(callId: string): Promise<void> {
    try {
      const call = getCallById(callId, this.getClient())
      call?.hangup('user_busy')
      this.calls.delete(callId)
      logger.info(`[VoIP] 拒绝通话: ${callId}`)
    } catch (err) {
      logger.error(`[VoIP] 拒绝通话失败: ${err}`)
      throw err
    }
  }

  async hangupCall(callId: string): Promise<void> {
    try {
      const call = getCallById(callId, this.getClient())
      call?.hangup('user_hangup')
      this.cleanupCall(callId)
      logger.info(`[VoIP] 挂断通话: ${callId}`)
    } catch (err) {
      logger.error(`[VoIP] 挂断通话失败: ${err}`)
      throw err
    }
  }

  // ── 通话事件绑定 ──

  private setupCallEventHandlers(call: VoIPCall, callId: string): void {
    call.on('feeds_changed', (...args: unknown[]) => {
      this.handleFeedsChanged(callId, args[0] as VoIPCallFeed[])
    })
    call.on('hangup', () => this.cleanupCall(callId))
    call.on('error', (...args: unknown[]) => {
      logger.error(`[VoIP] 通话错误: ${args[0] as Error}`)
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
        if (state === 'connected') callInfo.state = 'connected'
        this.notifyCallUpdate(callId)
      }
    })
  }

  private handleFeedsChanged(callId: string, feeds: VoIPCallFeed[]): void {
    const callInfo = this.calls.get(callId)
    if (!callInfo) return

    const remoteStream = new MediaStream()
    for (const feed of feeds) {
      feed.stream?.getTracks().forEach((track: MediaStreamTrack) => remoteStream.addTrack(track))
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
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    this.screenStream?.getTracks().forEach((t) => t.stop())
    this.screenStream = null
    this.calls.delete(callId)
  }

  // ── 媒体控制 ──

  async toggleMute(callId: string): Promise<boolean> {
    if (!this.localStream) return false
    const audioTrack = this.localStream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      logger.info(`[VoIP] ${audioTrack.enabled ? '取消静音' : '静音'}: ${callId}`)
      return !audioTrack.enabled
    }
    return false
  }

  async toggleVideo(callId: string): Promise<boolean> {
    if (!this.localStream) return false
    const videoTrack = this.localStream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      logger.info(`[VoIP] ${videoTrack.enabled ? '开启视频' : '关闭视频'}: ${callId}`)
      return !videoTrack.enabled
    }
    return false
  }

  async startScreenshare(callId: string): Promise<void> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      const call = getCallById(callId, this.getClient())
      if (call && this.screenStream) {
        await call.setScreensharingEnabled(true, { audio: false })
      }
      logger.info(`[VoIP] 开始屏幕共享: ${callId}`)
    } catch (err) {
      logger.error(`[VoIP] 屏幕共享失败: ${err}`)
      throw err
    }
  }

  async stopScreenshare(callId: string): Promise<void> {
    const call = getCallById(callId, this.getClient())
    if (call) await call.setScreensharingEnabled(false)
    this.screenStream?.getTracks().forEach((t) => t.stop())
    this.screenStream = null
    logger.info(`[VoIP] 停止屏幕共享: ${callId}`)
  }

  // ── 通话信息 & 订阅 ──

  getCall(callId: string): CallInfo | undefined {
    return this.calls.get(callId)
  }

  getActiveCalls(): CallInfo[] {
    return Array.from(this.calls.values()).filter((call) => call.state !== 'ended')
  }

  onCallUpdate(callId: string, handler: (call: CallInfo) => void): () => void {
    if (!this.callHandlers.has(callId)) this.callHandlers.set(callId, new Set())
    this.callHandlers.get(callId)!.add(handler)
    return () => this.callHandlers.get(callId)?.delete(handler)
  }

  private notifyCallUpdate(callId: string): void {
    const callInfo = this.calls.get(callId)
    if (!callInfo) return
    this.callHandlers.get(callId)?.forEach((handler) => handler(callInfo))
  }

  // ── 统计 & 设备 & TURN（委托 voipHelpers）──

  async getCallStats(callId: string) {
    let client: MatrixClient
    try {
      client = this.getClient()
    } catch (err) {
      logger.warn('getCallStats getClient failed:', err)
      return null
    }
    const call = getCallById(callId, client)
    return call ? getCallStatsFromPeerConn(call) : null
  }

  async checkMediaPermissions() {
    return checkMediaPerms()
  }

  async getMediaDevices() {
    return getMediaDeviceList()
  }

  async getTurnServer() {
    return getTurnServerConfig(this.getClient())
  }

  async checkTurnAvailability() {
    let client: MatrixClient
    try {
      client = this.getClient()
    } catch (err) {
      logger.warn('checkTurnAvailability getClient failed:', err)
      return { available: false, reason: '客户端未初始化' }
    }
    return checkTurn(client)
  }

  async checkVoipAvailability() {
    let client: MatrixClient
    try {
      client = this.getClient()
    } catch (err) {
      logger.warn('checkVoipAvailability getClient failed:', err)
      return { voipAvailable: false, turnAvailable: false, message: '客户端未初始化' }
    }
    return checkVoip(client)
  }
}

export type { CallInfo, CallOptions, CallState }
export const matrixVoIPService = new MatrixVoIPService()
