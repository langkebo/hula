import type { MatrixClient } from '@/services/matrix/sdk'
import { ClientPrefix } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import endpointCapabilityService from '../EndpointCapabilityService'
import matrixClientService from '../MatrixClientService'
import { authedRequestWithPath } from '../MatrixHttpClient'
import { MATRIX_PATHS } from '../paths'

interface VoiceTranscriptionParams {
  roomId: string
  eventId: string
  lang?: string
}

interface VoiceTranscriptionResult {
  text: string
  language?: string
  segments?: Array<{ start: number; end: number; text: string }>
}

interface MxcHttpClient {
  mxcUrlToHttp?: (
    mxcUrl: string,
    width?: number,
    height?: number,
    resizeMethod?: string,
    allowDirectLinks?: boolean,
    allowRedirects?: boolean,
    useAuthentication?: boolean
  ) => string | null
  getRoom(roomId: string): RoomLike | null
}

interface EventContentLike {
  url?: string
  info?: {
    mimetype?: string
    size?: number
  }
}

interface RoomEventLike {
  getContent?: () => EventContentLike
}

interface RoomLike {
  findEventById?: (eventId: string) => RoomEventLike | null
}

import type { EncryptedAttachmentFile } from '../crypto/MatrixAttachmentEncryptionService'

const logger = createLogger('MatrixVoiceService')

interface VoiceMessageResult {
  eventId?: string
  url?: string
  filename: string
  mxcUrl?: string
  httpUrl?: string
  encryptedFile?: EncryptedAttachmentFile
}

interface VoicePlaybackInfo {
  duration?: number
  waveform?: number[]
  mimeType?: string
  size?: number
  mxcUrl?: string
  httpUrl?: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * VoiceManager 实例类型。
 *
 * 注：`matrix-js-sdk/voice` 子路径在 package.json exports 中已暴露，
 * 但为保持与 RoomOperations 中 InviteBlocklistManager 一致的类型派生模式，
 * 这里同样通过 MatrixClient 访问器返回类型派生。
 */
type VoiceManagerInstance = ReturnType<NonNullable<MatrixClient['getVoiceManager']>>

class MatrixVoiceService extends BaseMatrixService {
  // FT-122: 校验必需的 ID 参数非空，避免空字符串传给后端
  private requireNonEmpty(value: string, name: string): void {
    if (!value || value.trim() === '') {
      throw new Error(`${name} is required and must be a non-empty string`)
    }
  }

  private getVoiceClient(): MxcHttpClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.matrix_client_not_initialized'))
    }
    return client as MxcHttpClient
  }

  /**
   * VoiceManager 访问器。
   *
   * SDK VoiceManager 默认使用 ClientPrefix.V3，但前端历史使用 V1 端点。
   * 后端 V1/V3 均支持 stats/config/upload 等，但 convert/optimize/transcription
   * 仅 V3 有路由。为保持行为一致性，全部走 V1（后端 V1 也支持）。
   */
  private getVoiceMgr(): VoiceManagerInstance {
    const client = this.getClient()
    const fn = (client as unknown as { getVoiceManager?: () => VoiceManagerInstance }).getVoiceManager
    if (typeof fn !== 'function') {
      throw new Error('MatrixClient.getVoiceManager is not available; SDK 未初始化')
    }
    return fn.call(client)
  }

  private resolveHttpUrl(mxcUrl?: string): string | undefined {
    if (!mxcUrl) {
      return undefined
    }

    const client = this.getVoiceClient()
    return client.mxcUrlToHttp?.(mxcUrl) ?? undefined
  }

  getPlayableUrl(mxcUrl?: string, fallbackUrl?: string): string {
    const sourceUrl = mxcUrl || fallbackUrl
    if (!sourceUrl) {
      return ''
    }

    if (!sourceUrl.startsWith('mxc://')) {
      return sourceUrl
    }

    try {
      return this.resolveHttpUrl(sourceUrl) ?? fallbackUrl ?? sourceUrl
    } catch (err) {
      logger.warn(`[MatrixVoiceService] getPlayableUrl failed: ${err}`)
      return fallbackUrl ?? sourceUrl
    }
  }

  async uploadVoice(roomId: string, file: Blob | File, filename = 'voice.webm'): Promise<VoiceMessageResult> {
    this.requireNonEmpty(roomId, 'roomId')
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.matrix_client_not_initialized'))
    }

    try {
      const path = MATRIX_PATHS.VOICE.UPLOAD
      const available = await endpointCapabilityService.check('POST', path)
      if (!available) {
        throw new Error(this.t('matrix_error.media.voice_message_manager_unavailable'))
      }

      const formData = new FormData()
      formData.append('file', file, filename)
      if (roomId) formData.append('roomId', roomId)

      const result = await authedRequestWithPath<Record<string, unknown>>(client, 'POST', path, undefined, formData)

      const mxcUrl = (result.url as string) ?? (result.content_uri as string)
      return {
        eventId: (result.event_id as string) ?? (result.eventId as string),
        url: mxcUrl,
        filename,
        mxcUrl,
        httpUrl: this.resolveHttpUrl(mxcUrl)
      }
    } catch (err) {
      logger.error(`[MatrixVoiceService] 上传语音失败: ${err}`)
      throw err
    }
  }

  async getVoice(roomId: string, eventId: string): Promise<VoicePlaybackInfo | null> {
    this.requireNonEmpty(roomId, 'roomId')
    this.requireNonEmpty(eventId, 'eventId')
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.matrix_client_not_initialized'))
    }

    try {
      const client_ = this.getVoiceClient()
      const room = client_.getRoom(roomId) as RoomLike | null
      const event = room?.findEventById?.(eventId) ?? null
      const content = event?.getContent?.()
      const mxcUrl = content?.url

      if (!mxcUrl) {
        return null
      }

      return {
        mimeType: content?.info?.mimetype,
        size: content?.info?.size,
        mxcUrl,
        httpUrl: this.resolveHttpUrl(mxcUrl)
      }
    } catch (err) {
      logger.error(`[MatrixVoiceService] 获取语音信息失败: ${roomId}/${eventId} ${err}`)
      return null
    }
  }

  async transcribeVoice(params: VoiceTranscriptionParams): Promise<VoiceTranscriptionResult> {
    try {
      const result = await this.transcribeVoiceViaApi(params.eventId, params.lang)
      if (!result) {
        throw new Error(this.t('matrix_error.media.voice_message_manager_unavailable'))
      }
      return {
        text: result.text,
        language: result.language,
        segments: undefined
      }
    } catch (err) {
      logger.error(`[MatrixVoiceService] 语音转文字失败: ${params.eventId} ${err}`)
      throw err
    }
  }

  async getVoiceStats(roomId?: string): Promise<{
    totalDuration: number
    totalMessages: number
    averageDuration: number
  }> {
    try {
      const mgr = this.getVoiceMgr()
      const result = roomId
        ? await mgr.getRoomVoiceStats(roomId, ClientPrefix.V1)
        : await mgr.getVoiceStats(ClientPrefix.V1)
      const data = result as unknown as Record<string, unknown>
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

  async getUserVoiceStats(userId: string): Promise<{
    totalDuration: number
    totalMessages: number
  }> {
    this.requireNonEmpty(userId, 'userId')
    try {
      const result = await this.getVoiceMgr().getUserVoiceStats(userId, ClientPrefix.V1)
      const data = result as unknown as Record<string, unknown>
      return {
        totalDuration: (data.total_duration as number) ?? (data.total_duration_ms as number) ?? 0,
        totalMessages: (data.total_messages as number) ?? (data.message_count as number) ?? 0
      }
    } catch (err) {
      logger.warn(`[MatrixVoiceService] getUserVoiceStats failed: ${err}`)
      return { totalDuration: 0, totalMessages: 0 }
    }
  }

  async getVoiceConfig(): Promise<{
    maxDuration: number
    allowedFormats: string[]
    autoTranscribe: boolean
  }> {
    try {
      const available = await endpointCapabilityService.check('GET', MATRIX_PATHS.VOICE.CONFIG)
      if (!available) {
        throw new Error(this.t('matrix_error.media.voice_message_manager_unavailable'))
      }
      const result = await this.getVoiceMgr().getVoiceConfig(ClientPrefix.V1)
      const data = result as unknown as Record<string, unknown>
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

  async deleteVoice(messageId: string): Promise<void> {
    this.requireNonEmpty(messageId, 'messageId')
    try {
      const available = await endpointCapabilityService.check('DELETE', MATRIX_PATHS.VOICE.CONTENT(messageId))
      if (!available) {
        throw new Error(this.t('matrix_error.media.voice_message_manager_unavailable'))
      }
      await this.getVoiceMgr().deleteVoiceMessage(messageId, ClientPrefix.V1)
    } catch (err) {
      logger.error(`[MatrixVoiceService] 删除语音失败: ${messageId} ${err}`)
      throw err
    }
  }

  async getRoomVoiceList(
    roomId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    voices: Array<{ event_id: string; sender: string; duration: number; timestamp: number }>
    total: number
  }> {
    this.requireNonEmpty(roomId, 'roomId')
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.matrix_client_not_initialized'))
    }

    try {
      const path = MATRIX_PATHS.VOICE.ROOM_LIST(roomId)
      const available = await endpointCapabilityService.check('GET', path)
      if (!available) {
        return { voices: [], total: 0 }
      }
      const result = await authedRequestWithPath<Record<string, unknown>>(client, 'GET', path, {
        limit: String(limit),
        offset: String(offset)
      })
      return {
        voices:
          (result.voices as Array<{ event_id: string; sender: string; duration: number; timestamp: number }>) ?? [],
        total: (result.total as number) ?? 0
      }
    } catch (err) {
      logger.warn(`[MatrixVoiceService] getRoomVoiceList failed: ${err}`)
      return { voices: [], total: 0 }
    }
  }

  async getUserVoiceList(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    voices: Array<{ event_id: string; room_id: string; duration: number; timestamp: number }>
    total: number
  }> {
    this.requireNonEmpty(userId, 'userId')
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.matrix_client_not_initialized'))
    }

    try {
      const path = MATRIX_PATHS.VOICE.USER_LIST(userId)
      const available = await endpointCapabilityService.check('GET', path)
      if (!available) {
        return { voices: [], total: 0 }
      }
      const result = await authedRequestWithPath<Record<string, unknown>>(client, 'GET', path, {
        limit: String(limit),
        offset: String(offset)
      })
      return {
        voices:
          (result.voices as Array<{ event_id: string; room_id: string; duration: number; timestamp: number }>) ?? [],
        total: (result.total as number) ?? 0
      }
    } catch (err) {
      logger.warn(`[MatrixVoiceService] getUserVoiceList failed: ${err}`)
      return { voices: [], total: 0 }
    }
  }

  async getVoiceContent(messageId: string): Promise<Record<string, unknown> | null> {
    this.requireNonEmpty(messageId, 'messageId')
    try {
      const available = await endpointCapabilityService.check('GET', MATRIX_PATHS.VOICE.CONTENT(messageId))
      if (!available) {
        return null
      }
      const result = await this.getVoiceMgr().getVoiceMessage(messageId, ClientPrefix.V1)
      return result as unknown as Record<string, unknown>
    } catch (err) {
      logger.warn(`[MatrixVoiceService] getVoiceContent failed: ${err}`)
      return null
    }
  }

  async convertVoice(messageId: string, targetFormat: string): Promise<{ url: string; format: string } | null> {
    this.requireNonEmpty(messageId, 'messageId')
    try {
      const available = await endpointCapabilityService.check('POST', MATRIX_PATHS.VOICE.CONVERT)
      if (!available) {
        logger.warn('[MatrixVoiceService] 语音转换端点不可用')
        return null
      }

      const result = await this.getVoiceMgr().convertVoiceMessage(messageId, { format: targetFormat }, ClientPrefix.V1)
      const data = result as unknown as Record<string, unknown>
      return { url: (data.url as string) ?? '', format: (data.format as string) ?? targetFormat }
    } catch (err) {
      logger.warn(`[MatrixVoiceService] convertVoice failed: ${err}`)
      return null
    }
  }

  async optimizeVoice(
    messageId: string,
    options?: { bitrate?: number; sample_rate?: number }
  ): Promise<{ url: string; size: number } | null> {
    this.requireNonEmpty(messageId, 'messageId')
    try {
      const available = await endpointCapabilityService.check('POST', MATRIX_PATHS.VOICE.OPTIMIZE)
      if (!available) {
        logger.warn('[MatrixVoiceService] 语音优化端点不可用')
        return null
      }

      const result = await this.getVoiceMgr().optimizeVoiceMessage(messageId, options ?? {}, ClientPrefix.V1)
      const data = result as unknown as Record<string, unknown>
      return { url: (data.url as string) ?? '', size: (data.size as number) ?? 0 }
    } catch (err) {
      logger.warn(`[MatrixVoiceService] optimizeVoice failed: ${err}`)
      return null
    }
  }

  async transcribeVoiceViaApi(
    messageId: string,
    lang?: string
  ): Promise<{ text: string; language?: string; confidence?: number } | null> {
    try {
      const available = await endpointCapabilityService.check('POST', MATRIX_PATHS.VOICE.TRANSCRIPTION)
      if (!available) {
        logger.warn('[MatrixVoiceService] 语音转文字端点不可用')
        return null
      }

      const options = lang ? { language: lang } : undefined
      const result = await this.getVoiceMgr().transcribeVoiceMessage(messageId, options, ClientPrefix.V1)
      const data = result as unknown as Record<string, unknown>
      return {
        text: (data.text as string) ?? '',
        language: data.language as string | undefined,
        confidence: data.confidence as number | undefined
      }
    } catch (err) {
      logger.warn(`[MatrixVoiceService] transcribeVoiceViaApi failed: ${err}`)
      return null
    }
  }

  /**
   * 获取 RTC 传输协议信息（MSC4143）
   *
   * 调用 GET /_matrix/client/unstable/org.matrix.msc4143/rtc/transports
   * VoiceManager 无此方法（MSC4143 unstable 端点），保留 http.authedRequest 直连。
   * 失败时返回空对象，调用方按无 RTC 能力处理。
   */
  async getRtcTransports(): Promise<Record<string, unknown>> {
    try {
      const client = this.getClient()
      const result = await client.http.authedRequest('GET', MATRIX_PATHS.VOICE.RTC_TRANSPORTS)
      return result as Record<string, unknown>
    } catch (err) {
      logger.warn(`[MatrixVoiceService] getRtcTransports failed: ${err}`)
      return {}
    }
  }
}

export const matrixVoiceService = new MatrixVoiceService()

export function isVoiceMessageResult(value: unknown): value is VoiceMessageResult {
  return isObject(value) && typeof value.filename === 'string'
}

export default matrixVoiceService
