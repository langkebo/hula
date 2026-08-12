/**
 * Shared types and utilities for the WebRTC composable family.
 *
 * RtcState packs all reactive refs that are shared across the sub-composables
 * (useRtcPeerConnection, useRtcSignaling, useRtcEventListeners) so they can be
 * passed as a single argument instead of long parameter lists.
 */

import type { Ref } from 'vue'
import type { CallTypeEnum, RTCCallStatus } from '@/enums'
import type { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'
import type { TimerManager } from '@/utils/TimerManager'
import type { RtcMsgVO } from './types'

const logger = createLogger('WebRtc')

/**
 * Sends a Matrix VoIP signaling message. Currently logs only; will be wired
 * to the Matrix VoIP signaling transport when available.
 */
export const sendMatrixVoipSignal = async (type: string, data: Record<string, unknown>) => {
  logger.info(`[useWebRtc] Matrix VoIP Signal: ${type}`, data)
}

export const MAX_TIME_OUT_SECONDS = 30

/** Reactive state shared across WebRTC sub-composables. */
export interface RtcState {
  // Call parameters
  roomId: string
  remoteUserId: string
  callType: CallTypeEnum
  isReceiver: boolean

  // Media streams
  localStream: Ref<MediaStream | null>
  remoteStream: Ref<MediaStream | null>

  // Peer connection
  peerConnection: Ref<RTCPeerConnection | null>
  channel: Ref<RTCDataChannel | null>
  channelStatus: Ref<RTCDataChannelState | undefined>
  pendingCandidates: Ref<RTCIceCandidate[]>

  // Call status
  connectionStatus: Ref<RTCCallStatus | undefined>
  rtcStatus: Ref<RTCPeerConnectionState | undefined>
  rtcMsg: Ref<Partial<RtcMsgVO>>
  isLinker: Ref<boolean>
  offer: Ref<RTCSessionDescriptionInit | undefined>
  isVideoEnabled: Ref<boolean>
  isScreenSharing: Ref<boolean>

  // Timers
  timerManager: TimerManager
  callTimer: Ref<number | null>

  // External deps
  userStore: ReturnType<typeof useUserStore>
  t: (key: string, params?: Record<string, unknown>) => string
  showFeedback: (msg: string, type: 'error' | 'warning' | 'success') => void

  // Bell control
  startBell: () => void
  stopBell: () => void

  // Call timer
  startCallTimer: () => void
  stopCallTimer: () => void

  // Device accessors (from useMediaDevices)
  audioDevices: Ref<MediaDeviceInfo[]>
  videoDevices: Ref<MediaDeviceInfo[]>
  selectedAudioDevice: Ref<string | null | undefined>
  selectedVideoDevice: Ref<string | null | undefined>
  getDevices: () => Promise<boolean>
  resetDevices: () => void
}

/**
 * Focuses the current Tauri webview window — used after call connects to
 * bring the call window to the foreground.
 */
export async function focusCurrentWindow(): Promise<void> {
  const { hasTauriRuntime } = await import('@/utils/AppHarness')
  if (!hasTauriRuntime()) return
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
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
