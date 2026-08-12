/**
 * useRtcSignaling — WebRTC signaling exchange (offer/answer/ICE).
 *
 * Extracted from useWebRtc.ts. Handles:
 *  - sendCall / sendRtcCall2VideoCallResponse: call control signals
 *  - sendOffer / sendAnswer / sendIceCandidate: SDP + ICE transport
 *  - handleOffer / handleAnswer / handleCandidate: inbound signal handlers
 *  - lisendCandidate: deferred ICE candidate flush
 *  - handleSignalMessage: dispatches incoming signals by type
 */

import { nextTick } from 'vue'
import { CallTypeEnum, RTCCallStatus } from '@/enums'
import { createLogger } from '@/utils/Logger'
import type { RtcState } from './rtcContext'
import { sendMatrixVoipSignal } from './rtcContext'
import { SignalTypeEnum, type WSRtcCallMsg } from './types'

const logger = createLogger('RtcSignaling')

export function useRtcSignaling(
  state: RtcState,
  deps: {
    createPeerConnection: (roomId: string) => void
    getLocalStream: (type: CallTypeEnum) => Promise<boolean>
    endCall: () => Promise<void>
    handleCallResponse: (status: number) => Promise<void>
  }
) {
  const {
    roomId,
    remoteUserId,
    callType,
    userStore,
    connectionStatus,
    rtcStatus,
    peerConnection,
    pendingCandidates,
    timerManager,
    callTimer,
    isReceiver,
    isLinker,
    t,
    showFeedback,
    stopBell,
    getDevices
  } = state

  const sendCall = async () => {
    try {
      await sendMatrixVoipSignal('VIDEO_CALL_REQUEST', {
        roomId,
        targetUid: remoteUserId,
        isVideo: callType === CallTypeEnum.VIDEO
      })
    } catch (error) {
      logger.error('发送通话请求失败:', error)
    }
  }

  const sendRtcCall2VideoCallResponse = async (status: number) => {
    try {
      logger.info(`发送 ws 请求，通知双方通话状态 ${status}`)
      await sendMatrixVoipSignal('VIDEO_CALL_RESPONSE', {
        callerUid: remoteUserId,
        roomId,
        accepted: status
      })
    } catch (error) {
      logger.error('发送通话响应失败:', error)
    }
  }

  const sendOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      const signalData = {
        callerUid: userStore.userInfo?.uid ?? '',
        roomId,
        signal: JSON.stringify(offer),
        signalType: 'offer',
        targetUid: remoteUserId,
        video: callType === CallTypeEnum.VIDEO
      }
      logger.info('ws发送 offer')
      await sendMatrixVoipSignal('WEBRTC_SIGNAL', signalData)
    } catch (error) {
      logger.error('Failed to send SDP offer:', error)
    }
  }

  const sendAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      const signalData = {
        callerUid: userStore.userInfo?.uid ?? '',
        roomId,
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

  const sendIceCandidate = async (candidate: RTCIceCandidate) => {
    try {
      logger.info('发送ICE候选者')
      const signalData = {
        roomId,
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

  const handleOffer = async (signal: RTCSessionDescriptionInit, video: boolean, roomId: string) => {
    try {
      logger.debug('处理 offer')
      connectionStatus.value = RTCCallStatus.CALLING
      await nextTick()
      await getDevices()
      const hasLocalStream = await deps.getLocalStream(video ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO)
      stopBell()

      if (!hasLocalStream || !state.localStream.value) {
        await new Promise<void>((resolve) => {
          timerManager.setTimeout(() => resolve(), 3000)
        })
        await deps.handleCallResponse(0)
        return false
      }

      await nextTick()
      deps.createPeerConnection(roomId)
      rtcStatus.value = 'new'

      logger.info('设置远程描述')
      await peerConnection.value!.setRemoteDescription(signal)

      const answer = await peerConnection.value!.createAnswer()
      await peerConnection.value!.setLocalDescription(answer)

      if (!roomId) {
        showFeedback(t('hooks.webrtc.room_not_found'), 'error')
        return false
      }

      isLinker.value = true
      await sendAnswer(answer)
      connectionStatus.value = RTCCallStatus.ACCEPT
      logger.info('处理 offer 结束')
    } catch (e) {
      logger.error(`处理 offer 失败: ${e}`)
      await deps.endCall()
    }
  }

  const handleAnswer = async (answer: RTCSessionDescriptionInit, roomId: string) => {
    try {
      logger.info('处理 answer 消息')
      if (peerConnection.value) {
        if (callTimer.value !== null) {
          timerManager.clearTimeout(callTimer.value)
          callTimer.value = null
        }
        stopBell()

        if (!isReceiver) {
          if (!roomId) {
            showFeedback(t('hooks.webrtc.room_not_found'), 'error')
            await deps.endCall()
            return
          }
          logger.debug('发起者 - 设置远程描述', answer)
          await peerConnection.value.setRemoteDescription(answer)
        }
      }
    } catch (error) {
      logger.error('处理 answer 失败:', error)
      connectionStatus.value = RTCCallStatus.ERROR
      await deps.endCall()
    }
  }

  const handleCandidate = async (signal: RTCIceCandidateInit) => {
    try {
      if (peerConnection.value?.remoteDescription) {
        logger.info('添加 candidate')
        await peerConnection.value!.addIceCandidate(signal)
      }
    } catch (error) {
      logger.error('处理 candidate 失败:', error)
    }
  }

  const lisendCandidate = async () => {
    if (!peerConnection.value) return
    logger.info('第一次交换 ICE candidates...')
    if (pendingCandidates.value.length > 0) {
      pendingCandidates.value.forEach(async (candidate) => {
        await sendIceCandidate(candidate)
      })
    }
    pendingCandidates.value = []
    peerConnection.value.onicecandidate = async (event) => {
      if (event.candidate) {
        logger.info('第二次交换 ICE candidates...')
        await sendIceCandidate(event.candidate)
      }
    }
  }

  const handleSignalMessage = async (data: WSRtcCallMsg) => {
    try {
      logger.info('处理信令消息')
      const signal = JSON.parse(data.signal)
      switch (data.signalType) {
        case SignalTypeEnum.OFFER:
          await handleOffer(signal, true, roomId)
          await lisendCandidate()
          break
        case SignalTypeEnum.ANSWER:
          await handleAnswer(signal, roomId)
          await lisendCandidate()
          break
        case SignalTypeEnum.CANDIDATE:
          if (signal.candidate) {
            logger.info('收到 candidate 信令')
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

  return {
    sendCall,
    sendRtcCall2VideoCallResponse,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    handleOffer,
    handleAnswer,
    handleCandidate,
    lisendCandidate,
    handleSignalMessage
  }
}
