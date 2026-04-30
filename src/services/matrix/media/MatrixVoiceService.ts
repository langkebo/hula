import { error as logError } from '@tauri-apps/plugin-log'
import type { MatrixClient } from 'matrix-js-sdk'
import matrixClientService from '../MatrixClientService'

interface VoiceUploadParams {
  roomId: string
  file: Blob | File
  filename: string
}

interface VoiceUploadManagerResult {
  eventId?: string
  url?: string
}

interface VoiceInfoManagerResult {
  duration?: number
  waveform?: number[]
}

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

interface VoiceMessageManagerLike {
  uploadVoiceMessage(params: VoiceUploadParams): Promise<VoiceUploadManagerResult>
  getVoiceMessageInfo(roomId: string, eventId: string): Promise<VoiceInfoManagerResult | null>
  transcribeVoiceMessage(params: VoiceTranscriptionParams): Promise<VoiceTranscriptionResult>
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

class MatrixVoiceService {
  public voiceManager: VoiceMessageManagerLike | null = null
  private observedClient: MatrixClient | null = null

  private getClient(): MxcHttpClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('MatrixClient 未初始化')
    }
    return client as MxcHttpClient
  }

  private getVoiceManager(): VoiceMessageManagerLike {
    const client = this.getClient() as MatrixClient & {
      getVoiceMessageManager?: () => VoiceMessageManagerLike | null
      voiceMessageManager?: VoiceMessageManagerLike | null
    }

    if (this.voiceManager && this.observedClient === client) {
      return this.voiceManager
    }

    const manager = client.getVoiceMessageManager?.() ?? client.voiceMessageManager ?? null
    if (!manager) {
      throw new Error('VoiceMessageManager 不可用')
    }

    this.observedClient = client
    this.voiceManager = manager
    return manager
  }

  private resolveHttpUrl(mxcUrl?: string): string | undefined {
    if (!mxcUrl) {
      return undefined
    }

    const client = this.getClient()
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
    try {
      const manager = this.getVoiceManager()
      const result = await manager.uploadVoiceMessage({
        roomId,
        file,
        filename
      })

      const mxcUrl = result.url
      return {
        eventId: result.eventId,
        url: result.url,
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
    try {
      const manager = this.getVoiceManager()
      const client = this.getClient()
      const info = await manager.getVoiceMessageInfo(roomId, eventId)
      const room = client.getRoom(roomId) as RoomLike | null
      const event = room?.findEventById?.(eventId) ?? null
      const content = event?.getContent?.()
      const mxcUrl = content?.url

      return {
        duration: info?.duration,
        waveform: info?.waveform,
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
      const manager = this.getVoiceManager()
      return await manager.transcribeVoiceMessage(params)
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
      throw new Error('MatrixClient 未初始化')
    }

    try {
      const path = roomId
        ? `/_matrix/client/v1/voice/room/${encodeURIComponent(roomId)}/stats`
        : '/_matrix/client/v1/voice/stats'
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
      throw new Error('MatrixClient 未初始化')
    }

    try {
      const result = (await client.http.authedRequest(
        'GET',
        `/_matrix/client/v1/voice/user/${encodeURIComponent(userId)}/stats`
      )) as Record<string, unknown>
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
      throw new Error('MatrixClient 未初始化')
    }

    try {
      const result = (await client.http.authedRequest('GET', '/_matrix/client/v1/voice/config')) as Record<
        string,
        unknown
      >
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
      throw new Error('MatrixClient 未初始化')
    }
    try {
      await client.http.authedRequest('DELETE', `/_matrix/client/v1/voice/${encodeURIComponent(messageId)}`)
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
      throw new Error('MatrixClient 未初始化')
    }

    try {
      const result = (await client.http.authedRequest(
        'GET',
        `/_matrix/client/v1/voice/room/${encodeURIComponent(roomId)}?limit=${limit}&offset=${offset}`
      )) as Record<string, unknown>
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
      throw new Error('MatrixClient 未初始化')
    }

    try {
      const result = (await client.http.authedRequest(
        'GET',
        `/_matrix/client/v1/voice/user/${encodeURIComponent(userId)}?limit=${limit}&offset=${offset}`
      )) as Record<string, unknown>
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
      throw new Error('MatrixClient 未初始化')
    }

    try {
      const result = await client.http.authedRequest('GET', `/_matrix/client/v1/voice/${encodeURIComponent(messageId)}`)
      return result as Record<string, unknown>
    } catch {
      return null
    }
  }

  async convertVoice(messageId: string, targetFormat: string): Promise<{ url: string; format: string } | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('MatrixClient 未初始化')
    }

    try {
      const result = (await client.http.authedRequest('POST', '/_matrix/client/v1/voice/convert', undefined, {
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
      throw new Error('MatrixClient 未初始化')
    }

    try {
      const body: Record<string, unknown> = { message_id: messageId }
      if (options?.bitrate) body.bitrate = options.bitrate
      if (options?.sample_rate) body.sample_rate = options.sample_rate

      const result = (await client.http.authedRequest(
        'POST',
        '/_matrix/client/v1/voice/optimize',
        undefined,
        body
      )) as Record<string, unknown>
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
      throw new Error('MatrixClient 未初始化')
    }

    try {
      const body: Record<string, unknown> = { message_id: messageId }
      if (lang) body.lang = lang

      const result = (await client.http.authedRequest(
        'POST',
        '/_matrix/client/v1/voice/transcription',
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
