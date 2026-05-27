import { listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { error, info } from '@tauri-apps/plugin-log'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { CallTypeEnum, RTCCallStatus } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'
import { TimerManager } from '@/utils/TimerManager'
import { isMobile } from '../utils/PlatformConstants'
import { useMitt } from './useMitt'
import { useTauriListener } from './useTauriListener'
import { getIceConfiguration, loadIceServers } from './webRtc/iceServers'
import { type RtcMsgVO, SignalTypeEnum, type WSRtcCallMsg } from './webRtc/types'
import { useCallBell } from './webRtc/useCallBell'
import { useCallTimer } from './webRtc/useCallTimer'
import { useCameraSwitch } from './webRtc/useCameraSwitch'
import { useMediaDevices } from './webRtc/useMediaDevices'
import { useScreenShare } from './webRtc/useScreenShare'

export { SignalTypeEnum, type WSRtcCallMsg } from './webRtc/types'

const logger = createLogger('WebRtc')

const sendMatrixVoipSignal = async (type: string, data: Record<string, unknown>) => {
  info(`[useWebRtc] Matrix VoIP Signal: ${type}`, data)
}

// const TURN_SERVER = import.meta.env.VITE_TURN_SERVER_URL
const MAX_TIME_OUT_SECONDS = 30

// ICE 服务器通过 loadIceServers() 动态加载，支持从服务器配置获取
const rtcCallBellUrl = '/sound/hula_bell.mp3'

/**
 * webrtc 相关
 * @returns rtc 相关的状态和方法
 */
export const useWebRtc = (roomId: string, remoteUserId: string, callType: CallTypeEnum, isReceiver: boolean) => {
  const { addListener } = useTauriListener()

  const router = useRouter()
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()

  info(`useWebRtc, roomId: ${roomId}, remoteUserId: ${remoteUserId}, callType: ${callType}, isReceiver: ${isReceiver}`)
  const rtcMsg = ref<Partial<RtcMsgVO>>({
    roomId: undefined,
    callType: undefined,
    callerId: undefined
  })
  const userStore = useUserStore()

  // 媒体设备（抽离到 useMediaDevices）
  const { audioDevices, videoDevices, selectedAudioDevice, selectedVideoDevice, getDevices, resetDevices } =
    useMediaDevices()

  // 状态
  const connectionStatus = ref<RTCCallStatus | undefined>(undefined)
  const isLinker = ref(false) // 判断是否是 webrtc 连接的参与者

  // rtc状态
  const rtcStatus = ref<RTCPeerConnectionState | undefined>(undefined)
  // const isRtcConnecting = computed(() => rtcStatus.value === 'connecting')
  // 流相关状态
  const localStream = ref<MediaStream | null>(null)
  const remoteStream = ref<MediaStream | null>(null)
  // WebRTC 连接对象
  const peerConnection = ref<RTCPeerConnection | null>(null)
  const channel = ref<RTCDataChannel | null>(null)
  const channelStatus = ref<RTCDataChannelState | undefined>(undefined)
  // 待发送ice列表
  const pendingCandidates = ref<RTCIceCandidate[]>([])
  // 铃声（抽离到 useCallBell）
  const { startBell, stopBell, pauseBell, playBell } = useCallBell(rtcCallBellUrl)

  // TimerManager 实例
  const timerManager = new TimerManager()

  // 添加计时器引用
  const callTimer = ref<number | null>(null)

  // 通话时长计时（抽离到 useCallTimer）
  const { callDuration, startCallTimer, stopCallTimer } = useCallTimer()

  // 添加桌面共享相关状态
  const offer = ref<RTCSessionDescriptionInit>()

  // 接通后确保窗口聚焦显示
  const focusCurrentWindow = async () => {
    try {
      const currentWindow = getCurrentWebviewWindow()
      const visible = await currentWindow.isVisible()
      if (!visible) {
        await currentWindow.show()
      }
      const minimized = await currentWindow.isMinimized()
      if (minimized) {
        await currentWindow.unminimize()
      }
      await currentWindow.setFocus()
    } catch (e) {
      logger.warn('设置窗口聚焦失败:', e)
    }
  }

  /**
   * 发送通话请求
   */
  const sendCall = async () => {
    try {
      await sendMatrixVoipSignal('VIDEO_CALL_REQUEST', {
        roomId: roomId,
        targetUid: remoteUserId,
        isVideo: callType === CallTypeEnum.VIDEO
      })
    } catch (error) {
      logger.error('发送通话请求失败:', error)
    }
  }

  /**
   * 接听电话响应事件
   */
  const handleCallResponse = async (status: number) => {
    try {
      info('[收到通知] 接听电话响应事件')
      // 发送挂断消息
      sendRtcCall2VideoCallResponse(status)
      await endCall()
    } finally {
      clear()
    }
  }

  /**
   * 结束通话
   */
  const endCall = async () => {
    try {
      info('[收到通知] 结束通话')
      // 移动端router 回退
      if (!isMobile()) {
        await getCurrentWebviewWindow().close()
      } else {
        router.back()
      }
    } finally {
      clear()
    }
  }

  // 发送 ws 请求，通知双方通话状态
  // -1 = 超时 0 = 拒绝 1 = 接通 2 = 挂断
  const sendRtcCall2VideoCallResponse = async (status: number) => {
    try {
      info(`发送 ws 请求，通知双方通话状态 ${status}`)
      await sendMatrixVoipSignal('VIDEO_CALL_RESPONSE', {
        callerUid: remoteUserId,
        roomId: roomId,
        accepted: status
      })
    } catch (error) {
      logger.error('发送通话响应失败:', error)
    }
  }

  // 获取本地媒体流
  const getLocalStream = async (type: CallTypeEnum) => {
    try {
      info('获取本地媒体流')
      const constraints = {
        audio: audioDevices.value.length > 0 ? { deviceId: selectedAudioDevice.value || undefined } : false,
        video:
          type === CallTypeEnum.VIDEO && videoDevices.value.length > 0
            ? { deviceId: selectedVideoDevice.value || undefined }
            : false
      }
      if (!constraints.audio && !constraints.video) {
        showFeedback(t('hooks.webrtc.no_device'), 'error')
        // 没有可用设备时自动挂断并关闭窗口
        timerManager.setTimeout(async () => {
          if (isReceiver) {
            // 接听方：发送拒绝响应
            await handleCallResponse(0)
          } else {
            // 发起方：直接结束通话
            await handleCallResponse(2)
          }
        }, 1000)
        return false
      }
      localStream.value = await navigator.mediaDevices.getUserMedia(constraints)
      // 打印 localStream 的信息（不能直接序列号 stream，不然会返回null）
      info(`get localStream success`)
      info(`localStream.id: ${localStream.value?.id}`)
      info(`localStream.active: ${localStream.value?.active}`)
      info(`localStream.getTracks().length: ${localStream.value?.getTracks()?.length}`)
      // 打印每个轨道的信息
      localStream.value?.getTracks()?.forEach((track, index) => {
        info(`Track ${index}: kind=${track.kind}, label=${track.label}, enabled=${track.enabled}`)
      })

      const audioTrack = localStream.value.getAudioTracks()[0]
      if (audioTrack) {
        // 检查音频轨道是否真的在工作
        info(`Audio track enabled: ${audioTrack.enabled}`)
        info(`Audio track muted: ${audioTrack.muted}`)
        info(`Audio track readyState: ${audioTrack.readyState}`)

        // 强制启用音频轨道
        audioTrack.enabled = true
      }

      return true
    } catch (err) {
      logger.error('获取本地流失败:', err)
      showFeedback(t('hooks.webrtc.get_stream_failed'), 'error')
      error(`获取本地媒体流失败，请检查设备! ${err}`)
      await sendRtcCall2VideoCallResponse(2)
      return false
    }
  }

  // 创建 RTCPeerConnection
  const createPeerConnection = (roomId: string) => {
    try {
      const pc = new RTCPeerConnection(getIceConfiguration())

      // 监听远程流
      pc.ontrack = (event) => {
        info('pc 监听到 ontrack 事件')
        if (event.streams[0]) {
          logger.debug('收到远程流:', event.streams[0])
          remoteStream.value = event.streams[0]
        } else {
          remoteStream.value = null
        }
      }

      // 添加本地流
      info('添加本地流到 PC')
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => {
          localStream.value && pc.addTrack(track, localStream.value)
        })
      } else {
        logger.warn('localStream 为 null，无法添加本地流到 PeerConnection')
      }

      // 连接状态变化 "closed" | "connected" | "connecting" | "disconnected" | "failed" | "new";
      pc.onconnectionstatechange = (e) => {
        info(`RTC 连接状态变化: ${pc.connectionState}`)
        switch (pc.connectionState) {
          case 'new':
            info('RTC 连接新建')
            break
          case 'connecting':
            info('RTC 连接中')
            connectionStatus.value = RTCCallStatus.CALLING
            break
          case 'connected':
            info('RTC 连接成功')
            connectionStatus.value = RTCCallStatus.ACCEPT
            startCallTimer() // 开始计时
            // 接通后将窗口置顶展示并聚焦
            void focusCurrentWindow()
            break
          case 'disconnected':
            info('RTC 连接断开')
            connectionStatus.value = RTCCallStatus.END
            showFeedback(t('hooks.webrtc.rtc_connection_failed'), 'error')
            timerManager.setTimeout(async () => {
              await endCall()
            }, 500)
            break
          case 'closed':
            info('RTC 连接关闭')
            connectionStatus.value = RTCCallStatus.END
            timerManager.setTimeout(async () => {
              await endCall()
            }, 500)
            break
          case 'failed':
            connectionStatus.value = RTCCallStatus.ERROR
            info('RTC 连接失败')
            showFeedback(t('hooks.webrtc.rtc_connection_failed'), 'error')
            timerManager.setTimeout(async () => {
              await endCall()
            }, 500)
            break
          default:
            info('RTC 连接状态变化: ', pc.connectionState)
            break
        }
        rtcStatus.value = (e?.currentTarget as RTCPeerConnection | null)?.connectionState || pc.connectionState
      }
      // 创建信道
      channel.value = pc.createDataChannel('chat')
      channel.value.onopen = () => {
        // console.log("信道已打开");
      }
      channel.value.onmessage = (_event) => {
        // console.log("收到消息:", event.data);
      }
      channel.value.onerror = (event) => {
        logger.warn('信道出错:', event)
      }
      channel.value.onclose = () => {
        // console.log("信道已关闭");
      }
      pc.onicecandidate = async (event) => {
        info('pc 监听到 onicecandidate 事件')
        if (event.candidate && roomId) {
          try {
            pendingCandidates.value.push(event.candidate)
          } catch (err) {
            logger.error('发送ICE候选者出错:', err)
          }
        }
      }
      peerConnection.value = pc
    } catch (err) {
      logger.error('创建 PeerConnection 失败:', err)
      connectionStatus.value = RTCCallStatus.ERROR
      throw err
    }
  }

  // 发起通话
  const startCall = async (roomId: string, type: CallTypeEnum, uidList?: string[]) => {
    try {
      if (!roomId) {
        return false
      }
      clear() // 清理资源
      if (!(await getDevices())) {
        showFeedback(t('hooks.webrtc.get_devices_failed'), 'error')
        // 获取设备失败时自动关闭窗口
        timerManager.setTimeout(async () => {
          await handleCallResponse(0)
        }, 1000)
        return
      }
      // 保存通话信息
      rtcMsg.value = {
        roomId,
        callType: type,
        callerId: userStore.userInfo?.uid ?? '',
        uidList: uidList || []
      }
      isLinker.value = true // 标记是会话人
      // 设置30秒超时定时器
      callTimer.value = timerManager.setTimeout(() => {
        if (connectionStatus.value === RTCCallStatus.CALLING) {
          showFeedback(t('hooks.webrtc.call_timeout'), 'warning')
          endCall()
        }
      }, MAX_TIME_OUT_SECONDS * 1000)

      if (!(await getLocalStream(type))) {
        clear()
        // 获取本地媒体流失败时自动关闭窗口
        timerManager.setTimeout(async () => {
          await endCall()
        }, 1000)
        return false
      }

      // 1. 创建 RTCPeerConnection
      createPeerConnection(roomId)
      // 创建并发送 offer
      const rtcOffer = await peerConnection.value!.createOffer()
      offer.value = rtcOffer
      await peerConnection.value!.setLocalDescription(rtcOffer)
      // 发起通话请求
      await sendCall()
      // 播放铃声
      startBell()

      // 开始通话
      connectionStatus.value = RTCCallStatus.CALLING
      rtcStatus.value = 'new'
    } catch (err) {
      logger.error('开始通话失败:', err)
      showFeedback(t('hooks.webrtc.rtc_connection_failed'), 'error')
      clear()
      return false
    }
  }

  // 发送SDP offer
  const sendOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      const signalData = {
        callerUid: userStore.userInfo?.uid ?? '',
        roomId: roomId,
        signal: JSON.stringify(offer),
        signalType: 'offer',
        targetUid: remoteUserId,
        video: callType === CallTypeEnum.VIDEO
      }

      info('ws发送 offer')
      await sendMatrixVoipSignal('WEBRTC_SIGNAL', signalData)
    } catch (error) {
      logger.error('Failed to send SDP offer:', error)
    }
  }

  const clear = () => {
    try {
      // 停止铃声并重置
      stopBell()
      // 清除所有定时器
      timerManager.clearAll()
      callTimer.value = null
      // 停止计时器
      stopCallTimer()
      // 关闭信道
      channel.value?.close?.()
      // 关闭连接
      peerConnection.value?.close?.()
      // 关闭媒体流
      localStream.value?.getTracks().forEach((track) => track.stop())
      remoteStream.value?.getTracks().forEach((track) => track.stop())
    } catch (error) {
      showFeedback(t('hooks.webrtc.cleanup_failed'), 'error')
      logger.error('清理资源失败:', error)
    } finally {
      // 重置状态
      rtcMsg.value = {
        roomId: undefined,
        callType: undefined,
        senderId: undefined
      }
      pendingCandidates.value = []
      resetDevices()
      localStream.value = null
      remoteStream.value = null
      connectionStatus.value = undefined
      rtcStatus.value = undefined
      isScreenSharing.value = false
      isLinker.value = false
      // 关闭连接
      peerConnection.value = null
      channel.value = null
      channelStatus.value = undefined
    }
  }

  // 发送ICE候选者
  const sendIceCandidate = async (candidate: RTCIceCandidate) => {
    try {
      info('发送ICE候选者')
      const signalData = {
        roomId: roomId,
        signal: JSON.stringify(candidate),
        signalType: 'candidate',
        targetUid: remoteUserId,
        mediaType: callType === CallTypeEnum.VIDEO ? 'VideoSignal' : 'AudioSignal'
      }

      await sendMatrixVoipSignal('WEBRTC_SIGNAL', signalData)
    } catch (error) {
      logger.error('Failed to send ICE candidate:', error)
    }
  }

  // 处理收到的 offer - 接听者
  const handleOffer = async (signal: RTCSessionDescriptionInit, video: boolean, roomId: string) => {
    try {
      logger.debug('处理 offer')
      connectionStatus.value = RTCCallStatus.CALLING
      await nextTick()

      await getDevices()
      const hasLocalStream = await getLocalStream(video ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO)

      // 停止铃声
      stopBell()

      // 检查本地媒体流是否获取成功
      if (!hasLocalStream || !localStream.value) {
        // 睡眠 3s
        await new Promise<void>((resolve) => {
          timerManager.setTimeout(() => resolve(), 3000)
        })
        await handleCallResponse(0)
        return false
      }

      // 2. 创建 RTCPeerConnection
      await nextTick() // 等待一帧
      createPeerConnection(roomId)
      rtcStatus.value = 'new'

      // 3. 设置远程描述
      info('设置远程描述')
      await peerConnection.value!.setRemoteDescription(signal)

      // 4. 创建并发送 answer
      const answer = await peerConnection.value!.createAnswer()
      await peerConnection.value!.setLocalDescription(answer)

      if (!roomId) {
        showFeedback(t('hooks.webrtc.room_not_found'), 'error')
        return false
      }

      isLinker.value = true // 标记是会话人
      // 6. 发送 answer 信令到远端
      await sendAnswer(answer)
      connectionStatus.value = RTCCallStatus.ACCEPT
      info('处理 offer 结束')
    } catch (e) {
      error(`处理 offer 失败: ${e}`)
      await endCall()
    }
  }

  // 发送SDP answer
  const sendAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      const signalData = {
        callerUid: userStore.userInfo?.uid ?? '',
        roomId: roomId,
        signal: JSON.stringify(answer),
        signalType: SignalTypeEnum.ANSWER,
        targetUid: remoteUserId,
        video: callType === CallTypeEnum.VIDEO
      }

      logger.debug('发送SDP answer', signalData)
      await sendMatrixVoipSignal('WEBRTC_SIGNAL', signalData)

      logger.debug('SDP answer sent via WebSocket:', answer)
    } catch (error) {
      logger.error('Failed to send SDP answer:', error)
    }
  }

  const handleAnswer = async (answer: RTCSessionDescriptionInit, roomId: string) => {
    try {
      info('处理 answer 消息')
      if (peerConnection.value) {
        // 清除超时定时器
        if (callTimer.value !== null) {
          timerManager.clearTimeout(callTimer.value)
          callTimer.value = null
        }

        // 2. 停止铃声
        stopBell()

        // 3. 通知服务器通话已建立
        if (!isReceiver) {
          if (!roomId) {
            showFeedback(t('hooks.webrtc.room_not_found'), 'error')
            await endCall()
            return
          }
          // 4. 发起者 - 设置远程描述
          logger.debug('发起者 - 设置远程描述', answer)
          await peerConnection.value.setRemoteDescription(answer)
        }
      }
    } catch (error) {
      logger.error('处理 answer 失败:', error)
      connectionStatus.value = RTCCallStatus.ERROR
      await endCall()
    }
  }

  // 处理 ICE candidate
  const handleCandidate = async (signal: RTCIceCandidateInit) => {
    try {
      if (peerConnection.value?.remoteDescription) {
        info('添加 candidate')
        await peerConnection.value!.addIceCandidate(signal)
      }
    } catch (error) {
      logger.error('处理 candidate 失败:', error)
    }
  }

  // 视频轨道状态
  const isVideoEnabled = ref(callType === CallTypeEnum.VIDEO)

  // 切换静音
  const toggleMute = () => {
    if (localStream.value) {
      const audioTrack = localStream.value.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
      }
    }
  }

  // 切换视频
  const toggleVideo = async () => {
    if (localStream.value) {
      const videoTrack = localStream.value.getVideoTracks()[0]
      if (videoTrack) {
        // 切换视频轨道的启用状态
        videoTrack.enabled = !videoTrack.enabled
        isVideoEnabled.value = videoTrack.enabled

        logger.debug(`视频轨道${videoTrack.enabled ? '开启' : '关闭'}`)

        // 如果是关闭视频，通知对方
        if (!videoTrack.enabled) {
          logger.debug('本地视频已关闭，对方将看不到视频')
        } else {
          logger.debug('本地视频已开启，对方可以看到视频')
        }
      } else if (callType === CallTypeEnum.VIDEO) {
        // 如果没有视频轨道但是视频通话，尝试重新获取
        try {
          const constraints = {
            audio: false,
            video: videoDevices.value.length > 0 ? { deviceId: selectedVideoDevice.value || undefined } : true
          }

          const newStream = await navigator.mediaDevices.getUserMedia(constraints)
          const newVideoTrack = newStream.getVideoTracks()[0]

          if (newVideoTrack && peerConnection.value) {
            // 添加新的视频轨道
            peerConnection.value.addTrack(newVideoTrack, localStream.value!)
            localStream.value!.addTrack(newVideoTrack)
            isVideoEnabled.value = true

            logger.debug('重新获取视频轨道成功')
          }
        } catch (error) {
          logger.error('重新获取视频轨道失败:', error)
          showFeedback(t('hooks.webrtc.camera_failed'), 'error')
        }
      }
    }
  }

  // 设备切换（抽离到 useCameraSwitch）
  const { switchAudioDevice, switchVideoDevice, switchCameraFacing } = useCameraSwitch({
    localStream,
    peerConnection,
    selectedAudioDevice,
    selectedVideoDevice,
    videoDevices,
    isVideoCall: () => rtcMsg.value.callType === CallTypeEnum.VIDEO,
    isMobile,
    notify: {
      error: (msg: string) => showFeedback(msg, 'error')
    }
  })

  // 桌面共享（抽离到 useScreenShare）
  const { isScreenSharing, startScreenShare, stopScreenShare } = useScreenShare({
    localStream,
    peerConnection,
    selectedVideoDevice,
    getCurrentCallType: () => rtcMsg.value.callType,
    getLocalStream,
    switchVideoDevice,
    notify: {
      warning: (msg: string) => showFeedback(msg, 'warning'),
      error: (msg: string) => showFeedback(msg, 'error')
    }
  })

  const lisendCandidate = async () => {
    if (!peerConnection.value) {
      return
    }

    info('第一次交换 ICE candidates...')
    if (pendingCandidates.value.length > 0) {
      pendingCandidates.value.forEach(async (candidate) => {
        await sendIceCandidate(candidate)
      })
    }

    pendingCandidates.value = []

    peerConnection.value.onicecandidate = async (event) => {
      if (event.candidate) {
        info('第二次交换 ICE candidates...')
        await sendIceCandidate(event.candidate)
      }
    }
  }

  // 处理接收到的信令消息
  const handleSignalMessage = async (data: WSRtcCallMsg) => {
    try {
      info('处理信令消息')
      const signal = JSON.parse(data.signal)

      switch (data.signalType) {
        case SignalTypeEnum.OFFER:
          await handleOffer(signal, true, roomId)
          await lisendCandidate()
          break

        case SignalTypeEnum.ANSWER:
          await handleAnswer(signal, roomId)
          // offer 发送 candidate
          await lisendCandidate()
          break

        case SignalTypeEnum.CANDIDATE:
          if (signal.candidate) {
            info('收到 candidate 信令')
            await handleCandidate(signal)
          }
          break

        default:
          logger.debug('未知信令类型:', data.signalType)
      }
    } catch (error) {
      logger.error('处理信令消息错误:', error)
    }
  }

  // 监听 WebRTC 信令消息（注册并保存卸载函数）
  // useMitt.on('WEBRTC_SIGNAL', handleSignalMessage)
  void (async () => {
    await addListener(
      listen<WSRtcCallMsg>('ws-webrtc-signal', (event) => {
        info(`收到信令消息: ${JSON.stringify(event.payload)}`)
        handleSignalMessage(event.payload)
      }),
      `${roomId}-ws-webrtc-signal`
    )
    await addListener(
      listen<Record<string, unknown>>('ws-call-accepted', (event) => {
        info(`通话被接受: ${JSON.stringify(event.payload)}`)
        // // 接受方，发送是否接受
        // info(`收到 CallAccepted'消息 ${isReceiver}`)
        if (!isReceiver) {
          sendOffer(offer.value!)
          // 对方接通后，主叫方窗口前置并聚焦
          void focusCurrentWindow()
        }
      }),
      `${roomId}-ws-call-accepted`
    )
    await addListener(
      listen<Record<string, unknown>>('ws-room-closed', (event) => {
        info(`房间已关闭: ${JSON.stringify(event.payload)}`)
        endCall()
      }),
      `${roomId}-ws-room-closed`
    )
    await addListener(
      listen<void>('ws-dropped', () => {
        endCall()
      }),
      `${roomId}-ws-dropped`
    )
    await addListener(
      listen<Record<string, unknown>>('ws-call-rejected', (event) => {
        info(`通话被拒绝: ${JSON.stringify(event.payload)}`)
        endCall()
      }),
      `${roomId}-ws-call-rejected`
    )
    await addListener(
      listen<Record<string, unknown>>('ws-cancel', (event) => {
        info(`已取消通话: ${JSON.stringify(event.payload)}`)
        endCall()
      }),
      `${roomId}-ws-cancel`
    )
    await addListener(
      listen<Record<string, unknown>>('ws-timeout', (event) => {
        info(`已取消通话: ${JSON.stringify(event.payload)}`)
        endCall()
      }),
      `${roomId}-ws-timeout`
    )
  })()

  onMounted(async () => {
    await loadIceServers()
    if (!isReceiver) {
      logger.debug(`调用方发送${callType === CallTypeEnum.VIDEO ? '视频' : '语音'}通话请求`)
      await startCall(roomId, callType, [remoteUserId])
    }
  })

  onUnmounted(() => {
    // 移除 WebRTC 信令消息监听器
    useMitt.off('WEBRTC_SIGNAL', handleSignalMessage)
  })

  return {
    startCallTimer,
    stopScreenShare,
    startScreenShare,
    toggleVideo,
    switchVideoDevice,
    switchCameraFacing,
    switchAudioDevice,
    isScreenSharing,
    selectedVideoDevice,
    selectedAudioDevice,
    localStream,
    remoteStream,
    peerConnection,
    getLocalStream,
    startCall,
    handleCallResponse,
    callDuration,
    connectionStatus,
    toggleMute,
    sendRtcCall2VideoCallResponse,
    isVideoEnabled,
    stopBell,
    startBell,
    pauseBell,
    playBell
  }
}
