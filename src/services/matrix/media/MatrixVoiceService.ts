import type { MatrixClient } from '@/services/matrix/sdk'
import { VendorPrefix } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
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

/**
 * 语音列表行的真实形状。
 *
 * 由 SDK 的 `IVoiceMessage` 派生（`voice_service.rs::record_to_message_json`）：
 * `{ media_id, user_id, room_id, content_uri, content_type, duration_ms, size_bytes, created_ts }`。
 *
 * ⚠️ 此前这里声明的是 `{ event_id, sender, duration, timestamp }` —— 后端从未
 * 返回过这四个字段，调用方读到的永远是 `undefined`。声明式为假却没有触发类型
 * 报错，是因为响应体被 `Record<string, unknown>` + `as` 转换吞掉了。
 */
type VoiceMessageRow = Awaited<ReturnType<VoiceManagerInstance['listRoomVoiceMessages']>>['messages'][number]

/** 列表页游标：后端 `next_batch` 是毫秒 `created_ts`（i64），不是字符串。 */
type VoiceListPage = { messages: VoiceMessageRow[]; next_batch: number | null }

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
   * SDK VoiceManager 默认使用 VendorPrefix（vendor 命名空间），
   * 与后端私有端点命名空间（ISSUE-13）一致。前端统一走 VendorPrefix。
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

  /**
   * 上传语音到后端 `POST /voice/upload`（**明文通道**）。
   *
   * ⚠️ 本方法**不做加密**：加密与否的决策在调用方 `useVoiceInput.uploadVoiceToMatrix`
   * 单点完成——加密房间走 `matrixMediaService.uploadEncryptedFile`（标准 media 上传，
   * 密文以 `application/octet-stream` 落库），明文房间才走这里。
   *
   * 之所以不能让密文走本通道：`/voice/upload` 的 `content_type` 有 `audio/*` 白名单校验
   * （`synapse-services/src/voice_service.rs:7,43-48,81`，`validate_audio_content_type`），
   * 密文只能被错误地标注成 `audio/webm`，而该值会被当作落库 mimetype
   * （`media_service.rs:187-195`，扩展名亦由此推导）并在语音列表行里回显
   * （`voice_service.rs:284,302`）——即"字节与声明不符"，读取方按 mimetype 解码必得垃圾。
   *
   * @param roomId 语音归属房间（作为 media 记录的 `room_id`，非事件房间）
   * @param contentType 原始音频 MIME，必须命中后端白名单
   */
  async uploadVoice(
    roomId: string,
    file: Blob | File,
    filename = 'voice.webm',
    durationMs = 0,
    contentType = 'audio/webm'
  ): Promise<VoiceMessageResult> {
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
      if (roomId) formData.append('room_id', roomId)
      if (durationMs > 0) formData.append('duration_ms', String(durationMs))
      formData.append('content_type', contentType)

      const result = await this.getVoiceMgr().uploadVoiceMessageMultipart({ formData })

      // 后端 upload 响应只有 { content_uri, content, content_type, duration_ms, size }
      // （synapse-services/src/voice_service.rs:130-136），既没有 event_id 也没有 url。
      // 事件 id 由「发送房间事件」那一步产生，上传阶段无法也不应伪造。
      const mxcUrl = result.content_uri
      return {
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
      const result = roomId ? await mgr.getRoomVoiceStats(roomId, VendorPrefix) : await mgr.getVoiceStats(VendorPrefix)
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
      const result = await this.getVoiceMgr().getUserVoiceStats(userId, VendorPrefix)
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
      const result = await this.getVoiceMgr().getVoiceConfig(VendorPrefix)
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
      await this.getVoiceMgr().deleteVoiceMessage(messageId, VendorPrefix)
    } catch (err) {
      logger.error(`[MatrixVoiceService] 删除语音失败: ${messageId} ${err}`)
      throw err
    }
  }

  /**
   * 房间语音列表（keyset 分页）。
   *
   * 收口到 SDK `VoiceManager.listRoomVoiceMessages`：路径、query（`limit`/`from`）
   * 与响应形状都由 SDK 契约层负责，前端不再自己拼 query 字符串。
   *
   * @param offset 上一页返回的 `next_batch`（毫秒 `created_ts` 游标），首页传 0。
   */
  async getRoomVoiceList(roomId: string, limit: number = 50, offset: number = 0): Promise<VoiceListPage> {
    this.requireNonEmpty(roomId, 'roomId')

    try {
      const path = MATRIX_PATHS.VOICE.ROOM_LIST(roomId)
      const available = await endpointCapabilityService.check('GET', path)
      if (!available) {
        return { messages: [], next_batch: null }
      }
      const page = await this.getVoiceMgr().listRoomVoiceMessages(roomId, { limit, from: offset })
      return { messages: page?.messages ?? [], next_batch: page?.next_batch ?? null }
    } catch (err) {
      logger.warn(`[MatrixVoiceService] getRoomVoiceList failed: ${err}`)
      return { messages: [], next_batch: null }
    }
  }

  /**
   * 用户语音列表（keyset 分页）。后端只允许查询调用者本人。
   *
   * @param offset 上一页返回的 `next_batch`（毫秒 `created_ts` 游标），首页传 0。
   */
  async getUserVoiceList(userId: string, limit: number = 50, offset: number = 0): Promise<VoiceListPage> {
    this.requireNonEmpty(userId, 'userId')

    try {
      const path = MATRIX_PATHS.VOICE.USER_LIST(userId)
      const available = await endpointCapabilityService.check('GET', path)
      if (!available) {
        return { messages: [], next_batch: null }
      }
      const page = await this.getVoiceMgr().listUserVoiceMessages(userId, { limit, from: offset })
      return { messages: page?.messages ?? [], next_batch: page?.next_batch ?? null }
    } catch (err) {
      logger.warn(`[MatrixVoiceService] getUserVoiceList failed: ${err}`)
      return { messages: [], next_batch: null }
    }
  }

  async getVoiceContent(messageId: string): Promise<Record<string, unknown> | null> {
    this.requireNonEmpty(messageId, 'messageId')
    try {
      const available = await endpointCapabilityService.check('GET', MATRIX_PATHS.VOICE.CONTENT(messageId))
      if (!available) {
        return null
      }
      const result = await this.getVoiceMgr().getVoiceMessage(messageId, VendorPrefix)
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

      const result = await this.getVoiceMgr().convertVoiceMessage(messageId, { format: targetFormat }, VendorPrefix)
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

      const result = await this.getVoiceMgr().optimizeVoiceMessage(messageId, options ?? {}, VendorPrefix)
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
      const result = await this.getVoiceMgr().transcribeVoiceMessage(messageId, options, VendorPrefix)
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
   * 通过 SDK VoiceManager.getRtcTransports 获取（MSC4143 unstable 端点）。
   * 失败时返回空对象，调用方按无 RTC 能力处理。
   */
  async getRtcTransports(): Promise<Record<string, unknown>> {
    try {
      const client = this.getClient()
      const result = await client.getVoiceManager().getRtcTransports()
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
