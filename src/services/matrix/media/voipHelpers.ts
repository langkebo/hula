/**
 * VoIP 服务 — 辅助函数模块。
 *
 * 从 MatrixVoIPService 抽离，包含通话查找、统计提取、媒体设备检测、
 * TURN 服务器配置等纯函数。接收 MatrixClient 作为依赖。
 */

import type { MatrixClient } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import type { CallStats, TurnServerConfig, VoIPCall, VoIPCallHandler } from './voipTypes'

const logger = createLogger('VoIPHelpers')

/** 根据 ID 获取通话实例
 */
export function getCallById(callId: string, client: MatrixClient): VoIPCall | undefined {
  const calls = (client as unknown as { getCallHandler?: () => VoIPCallHandler }).getCallHandler?.()?.calls || {}
  return calls[callId]
}

/** 从 PeerConnection 获取通话统计信息
 */
export async function getCallStatsFromPeerConn(call: VoIPCall): Promise<CallStats | null> {
  const pc = call.peerConn
  if (!pc) return null

  try {
    const stats = await pc.getStats()
    let bytesReceived = 0
    let bytesSent = 0
    let packetsLost = 0
    let jitter = 0
    let roundTripTime = 0

    stats.forEach((report: RTCStats & Record<string, unknown>) => {
      if (report.type === 'inbound-rtp') {
        bytesReceived += (report.bytesReceived as number) || 0
        packetsLost = (report.packetsLost as number) || 0
        jitter = (report.jitter as number) || 0
      }
      if (report.type === 'outbound-rtp') {
        bytesSent += (report.bytesSent as number) || 0
      }
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        roundTripTime = (report.currentRoundTripTime as number) || 0
      }
    })

    return { bytesReceived, bytesSent, packetsLost, jitter, roundTripTime }
  } catch (err) {
    logger.warn('getCallStats failed:', err)
    return null
  }
}

/** 检查媒体设备权限
 */
export async function checkMediaPermissions(): Promise<{ audio: boolean; video: boolean }> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return {
      audio: devices.some((d) => d.kind === 'audioinput'),
      video: devices.some((d) => d.kind === 'videoinput')
    }
  } catch (err) {
    logger.warn('checkMediaPermissions failed:', err)
    return { audio: false, video: false }
  }
}

/** 获取媒体设备列表
 */
export async function getMediaDeviceList(): Promise<{ audio: MediaDeviceInfo[]; video: MediaDeviceInfo[] }> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return {
      audio: devices.filter((d) => d.kind === 'audioinput'),
      video: devices.filter((d) => d.kind === 'videoinput')
    }
  } catch (err) {
    logger.warn('getMediaDevices failed:', err)
    return { audio: [], video: [] }
  }
}

/** 获取 TURN 服务器配置
 */
export async function getTurnServerConfig(client: MatrixClient): Promise<TurnServerConfig> {
  try {
    const r = await client.getTurnServerManager().getTurnServerConfig()
    logger.info('[VoIP] 获取 TURN 服务器配置成功')
    return {
      username: r.username ?? '',
      password: r.password ?? '',
      uris: r.uris ?? [],
      ttl: r.ttl ?? 3600
    }
  } catch (err) {
    logger.error(`[VoIP] 获取 TURN 服务器配置失败: ${err}`)
    throw err
  }
}

/** 检查 TURN 服务器可用性
 */
export async function checkTurnAvailability(client: MatrixClient): Promise<{
  available: boolean
  reason?: string
  turnServer?: TurnServerConfig
}> {
  try {
    const r = await client.getTurnServerManager().getTurnServerConfig()
    const uris = r.uris ?? []

    if (uris.length === 0) {
      logger.warn('[VoIP] TURN 服务器未配置')
      return { available: false, reason: 'TURN 服务器未部署，语音通话可能在 NAT 环境下不可用' }
    }

    logger.info('[VoIP] TURN 服务器可用')
    return {
      available: true,
      turnServer: {
        username: r.username ?? '',
        password: r.password ?? '',
        uris,
        ttl: r.ttl ?? 3600
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.warn(`[VoIP] TURN 服务器检测失败: ${errMsg}`)
    return { available: false, reason: 'TURN 服务检测失败，语音通话功能可能受限' }
  }
}

/** 检查 VoIP 功能可用性
 */
export async function checkVoipAvailability(client: MatrixClient): Promise<{
  voipAvailable: boolean
  turnAvailable: boolean
  message?: string
}> {
  const turnStatus = await checkTurnAvailability(client)

  if (!client.voipHandler) {
    return { voipAvailable: false, turnAvailable: turnStatus.available, message: 'VoIP 模块不可用' }
  }

  if (!turnStatus.available) {
    return {
      voipAvailable: true,
      turnAvailable: false,
      message: turnStatus.reason || 'TURN 服务暂不可用，语音通话功能受限'
    }
  }

  return { voipAvailable: true, turnAvailable: true }
}
