/**
 * useRtcEventListeners — Tauri event listener registration for WebRTC.
 *
 * Extracted from useWebRtc.ts. Registers all ws-* event listeners needed
 * for call lifecycle (signal/accepted/rejected/cancelled/timeout/closed/dropped).
 */

import { listen } from '@tauri-apps/api/event'
import { createLogger } from '@/utils/Logger'
import { focusCurrentWindow } from './rtcContext'
import type { WSRtcCallMsg } from './types'

const logger = createLogger('RtcEventListeners')

export function useRtcEventListeners(
  roomId: string,
  isReceiver: boolean,
  handlers: {
    handleSignalMessage: (data: WSRtcCallMsg) => Promise<void>
    sendOffer: (offer: RTCSessionDescriptionInit) => Promise<void>
    endCall: () => Promise<void>
  },
  offer: { value: RTCSessionDescriptionInit | undefined },
  addListener: (unlistenPromise: Promise<() => void>, key: string) => Promise<void>
) {
  void (async () => {
    await addListener(
      listen<WSRtcCallMsg>('ws-webrtc-signal', (event) => {
        logger.info(`收到信令消息: ${JSON.stringify(event.payload)}`)
        handlers.handleSignalMessage(event.payload)
      }),
      `${roomId}-ws-webrtc-signal`
    )
    await addListener(
      listen<Record<string, unknown>>('ws-call-accepted', (event) => {
        logger.info(`通话被接受: ${JSON.stringify(event.payload)}`)
        if (!isReceiver) {
          handlers.sendOffer(offer.value!)
          void focusCurrentWindow()
        }
      }),
      `${roomId}-ws-call-accepted`
    )
    await addListener(
      listen<Record<string, unknown>>('ws-room-closed', (event) => {
        logger.info(`房间已关闭: ${JSON.stringify(event.payload)}`)
        handlers.endCall()
      }),
      `${roomId}-ws-room-closed`
    )
    await addListener(
      listen<void>('ws-dropped', () => {
        handlers.endCall()
      }),
      `${roomId}-ws-dropped`
    )
    await addListener(
      listen<Record<string, unknown>>('ws-call-rejected', (event) => {
        logger.info(`通话被拒绝: ${JSON.stringify(event.payload)}`)
        handlers.endCall()
      }),
      `${roomId}-ws-call-rejected`
    )
    await addListener(
      listen<Record<string, unknown>>('ws-cancel', (event) => {
        logger.info(`已取消通话: ${JSON.stringify(event.payload)}`)
        handlers.endCall()
      }),
      `${roomId}-ws-cancel`
    )
    await addListener(
      listen<Record<string, unknown>>('ws-timeout', (event) => {
        logger.info(`已取消通话: ${JSON.stringify(event.payload)}`)
        handlers.endCall()
      }),
      `${roomId}-ws-timeout`
    )
  })()
}
