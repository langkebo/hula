/**
 * useRtcPeerConnection — RTCPeerConnection lifecycle management.
 *
 * Extracted from useWebRtc.ts. Handles:
 *  - createPeerConnection: creates RTCPeerConnection, wires track/ICE/state events
 *  - clear: stops all tracks, closes connection/channel, resets state
 */

import { RTCCallStatus } from '@/enums'
import { createLogger } from '@/utils/Logger'
import { getIceConfiguration } from './iceServers'
import type { RtcState } from './rtcContext'

const logger = createLogger('RtcPeerConnection')

export function useRtcPeerConnection(state: RtcState) {
  const {
    localStream,
    remoteStream,
    peerConnection,
    channel,
    channelStatus,
    pendingCandidates,
    connectionStatus,
    rtcStatus,
    timerManager,
    callTimer,
    isLinker,
    isScreenSharing,
    t,
    showFeedback,
    stopBell,
    stopCallTimer,
    resetDevices,
    rtcMsg
  } = state

  const createPeerConnection = (roomId: string) => {
    try {
      const pc = new RTCPeerConnection(getIceConfiguration())

      pc.ontrack = (event) => {
        logger.info('pc 监听到 ontrack 事件')
        if (event.streams[0]) {
          logger.debug('收到远程流:', event.streams[0])
          remoteStream.value = event.streams[0]
        } else {
          remoteStream.value = null
        }
      }

      logger.info('添加本地流到 PC')
      if (localStream.value) {
        localStream.value.getTracks().forEach((track) => {
          localStream.value && pc.addTrack(track, localStream.value)
        })
      } else {
        logger.warn('localStream 为 null，无法添加本地流到 PeerConnection')
      }

      pc.onconnectionstatechange = (e) => {
        logger.info(`RTC 连接状态变化: ${pc.connectionState}`)
        switch (pc.connectionState) {
          case 'new':
            logger.info('RTC 连接新建')
            break
          case 'connecting':
            logger.info('RTC 连接中')
            connectionStatus.value = RTCCallStatus.CALLING
            break
          case 'connected':
            logger.info('RTC 连接成功')
            connectionStatus.value = RTCCallStatus.ACCEPT
            state.startCallTimer()
            break
          case 'disconnected':
            logger.info('RTC 连接断开')
            connectionStatus.value = RTCCallStatus.END
            showFeedback(t('hooks.webrtc.rtc_connection_failed'), 'error')
            timerManager.setTimeout(async () => {
              await stateEndCall()
            }, 500)
            break
          case 'closed':
            logger.info('RTC 连接关闭')
            connectionStatus.value = RTCCallStatus.END
            timerManager.setTimeout(async () => {
              await stateEndCall()
            }, 500)
            break
          case 'failed':
            connectionStatus.value = RTCCallStatus.ERROR
            logger.info('RTC 连接失败')
            showFeedback(t('hooks.webrtc.rtc_connection_failed'), 'error')
            timerManager.setTimeout(async () => {
              await stateEndCall()
            }, 500)
            break
          default:
            logger.info('RTC 连接状态变化: ', pc.connectionState)
            break
        }
        rtcStatus.value = (e?.currentTarget as RTCPeerConnection | null)?.connectionState || pc.connectionState
      }

      channel.value = pc.createDataChannel('chat')
      channel.value.onerror = (event) => {
        logger.warn('信道出错:', event)
      }
      pc.onicecandidate = async (event) => {
        logger.info('pc 监听到 onicecandidate 事件')
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

  // endCall is injected to avoid circular dependency; set lazily.
  let stateEndCall: () => Promise<void> = async () => {
    logger.warn('endCall not yet wired to peerConnection clear')
  }
  const setEndCall = (fn: () => Promise<void>) => {
    stateEndCall = fn
  }

  const clear = () => {
    try {
      stopBell()
      timerManager.clearAll()
      callTimer.value = null
      stopCallTimer()
      channel.value?.close?.()
      peerConnection.value?.close?.()
      localStream.value?.getTracks().forEach((track) => track.stop())
      remoteStream.value?.getTracks().forEach((track) => track.stop())
    } catch (error) {
      showFeedback(t('hooks.webrtc.cleanup_failed'), 'error')
      logger.error('清理资源失败:', error)
    } finally {
      rtcMsg.value = { roomId: undefined, callType: undefined, senderId: undefined }
      pendingCandidates.value = []
      resetDevices()
      localStream.value = null
      remoteStream.value = null
      connectionStatus.value = undefined
      rtcStatus.value = undefined
      isScreenSharing.value = false
      isLinker.value = false
      peerConnection.value = null
      channel.value = null
      channelStatus.value = undefined
    }
  }

  return { createPeerConnection, clear, setEndCall }
}
