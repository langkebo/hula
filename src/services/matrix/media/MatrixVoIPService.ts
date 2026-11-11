import type { MatrixClient } from '@/services/matrix/sdk'
import {
  loadMediaDevicePreferences,
  type MediaDevicePreferences,
  toAudioQualityConstraints
} from '@/services/media/mediaDevicePreferences'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import * as voipDiag from './voipDiagnostics'
import { getCallById } from './voipHelpers'
import type { CallInfo, CallOptions, VoIPCall, VoIPCallFeed } from './voipTypes'

const logger = createLogger('MatrixVoIP')

/** Matrix VoIP 服务 — 通话生命周期、事件处理、媒体控制、状态订阅。类型见 voipTypes，纯函数见 voipHelpers/voipDiagnostics。 */
class MatrixVoIPService extends BaseMatrixService {
  private calls: Map<string, CallInfo> = new Map()
  private callHandlers: Map<string, Set<(call: CallInfo) => void>> = new Map()
  private incomingCallCallback: ((callInfo: CallInfo) => void) | null = null
  private screenStream: MediaStream | null = null
  // v40：本地/远端媒体流由 SDK 在 placeCall/answer 之后通过 feeds_changed 事件下发，
  // 服务层不再自行 getUserMedia 持有流，避免与 SDK 内部采集重复竞争摄像头/麦克风。
  private callMediaState: Map<string, { audioMuted: boolean; videoMuted: boolean }> = new Map()
  // 音质偏好：每次通话只读一次（feeds_changed 会反复触发），每条轨道只施加一次。
  private appliedAudioQualityTracks = new WeakSet<MediaStreamTrack>()
  private callAudioQualityPreferences: Map<string, MediaDevicePreferences> = new Map()
  private observedClient: MatrixClient | null = null
  private readonly incomingCallListener = (call: VoIPCall) => this.handleIncomingCall(call)
  private readonly hangupCallListener = (call: VoIPCall) => this.handleCallHangup(call)
  private readonly replacedCallListener = (newCall: VoIPCall, oldCall: VoIPCall) =>
    this.handleCallReplaced(newCall, oldCall)

  /** 注册来电回调：收到 Call.incoming 时通知 UI 层创建来电窗口 */
  setIncomingCallCallback(callback: (callInfo: CallInfo) => void): void {
    this.incomingCallCallback = callback
  }

  // ── 初始化 ──

  /** 绑定客户端的通话事件；客户端变更时先解绑旧客户端并重置运行时状态。 */
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

      if ((client as { callEventHandler?: unknown }).callEventHandler) {
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
    this.callMediaState.clear()
    this.callAudioQualityPreferences.clear()
    // screenStream 是服务层通过 getDisplayMedia 持有的共享屏幕流，需自行释放。
    this.screenStream?.getTracks().forEach((t) => t.stop())
    this.screenStream = null
  }

  // ── 通话事件处理 ──

  private handleIncomingCall(call: VoIPCall): void {
    logger.info(`[VoIP] 收到来电: ${call.callId}`)
    // SDK MatrixCall 有 getOpponentMember() 方法，提取来电者信息
    const sdkCall = call as VoIPCall & { getOpponentMember?: () => { userId?: string; name?: string } | undefined }
    const opponentMember = sdkCall.getOpponentMember?.()
    const callerUserId = opponentMember?.userId ?? ''

    const callInfo: CallInfo = {
      callId: call.callId,
      roomId: call.roomId,
      isVideo: call.isVideo || false,
      isGroup: false,
      state: 'ringing',
      participants: callerUserId
        ? [
            {
              userId: callerUserId,
              displayName: opponentMember?.name,
              isMuted: false,
              isVideoMuted: false,
              isSpeaking: false
            }
          ]
        : []
    }
    this.calls.set(call.callId, callInfo)
    // 来电与去电走同一套每通话事件（state/feeds_changed/hangup/error），
    // 否则接听后 feeds 与 connected 状态都不会下发。
    this.setupCallEventHandlers(call, call.callId)
    this.notifyCallUpdate(call.callId)
    // 通知 UI 层创建来电窗口
    this.incomingCallCallback?.(callInfo)
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

  /**
   * 向指定房间发起通话；`placeCall(audio, video)` 由 SDK 内部采集本地媒体，切勿传入 MediaStream。
   * 成功返回新建通话的 callId。
   */
  async startCall(roomId: string, options: CallOptions): Promise<string> {
    const client = this.getClient()
    try {
      const call = client.createCall(roomId, undefined, { audio: options.audio, video: options.video })
      if (!call) throw new Error(this.t('matrix_error.media.voip_call_creation_failed'))

      const callId = call.callId
      this.calls.set(callId, {
        callId,
        roomId,
        isVideo: options.video,
        isGroup: false,
        state: 'connecting',
        participants: []
      })
      this.callMediaState.set(callId, { audioMuted: false, videoMuted: false })
      this.setupCallEventHandlers(call, callId)
      // v40：placeCall(audio, video) 内部按布尔自行 getUserMedia 采集本地媒体并发起邀请；
      // 切勿传入 MediaStream（旧 API 写法），否则 SDK 会把流对象当作 audio 布尔使用。
      await call.placeCall(options.audio, options.video)
      logger.info(`[VoIP] 发起通话: ${callId}`)
      return callId
    } catch (err) {
      logger.error(`[VoIP] 发起通话失败: ${err}`)
      throw err
    }
  }

  /**
   * 接听来电；`answer(audio, video)` 由 SDK 内部采集本地媒体，通话不存在时抛出异常。
   */
  async answerCall(callId: string, options: CallOptions = { audio: true, video: false }): Promise<void> {
    const client = this.getClient()
    try {
      const call = getCallById(callId, client)
      if (!call) throw new Error(this.t('matrix_error.media.voip_call_not_found', { callId }))

      const callInfo = this.calls.get(callId)
      if (callInfo) {
        callInfo.state = 'connecting'
        this.notifyCallUpdate(callId)
      }
      this.callMediaState.set(callId, { audioMuted: false, videoMuted: false })
      // v40：answer(audio, video) 内部自行采集本地媒体；勿传 MediaStream。
      await call.answer(options.audio, options.video)
      logger.info(`[VoIP] 接听通话: ${callId}`)
    } catch (err) {
      logger.error(`[VoIP] 接听通话失败: ${err}`)
      throw err
    }
  }

  /**
   * 拒接来电（以 `user_busy` 原因挂断并移除本地通话记录）。
   */
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

  /**
   * 主动挂断通话（以 `user_hangup` 原因）并清理本地运行时状态。
   */
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

    // v40：feeds 同时包含本地与远端；按 isLocal() 区分，分别组装本地预览流与远端流。
    const localStream = new MediaStream()
    const remoteStream = new MediaStream()
    for (const feed of feeds) {
      const isLocal = typeof feed.isLocal === 'function' ? feed.isLocal() : Boolean(feed.isLocal)
      const target = isLocal ? localStream : remoteStream
      feed.stream?.getTracks().forEach((track: MediaStreamTrack) => target.addTrack(track))
    }
    if (localStream.getTracks().length > 0) callInfo.localStream = localStream
    if (remoteStream.getTracks().length > 0) callInfo.remoteStream = remoteStream
    this.applyLocalAudioQualityPreferences(callId, localStream)
    this.notifyCallUpdate(callId)
  }

  /**
   * 把用户保存的音质偏好施加到 SDK 采集的本地音轨上（本地音轨唯一可达的接缝：
   * 服务层不自己 `getUserMedia`，避免与 SDK 竞争设备）。
   *
   * 幂等：偏好每次通话只读一次并缓存，每条轨道只施加一次（`WeakSet`）。只对
   * `kind === 'audio'` 施加（音频约束喂给视频轨道会 reject）；逐轨道 try/catch。
   */
  private applyLocalAudioQualityPreferences(callId: string, localStream: MediaStream): void {
    const audioTracks = localStream.getTracks().filter((track) => track.kind === 'audio')
    if (audioTracks.length === 0) return

    let preferences = this.callAudioQualityPreferences.get(callId)
    if (!preferences) {
      preferences = loadMediaDevicePreferences()
      this.callAudioQualityPreferences.set(callId, preferences)
    }
    // 只传三个布尔：deviceId 不可变、volume 不是合法约束，混进来会让整次调用 reject。
    const quality = toAudioQualityConstraints(preferences)

    for (const track of audioTracks) {
      if (this.appliedAudioQualityTracks.has(track)) continue
      this.appliedAudioQualityTracks.add(track)
      try {
        void track.applyConstraints(quality).catch((error: unknown) => {
          logger.warn(`[VoIP] 应用音频约束失败: ${String(error)}`)
        })
      } catch (error) {
        logger.warn(`[VoIP] 应用音频约束失败: ${String(error)}`)
      }
    }
  }

  private cleanupCall(callId: string): void {
    const callInfo = this.calls.get(callId)
    if (callInfo) {
      callInfo.state = 'ended'
      this.notifyCallUpdate(callId)
    }
    // 本地/远端 MediaStream 由 SDK 拥有，挂断时 SDK 自行释放，这里不应 stop 其轨道。
    this.callMediaState.delete(callId)
    this.callAudioQualityPreferences.delete(callId)
    this.calls.delete(callId)
  }

  // ── 媒体控制 ──

  /**
   * 切换麦克风静音（经 SDK `setMicrophoneMuted` 作用于真实发送轨道）；通话不存在返回 false。
   */
  async toggleMute(callId: string): Promise<boolean> {
    const call = getCallById(callId, this.getClient())
    if (!call) return false
    const state = this.callMediaState.get(callId) ?? { audioMuted: false, videoMuted: false }
    const next = !state.audioMuted
    // v40：静音通过 SDK 的 setMicrophoneMuted 作用在真实发送轨道上，而非本地预览轨道。
    await call.setMicrophoneMuted(next)
    state.audioMuted = next
    this.callMediaState.set(callId, state)
    logger.info(`[VoIP] ${next ? '静音' : '取消静音'}: ${callId}`)
    return next
  }

  /**
   * 切换本地视频（经 SDK `setLocalVideoMuted` 作用于真实发送轨道）；通话不存在返回 false。
   */
  async toggleVideo(callId: string): Promise<boolean> {
    const call = getCallById(callId, this.getClient())
    if (!call) return false
    const state = this.callMediaState.get(callId) ?? { audioMuted: false, videoMuted: false }
    const next = !state.videoMuted
    // v40：通过 SDK 的 setLocalVideoMuted 作用在真实发送轨道上。
    await call.setLocalVideoMuted(next)
    state.videoMuted = next
    this.callMediaState.set(callId, state)
    logger.info(`[VoIP] ${next ? '开启视频' : '关闭视频'}: ${callId}`)
    return next
  }

  /**
   * 开始屏幕共享：屏幕流由本服务通过 `getDisplayMedia` 持有（需自行释放），随后经 SDK 开启共享。
   */
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

  /** 停止屏幕共享并释放本服务持有的屏幕流轨道。 */
  async stopScreenshare(callId: string): Promise<void> {
    const call = getCallById(callId, this.getClient())
    if (call) await call.setScreensharingEnabled(false)
    this.screenStream?.getTracks().forEach((t) => t.stop())
    this.screenStream = null
    logger.info(`[VoIP] 停止屏幕共享: ${callId}`)
  }

  // ── 通话信息 & 订阅 ──

  /** 获取本地缓存的通话信息，不存在时返回 undefined。 */
  getCall(callId: string): CallInfo | undefined {
    return this.calls.get(callId)
  }

  /**
   * 获取所有未结束的通话列表。
   */
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

  // ── 统计 & 设备 & TURN（实现在 voipDiagnostics）──

  /** 获取通话的 WebRTC 统计；客户端未初始化或通话不存在时返回 null。 */
  async getCallStats(callId: string) {
    return voipDiag.fetchCallStats(() => this.getClient(), callId)
  }

  /** 检测摄像头 / 麦克风权限状态。 */
  async checkMediaPermissions() {
    return voipDiag.checkMediaPermissions()
  }

  /** 枚举可用的音视频输入设备。 */
  async getMediaDevices() {
    return voipDiag.listMediaDevices()
  }

  /** 获取当前可用的 TURN 服务器配置。 */
  async getTurnServer() {
    return voipDiag.fetchTurnServer(() => this.getClient())
  }

  /** 检测 TURN 服务是否可用；客户端未初始化时返回 `{ available: false }`。 */
  async checkTurnAvailability() {
    return voipDiag.checkTurnAvailability(() => this.getClient())
  }

  /** 检测 VoIP 与 TURN 的整体可用性；客户端未初始化时返回全 false 的降级结果。 */
  async checkVoipAvailability() {
    return voipDiag.checkVoipAvailability(() => this.getClient())
  }
}

export type { CallInfo, CallOptions }
export const matrixVoIPService = new MatrixVoIPService()
