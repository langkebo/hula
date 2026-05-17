import { error as logError, warn as logWarn } from '@tauri-apps/plugin-log'
import { BaseMatrixService } from '../BaseMatrixService'
import endpointCapabilityService from '../EndpointCapabilityService'
import matrixClientService from '../MatrixClientService'
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

class MatrixVoiceService extends BaseMatrixService {
  private getVoiceClient(): MxcHttpClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.matrix_client_not_initialized'))
    }
    return client as MxcHttpClient
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
    } catch {
      return fallbackUrl ?? sourceUrl
    }
  }

  async uploadVoice(roomId: string, file: Blob | File, filename = 'voice.webm'): Promise<VoiceMessageResult> {
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

      const result = (await client.http.authedRequest(
        'POST',
        path,
        undefined,
        formData as unknown as Record<string, unknown>
      )) as Record<string, unknown>

      const mxcUrl = (result.url as string) ?? (result.content_uri as string)
      return {
        eventId: (result.event_id as string) ?? (result.eventId as string),
        url: mxcUrl,
        filename,
        mxcUrl,
        httpUrl: this.resolveHttpUrl(mxcUrl)
      }
    } catch (err) {
      logError(`[MatrixVoiceService] 上传语音失败: ${err}`)
      throw err
    }
  }

  async getVoice(roomId: string, eventId: string): Promise<VoicePlaybackInfo | null> {
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
      logError(`[MatrixVoiceService] 获取语音信息失败: ${roomId}/${eventId} ${err}`)
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
      logError(`[MatrixVoiceService] 语音转文字失败: ${params.eventId} ${err}`)
      throw err
    }
  }

  async getVoiceStats(roomId?: string): Promise<{
    totalDuration: number
    totalMessages: number
    averageDuration: number
  }> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.matrix_client_not_initialized'))
    }

    try {
      const path = roomId ? MATRIX_PATHS.VOICE.ROOM_STATS(roomId) : MATRIX_PATHS.VOICE.STATS
      const available = await endpointCapabilityService.check('GET', path)
      if (!available) {
        logWarn('[MatrixVoiceService] 语音统计端点不可用')
        return { totalDuration: 0, totalMessages: 0, averageDuration: 0 }
      }

      const result = (await client.http.authedRequest('GET', path)) as Record<string, unknown>
      return {
        totalDuration: (result.total_duration as number) ?? 0,
        totalMessages: (result.total_messages as number) ?? 0,
        averageDuration: (result.average_duration as number) ?? 0
      }
    } catch {
      return { totalDuration: 0, totalMessages: 0, averageDuration: 0 }
    }
  }

  async getUserVoiceStats(userId: string): Promise<{
    totalDuration: number
    totalMessages: number
  }> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.matrix_client_not_initialized'))
    }

    try {
      const path = MATRIX_PATHS.VOICE.USER_STATS(userId)
      const available = await endpointCapabilityService.check('GET', path)
      if (!available) {
        logWarn('[MatrixVoiceService] 用户语音统计端点不可用')
        return { totalDuration: 0, totalMessages: 0 }
      }

      const result = (await client.http.authedRequest('GET', path)) as Record<string, unknown>
      return {
        totalDuration: (result.total_duration as number) ?? 0,
        totalMessages: (result.total_messages as number) ?? 0
      }
    } catch {
      return { totalDuration: 0, totalMessages: 0 }
    }
  }

  async getVoiceConfig(): Promise<{
    maxDuration: number
    allowedFormats: string[]
    autoTranscribe: boolean
  }> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.matrix_client_not_initialized'))
    }

    try {
      const available = await endpointCapabilityService.check('GET', MATRIX_PATHS.VOICE.CONFIG)
      if (!available) {
        return { maxDuration: 300, allowedFormats: ['audio/webm', 'audio/ogg', 'audio/mp4'], autoTranscribe: false }
      }
      const result = (await client.http.authedRequest('GET', MATRIX_PATHS.VOICE.CONFIG)) as Record<string, unknown>
      return {
        maxDuration: (result.max_duration as number) ?? 300,
        allowedFormats: (result.allowed_formats as string[]) ?? ['audio/webm', 'audio/ogg', 'audio/mp4'],
        autoTranscribe: (result.auto_transcribe as boolean) ?? false
      }
    } catch {
      return { maxDuration: 300, allowedFormats: ['audio/webm', 'audio/ogg', 'audio/mp4'], autoTranscribe: false }
    }
  }

  async deleteVoice(messageId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.matrix_client_not_initialized'))
    }
    try {
      const path = MATRIX_PATHS.VOICE.CONTENT(messageId)
      const available = await endpointCapabilityService.check('DELETE', path)
      if (!available) {
        logWarn('[MatrixVoiceService] 语音删除端点不可用')
        return
      }
      await client.http.authedRequest('DELETE', path)
    } catch (err) {
      logError(`[MatrixVoiceService] 删除语音失败: ${messageId} ${err}`)
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
      const result = (await client.http.authedRequest('GET', `${path}?limit=${limit}&offset=${offset}`)) as Record<
        string,
        unknown
      >
      return {
        voices:
          (result.voices as Array<{ event_id: string; sender: string; duration: number; timestamp: number }>) ?? [],
        total: (result.total as number) ?? 0
      }
    } catch {
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
      const result = (await client.http.authedRequest('GET', `${path}?limit=${limit}&offset=${offset}`)) as Record<
        string,
        unknown
      >
      return {
        voices:
          (result.voices as Array<{ event_id: string; room_id: string; duration: number; timestamp: number }>) ?? [],
        total: (result.total as number) ?? 0
      }
    } catch {
      return { voices: [], total: 0 }
    }
  }

  async getVoiceContent(messageId: string): Promise<Record<string, unknown> | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.matrix_client_not_initialized'))
    }

    try {
      const path = MATRIX_PATHS.VOICE.CONTENT(messageId)
      const available = await endpointCapabilityService.check('GET', path)
      if (!available) {
        return null
      }
      const result = await client.http.authedRequest('GET', path)
      return result as Record<string, unknown>
    } catch {
      return null
    }
  }

  async convertVoice(messageId: string, targetFormat: string): Promise<{ url: string; format: string } | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.matrix_client_not_initialized'))
    }

    try {
      const available = await endpointCapabilityService.check('POST', MATRIX_PATHS.VOICE.CONVERT)
      if (!available) {
        logWarn('[MatrixVoiceService] 语音转换端点不可用')
        return null
      }

      const result = (await client.http.authedRequest('POST', MATRIX_PATHS.VOICE.CONVERT, undefined, {
        message_id: messageId,
        target_format: targetFormat
      })) as Record<string, unknown>
      return { url: (result.url as string) ?? '', format: (result.format as string) ?? targetFormat }
    } catch {
      return null
    }
  }

  async optimizeVoice(
    messageId: string,
    options?: { bitrate?: number; sample_rate?: number }
  ): Promise<{ url: string; size: number } | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.matrix_client_not_initialized'))
    }

    try {
      const available = await endpointCapabilityService.check('POST', MATRIX_PATHS.VOICE.OPTIMIZE)
      if (!available) {
        logWarn('[MatrixVoiceService] 语音优化端点不可用')
        return null
      }

      const body: Record<string, unknown> = { message_id: messageId }
      if (options?.bitrate) body.bitrate = options.bitrate
      if (options?.sample_rate) body.sample_rate = options.sample_rate

      const result = (await client.http.authedRequest('POST', MATRIX_PATHS.VOICE.OPTIMIZE, undefined, body)) as Record<
        string,
        unknown
      >
      return { url: (result.url as string) ?? '', size: (result.size as number) ?? 0 }
    } catch {
      return null
    }
  }

  async transcribeVoiceViaApi(
    messageId: string,
    lang?: string
  ): Promise<{ text: string; language?: string; confidence?: number } | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.matrix_client_not_initialized'))
    }

    try {
      const available = await endpointCapabilityService.check('POST', MATRIX_PATHS.VOICE.TRANSCRIPTION)
      if (!available) {
        logWarn('[MatrixVoiceService] 语音转文字端点不可用')
        return null
      }

      const body: Record<string, unknown> = { message_id: messageId }
      if (lang) body.lang = lang

      const result = (await client.http.authedRequest(
        'POST',
        MATRIX_PATHS.VOICE.TRANSCRIPTION,
        undefined,
        body
      )) as Record<string, unknown>
      return {
        text: (result.text as string) ?? '',
        language: result.language as string | undefined,
        confidence: result.confidence as number | undefined
      }
    } catch {
      return null
    }
  }
}

export const matrixVoiceService = new MatrixVoiceService()

export function isVoiceMessageResult(value: unknown): value is VoiceMessageResult {
  return isObject(value) && typeof value.filename === 'string'
}

export default matrixVoiceService
