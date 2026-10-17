import type { MatrixClient } from '@/services/matrix/sdk'

import { createLogger } from '@/utils/Logger'
import {
  checkMediaPermissions as checkMediaPerms,
  checkTurnAvailability as checkTurn,
  checkVoipAvailability as checkVoip,
  getCallById,
  getCallStatsFromPeerConn,
  getMediaDeviceList,
  getTurnServerConfig
} from './voipHelpers'

const logger = createLogger('MatrixVoIP')

/**
 * VoIP 诊断类查询：通话统计、媒体权限、设备枚举、TURN 可用性。
 *
 * 从 `MatrixVoIPService` 抽出：这些方法只读取诊断信息，不触碰通话生命周期状态
 * （`calls` / `callHandlers`），因此无需与通话管理共享实例。
 * 通过 `getClient` 访问器取客户端：未初始化时各函数按自身语义降级。
 */

type CallStats = Awaited<ReturnType<typeof getCallStatsFromPeerConn>>

/** 获取通话的 WebRTC 统计；客户端未初始化或通话不存在时返回 null。 */
export async function fetchCallStats(getClient: () => MatrixClient, callId: string): Promise<CallStats> {
  let client: MatrixClient
  try {
    client = getClient()
  } catch (err) {
    logger.warn('getCallStats getClient failed:', err)
    return null
  }
  const call = getCallById(callId, client)
  return call ? getCallStatsFromPeerConn(call) : null
}

/** 检测摄像头 / 麦克风权限状态。 */
export async function checkMediaPermissions(): Promise<{ audio: boolean; video: boolean }> {
  return checkMediaPerms()
}

/** 枚举可用的音视频输入设备。 */
export async function listMediaDevices(): Promise<{ audio: MediaDeviceInfo[]; video: MediaDeviceInfo[] }> {
  return getMediaDeviceList()
}

/** 获取当前可用的 TURN 服务器配置。 */
export async function fetchTurnServer(getClient: () => MatrixClient): ReturnType<typeof getTurnServerConfig> {
  return getTurnServerConfig(getClient())
}

/** 检测 TURN 服务是否可用；客户端未初始化时返回 `{ available: false }`。 */
export async function checkTurnAvailability(getClient: () => MatrixClient): ReturnType<typeof checkTurn> {
  let client: MatrixClient
  try {
    client = getClient()
  } catch (err) {
    logger.warn('checkTurnAvailability getClient failed:', err)
    return { available: false, reason: '客户端未初始化' }
  }
  return checkTurn(client)
}

/** 检测 VoIP 与 TURN 的整体可用性；客户端未初始化时返回全 false 的降级结果。 */
export async function checkVoipAvailability(getClient: () => MatrixClient): ReturnType<typeof checkVoip> {
  let client: MatrixClient
  try {
    client = getClient()
  } catch (err) {
    logger.warn('checkVoipAvailability getClient failed:', err)
    return { voipAvailable: false, turnAvailable: false, message: '客户端未初始化' }
  }
  return checkVoip(client)
}
