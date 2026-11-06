import endpointCapabilityService from '@/services/matrix/EndpointCapabilityService'
import type { MatrixClient } from '@/services/matrix/sdk'
import { VendorPrefix } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { unknownToObject } from '@/utils/typeGuard'
import { MATRIX_PATHS } from '../paths'

const logger = createLogger('MatrixVoiceService')

type VoiceManagerInstance = ReturnType<NonNullable<MatrixClient['getVoiceManager']>>

/** 获取语音统计（传入 roomId 时统计房间维度，否则全局）；失败返回全 0。 */
export async function fetchVoiceStats(
  getVoiceMgr: () => VoiceManagerInstance,
  roomId?: string
): Promise<{ totalDuration: number; totalMessages: number; averageDuration: number }> {
  try {
    const mgr = getVoiceMgr()
    const result = roomId ? await mgr.getRoomVoiceStats(roomId, VendorPrefix) : await mgr.getVoiceStats(VendorPrefix)
    const data = unknownToObject(result) ?? {}
    return {
      totalDuration: (data.total_duration as number) ?? (data.total_duration_ms as number) ?? 0,
      totalMessages: (data.total_messages as number) ?? (data.message_count as number) ?? 0,
      averageDuration: (data.average_duration as number) ?? (data.average_duration_ms as number) ?? 0
    }
  } catch (err) {
    logger.warn(`[MatrixVoiceService] getVoiceStats failed: ${err}`)
    return { totalDuration: 0, totalMessages: 0, averageDuration: 0 }
  }
}

/** 获取指定用户的语音统计（总时长/总条数）；失败返回全 0。 */
export async function fetchUserVoiceStats(
  getVoiceMgr: () => VoiceManagerInstance,
  requireNonEmpty: (value: string, name: string) => void,
  userId: string
): Promise<{ totalDuration: number; totalMessages: number }> {
  requireNonEmpty(userId, 'userId')
  try {
    const result = await getVoiceMgr().getUserVoiceStats(userId, VendorPrefix)
    const data = unknownToObject(result) ?? {}
    return {
      totalDuration: (data.total_duration as number) ?? (data.total_duration_ms as number) ?? 0,
      totalMessages: (data.total_messages as number) ?? (data.message_count as number) ?? 0
    }
  } catch (err) {
    logger.warn(`[MatrixVoiceService] getUserVoiceStats failed: ${err}`)
    return { totalDuration: 0, totalMessages: 0 }
  }
}

/** 获取语音能力配置；端点不可用时抛出，字段缺失回退内置默认值。 */
export async function fetchVoiceConfig(
  getVoiceMgr: () => VoiceManagerInstance,
  t: (key: string) => string
): Promise<{ maxDuration: number; allowedFormats: string[]; autoTranscribe: boolean }> {
  try {
    const available = await endpointCapabilityService.check('GET', MATRIX_PATHS.VOICE.CONFIG)
    if (!available) {
      throw new Error(t('matrix_error.media.voice_message_manager_unavailable'))
    }
    const result = await getVoiceMgr().getVoiceConfig(VendorPrefix)
    const data = unknownToObject(result) ?? {}
    return {
      maxDuration: (data.max_duration as number) ?? 300,
      allowedFormats: (data.allowed_formats as string[]) ??
        (data.allowed_content_types as string[]) ?? ['audio/webm', 'audio/ogg', 'audio/mp4'],
      autoTranscribe: (data.auto_transcribe as boolean) ?? false
    }
  } catch (err) {
    logger.error(`[MatrixVoiceService] 获取语音配置失败: ${err}`)
    throw err
  }
}
