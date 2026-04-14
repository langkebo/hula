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
import type { ExtendedMatrixClientForVoice, VoiceConfigExtended } from '@/types/matrix-api'
import matrixClientService from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'

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

class MatrixVoiceService extends BaseManager {
  private voiceManager: VoiceMessageManager | null = null
  private config: VoiceConfig | null = null
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()

  async initialize(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    const extendedClient = client as unknown as ExtendedMatrixClientForVoice
    this.voiceManager = extendedClient.voiceManager as VoiceMessageManager | null
    if (!this.voiceManager) {
      return
    }

    this.setupEventListeners()
    await this.loadConfig()
    info('[MatrixVoice] VoiceService 初始化完成')
  }

  private setupEventListeners(): void {
    if (!this.voiceManager) return

    this.voiceManager.on(VoiceEvent.UploadComplete, (_roomId: string, result: VoiceMessageUploadResult) => {
      this.emit('voiceUploaded', result)
      info(`[MatrixVoice] 语音上传完成: ${result.eventId}`)
    })

    this.voiceManager.on(VoiceEvent.UploadError, (_roomId: string, error: Error) => {
      this.emit('voiceUploadError', error)
      info(`[MatrixVoice] 语音上传失败: ${error.message}`)
    })
  }

  private async loadConfig(): Promise<void> {
    if (!this.voiceManager) return

    try {
      this.config = this.voiceManager.getConfig() ?? null
      info('[MatrixVoice] 加载语音配置成功')
    } catch (_err) {}
  }

  getConfig(): VoiceConfig | null {
    return this.config
  }

  async uploadVoice(roomId: string, file: File | Blob, throwOnError = false): Promise<{ content_uri: string }> {
    try {
      if (!this.voiceManager) {
        throw new Error('VoiceManager 未初始化')
      }
      const fileName = file instanceof File ? file.name : 'voice.webm'
      const result = await this.voiceManager.uploadVoiceMessage({
        roomId: roomId,
        file: file,
        filename: fileName
      })
      info(`[MatrixVoice] 上传语音成功`)
      return { content_uri: result.url || result.eventId ? `mxc://${roomId}/${result.eventId}` : '' }
    } catch (error) {
      return this.handleError(error, 'uploadVoice', { content_uri: '' }, throwOnError)
    }
  }

  async getVoice(roomId: string, messageId: string, throwOnError = true): Promise<any | null> {
    if (!this.voiceManager) return null

    try {
      const voice = await this.voiceManager.getVoiceMessageInfo(roomId, messageId)
      return voice
    } catch (error) {
      return this.handleError(error, 'getVoice', null, throwOnError)
    }
  }

  async deleteVoice(roomId: string, messageId: string, throwOnError = false): Promise<void> {
    try {
      if (!this.voiceManager) {
        throw new Error('VoiceMessageManager 未初始化')
      }
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
    } catch (error) {
      this.handleError(error, 'deleteVoice', undefined, throwOnError)
    }
  }

  async getUserVoices(roomId: string, userId: string, throwOnError = true): Promise<VoiceMessage[]> {
    if (!this.voiceManager) return []

    try {
      if (this.voiceManager.getUserVoices) {
        return (await this.voiceManager.getUserVoices(roomId, userId)) as VoiceMessage[]
      }
      return []
    } catch (error) {
      return this.handleError(error, 'getUserVoices', [] as VoiceMessage[], throwOnError)
    }
  }

  async getRoomVoices(roomId: string, throwOnError = true): Promise<VoiceMessageInfo[]> {
    try {
      if (!this.voiceManager) {
        throw new Error('VoiceMessageManager 未初始化')
      }
      if (this.voiceManager.getRoomVoices) {
        const voices = await this.voiceManager.getRoomVoices(roomId)
        info(`[MatrixVoice] 获取房间语音列表成功: ${roomId}, 数量: ${voices.length}`)
        return voices
      }
      return []
    } catch (error) {
      return this.handleError(error, 'getRoomVoices', [] as VoiceMessageInfo[], throwOnError)
    }
  }

  async getMyStats(roomId: string, throwOnError = true): Promise<VoiceStats | null> {
    if (!this.voiceManager) return null

    try {
      const stats = await this.voiceManager.getVoiceStats(roomId)
      return stats
    } catch (error) {
      return this.handleError(error, 'getMyStats', null, throwOnError)
    }
  }

  async getUserStats(roomId: string, userId: string, throwOnError = true): Promise<VoiceStats | null> {
    if (!this.voiceManager) return null

    try {
      if (this.voiceManager.getUserStats) {
        const stats = await this.voiceManager.getUserStats(roomId, userId)
        return stats
      }
      return await this.voiceManager.getVoiceStats(roomId)
    } catch (error) {
      return this.handleError(error, 'getUserStats', null, throwOnError)
    }
  }

  async convertVoice(_roomId: string, eventId: string, params?: { target_format: string }, throwOnError = true): Promise<any | null> {
    if (!this.voiceManager) return null

    try {
      const result = await this.voiceManager.convertVoiceMessage({
        messageId: eventId,
        outputFormat: params?.target_format
      })
      return result
    } catch (error) {
      return this.handleError(error, 'convertVoice', null, throwOnError)
    }
  }

  async optimizeVoice(_roomId: string, eventId: string, targetSizeKb?: number, throwOnError = true): Promise<any | null> {
    if (!this.voiceManager) return null

    try {
      const result = await this.voiceManager.optimizeVoiceMessage({
        messageId: eventId,
        targetSizeKb
      })
      return result
    } catch (error) {
      return this.handleError(error, 'optimizeVoice', null, throwOnError)
    }
  }

  async transcribeVoice(eventId?: string, mxc?: string, throwOnError = true): Promise<any> {
    if (!this.voiceManager) return null
    try {
      return await this.voiceManager.transcribeVoiceMessage({ eventId, mxc })
    } catch (error) {
      return this.handleError(error, 'transcribeVoice', null, throwOnError)
    }
  }

  isFormatSupported(format: string): boolean {
    if (!this.config) {
      return true
    }
    const extendedConfig = this.config as unknown as VoiceConfigExtended
    const supportedFormats = extendedConfig.supported_formats || []
    if (supportedFormats.length === 0) {
      return true
    }
    return supportedFormats.includes(format.toLowerCase())
  }

  validateVoiceSize(sizeBytes: number): boolean {
    if (!this.config) {
      return true
    }
    const extendedConfig = this.config as unknown as VoiceConfigExtended
    const maxSizeBytes = extendedConfig.max_size_bytes || 0
    if (maxSizeBytes === 0) {
      return true
    }
    return sizeBytes <= maxSizeBytes
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
