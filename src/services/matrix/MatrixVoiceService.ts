import {
  type VoiceMessageManager,
  VoiceEvent,
  type VoiceMessageUploadResult,
  type VoiceConfig,
  type VoiceStats,
  type VoiceMessageUploadParams,
  type VoiceMessage,
  type VoiceMessageInfo,
  type VoiceConvertParams,
  type VoiceConvertResult,
  type VoiceOptimizeParams,
  type VoiceOptimizeResult,
  type VoiceTranscriptionParams,
  type VoiceTranscriptionResult
} from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export type {
  VoiceConfig,
  VoiceMessageUploadParams,
  VoiceMessageUploadResult,
  VoiceMessage,
  VoiceMessageInfo,
  VoiceStats,
  VoiceConvertParams,
  VoiceConvertResult,
  VoiceOptimizeParams,
  VoiceOptimizeResult,
  VoiceTranscriptionParams,
  VoiceTranscriptionResult
}

export interface VoiceUploadProgress {
  loaded: number
  total: number
  percentage: number
}

class MatrixVoiceService {
  private voiceManager: VoiceMessageManager | null = null
  private config: VoiceConfig | null = null
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()

  async initialize(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    this.voiceManager = (client as any).voiceManager as VoiceMessageManager
    if (!this.voiceManager) {
      error('[MatrixVoice] VoiceMessageManager 未在客户端上找到')
      return
    }

    this.setupEventListeners()
    await this.loadConfig()
    info('[MatrixVoice] VoiceService 初始化完成')
  }

  private setupEventListeners(): void {
    if (!this.voiceManager) return

    this.voiceManager.on(VoiceEvent.UploadComplete, (roomId: string, result: VoiceMessageUploadResult) => {
      this.emit('voiceUploaded', result)
      info(`[MatrixVoice] 语音上传完成: ${result.eventId}`)
    })

    this.voiceManager.on(VoiceEvent.UploadError, (roomId: string, error: Error) => {
      this.emit('voiceUploadError', error)
      info(`[MatrixVoice] 语音上传失败: ${error.message}`)
    })
  }

  private async loadConfig(): Promise<void> {
    if (!this.voiceManager) return

    try {
      this.config = this.voiceManager.getConfig() ?? null
      info('[MatrixVoice] 加载语音配置成功')
    } catch (err) {
      error(`[MatrixVoice] 加载语音配置失败: ${err}`)
    }
  }

  getConfig(): VoiceConfig | null {
    return this.config
  }

  async uploadVoice(roomId: string, file: File | Blob): Promise<{ content_uri: string }> {
    if (!this.voiceManager) {
      throw new Error('VoiceManager 未初始化')
    }

    try {
      const fileName = file instanceof File ? file.name : 'voice.webm'
      const result = await this.voiceManager.uploadVoiceMessage({
        roomId: roomId,
        file: file,
        filename: fileName
      })
      info(`[MatrixVoice] 上传语音成功`)
      return { content_uri: result.url || result.eventId ? `mxc://${roomId}/${result.eventId}` : '' }
    } catch (err) {
      error(`[MatrixVoice] 上传语音失败: ${err}`)
      throw err
    }
  }

  async getVoice(roomId: string, messageId: string): Promise<any | null> {
    if (!this.voiceManager) return null

    try {
      const voice = await this.voiceManager.getVoiceMessageInfo(roomId, messageId)
      return voice
    } catch (err) {
      error(`[MatrixVoice] 获取语音失败: ${err}`)
      return null
    }
  }

  async deleteVoice(roomId: string, messageId: string): Promise<void> {
    if (!this.voiceManager) {
      throw new Error('VoiceMessageManager 未初始化')
    }

    try {
      if (this.voiceManager.deleteVoice) {
        await this.voiceManager.deleteVoice(roomId, messageId)
      } else {
        info(`[MatrixVoice] SDK doesn't support deleteVoice, fallback to redact event`)
        const client = matrixClientService.getClient()
        if (client) {
          await client.redactEvent(roomId, messageId)
        }
      }
      info(`[MatrixVoice] 删除语音成功: ${messageId}`)
    } catch (err) {
      error(`[MatrixVoice] 删除语音失败: ${err}`)
      throw err
    }
  }

  async getUserVoices(roomId: string, userId: string): Promise<VoiceMessage[]> {
    if (!this.voiceManager) return []

    try {
      if (this.voiceManager.getUserVoices) {
        return await this.voiceManager.getUserVoices(roomId, userId) as any
      }
      return []
    } catch (err) {
      error(`[MatrixVoice] 获取用户语音失败: ${err}`)
      return []
    }
  }

  async getRoomVoices(roomId: string): Promise<VoiceMessageInfo[]> {
    if (!this.voiceManager) {
      throw new Error('VoiceMessageManager 未初始化')
    }

    try {
      if (this.voiceManager.getRoomVoices) {
        const voices = await this.voiceManager.getRoomVoices(roomId)
        info(`[MatrixVoice] 获取房间语音列表成功: ${roomId}, 数量: ${voices.length}`)
        return voices
      }
      return []
    } catch (err) {
      error(`[MatrixVoice] 获取房间语音列表失败: ${err}`)
      throw err
    }
  }

  async getMyStats(roomId: string): Promise<VoiceStats | null> {
    if (!this.voiceManager) return null

    try {
      const stats = await this.voiceManager.getVoiceStats(roomId)
      return stats
    } catch (err) {
      error(`[MatrixVoice] 获取自身语音统计失败: ${err}`)
      return null
    }
  }

  async getUserStats(roomId: string, userId: string): Promise<VoiceStats | null> {
    if (!this.voiceManager) return null

    try {
      if (this.voiceManager.getUserStats) {
        const stats = await this.voiceManager.getUserStats(roomId, userId)
        return stats
      }
      return await this.voiceManager.getVoiceStats(roomId)
    } catch (err) {
      error(`[MatrixVoice] 获取用户语音统计失败: ${err}`)
      return null
    }
  }

  async convertVoice(roomId: string, eventId: string, params?: { target_format: string }): Promise<any | null> {
    if (!this.voiceManager) return null

    try {
      const result = await this.voiceManager.convertVoiceMessage({
        inputUrl: `mxc://${roomId}/${eventId}`,
        outputFormat: params?.target_format
      } as VoiceConvertParams)
      return result
    } catch (err) {
      error(`[MatrixVoice] 转换语音格式失败: ${err}`)
      return null
    }
  }

  async optimizeVoice(roomId: string, eventId: string, targetFormat?: string): Promise<any | null> {
    if (!this.voiceManager) return null

    try {
      const result = await this.voiceManager.optimizeVoiceMessage({
        inputUrl: `mxc://${roomId}/${eventId}`
      } as VoiceOptimizeParams)
      return result
    } catch (err) {
      error(`[MatrixVoice] 优化语音失败: ${err}`)
      return null
    }
  }

  async transcribeVoice(params: any): Promise<any> {
    if (!this.voiceManager) return null
    try {
      return await this.voiceManager.transcribeVoiceMessage(params)
    } catch (err) {
      error(`[MatrixVoice] 提取语音文本失败: ${err}`)
      return null
    }
  }

  isFormatSupported(format: string): boolean {
    return true // Fallback, config doesn't have supported_formats
  }

  validateVoiceSize(sizeBytes: number): boolean {
    return true // Fallback, config doesn't have max_size_bytes
  }

  validateVoiceDuration(durationMs: number): boolean {
    if (!this.config?.maxDuration) return true
    return durationMs <= this.config.maxDuration
  }

  stop(): void {
    if (this.voiceManager) {
      this.voiceManager.removeAllListeners()
      this.voiceManager = null
    }
    this.config = null
    this.eventListeners.clear()
    info('[MatrixVoice] VoiceService 已停止')
  }

  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  private emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }
  }
}

export const matrixVoiceService = new MatrixVoiceService()
export default matrixVoiceService
