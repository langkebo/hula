import {
  VoiceMessageManager,
  VoiceEvent,
  type VoiceConfig,
  type VoiceMessageUploadParams,
  type VoiceMessageUploadResult,
  type VoiceMessage,
  type VoiceMessageInfo,
  type VoiceStats,
  type VoiceConvertParams,
  type VoiceConvertResult,
  type VoiceOptimizeParams,
  type VoiceOptimizeResult,
  type VoiceTranscriptionParams,
  type VoiceTranscriptionResult
} from 'matrix-js-sdk/voice'
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

    this.voiceManager.on(VoiceEvent.VoiceUploaded, (result: VoiceMessageUploadResult) => {
      this.emit('voiceUploaded', result)
      info(`[MatrixVoice] 语音上传完成: ${result.message_id}`)
    })

    this.voiceManager.on(VoiceEvent.VoiceDeleted, (messageId: string) => {
      this.emit('voiceDeleted', messageId)
      info(`[MatrixVoice] 语音删除: ${messageId}`)
    })

    this.voiceManager.on(VoiceEvent.VoiceConverted, (result: VoiceConvertResult) => {
      this.emit('voiceConverted', result)
      info(`[MatrixVoice] 语音转换完成: ${result.message_id}`)
    })

    this.voiceManager.on(VoiceEvent.VoiceOptimized, (result: VoiceOptimizeResult) => {
      this.emit('voiceOptimized', result)
      info(`[MatrixVoice] 语音优化完成: ${result.message_id}`)
    })
  }

  private async loadConfig(): Promise<void> {
    if (!this.voiceManager) return

    try {
      this.config = await this.voiceManager.getConfig()
      info('[MatrixVoice] 加载语音配置成功')
    } catch (err) {
      error(`[MatrixVoice] 加载语音配置失败: ${err}`)
    }
  }

  getConfig(): VoiceConfig | null {
    return this.config
  }

  async uploadVoice(
    params: VoiceMessageUploadParams,
    onProgress?: (progress: VoiceUploadProgress) => void
  ): Promise<VoiceMessageUploadResult> {
    if (!this.voiceManager) {
      throw new Error('VoiceMessageManager 未初始化')
    }

    try {
      if (onProgress) {
        onProgress({ loaded: 0, total: 100, percentage: 0 })
      }

      const result = await this.voiceManager.uploadVoice(params)

      if (onProgress) {
        onProgress({ loaded: 100, total: 100, percentage: 100 })
      }

      info(`[MatrixVoice] 上传语音成功: ${result.message_id}`)
      return result
    } catch (err) {
      error(`[MatrixVoice] 上传语音失败: ${err}`)
      throw err
    }
  }

  async getVoice(messageId: string): Promise<VoiceMessage> {
    if (!this.voiceManager) {
      throw new Error('VoiceMessageManager 未初始化')
    }

    try {
      const voice = await this.voiceManager.getVoice(messageId)
      info(`[MatrixVoice] 获取语音成功: ${messageId}`)
      return voice
    } catch (err) {
      error(`[MatrixVoice] 获取语音失败: ${err}`)
      throw err
    }
  }

  async deleteVoice(messageId: string): Promise<{ deleted: boolean; message_id: string }> {
    if (!this.voiceManager) {
      throw new Error('VoiceMessageManager 未初始化')
    }

    try {
      const result = await this.voiceManager.deleteVoice(messageId)
      info(`[MatrixVoice] 删除语音成功: ${messageId}`)
      return result
    } catch (err) {
      error(`[MatrixVoice] 删除语音失败: ${err}`)
      throw err
    }
  }

  async getUserVoices(userId: string): Promise<VoiceMessageInfo[]> {
    if (!this.voiceManager) {
      throw new Error('VoiceMessageManager 未初始化')
    }

    try {
      const voices = await this.voiceManager.getUserVoices(userId)
      info(`[MatrixVoice] 获取用户语音列表成功: ${userId}, 数量: ${voices.length}`)
      return voices
    } catch (err) {
      error(`[MatrixVoice] 获取用户语音列表失败: ${err}`)
      throw err
    }
  }

  async getRoomVoices(roomId: string): Promise<VoiceMessageInfo[]> {
    if (!this.voiceManager) {
      throw new Error('VoiceMessageManager 未初始化')
    }

    try {
      const voices = await this.voiceManager.getRoomVoices(roomId)
      info(`[MatrixVoice] 获取房间语音列表成功: ${roomId}, 数量: ${voices.length}`)
      return voices
    } catch (err) {
      error(`[MatrixVoice] 获取房间语音列表失败: ${err}`)
      throw err
    }
  }

  async getMyStats(): Promise<VoiceStats> {
    if (!this.voiceManager) {
      throw new Error('VoiceMessageManager 未初始化')
    }

    try {
      const stats = await this.voiceManager.getMyStats()
      info(`[MatrixVoice] 获取我的语音统计成功`)
      return stats
    } catch (err) {
      error(`[MatrixVoice] 获取我的语音统计失败: ${err}`)
      throw err
    }
  }

  async getUserStats(userId: string): Promise<VoiceStats> {
    if (!this.voiceManager) {
      throw new Error('VoiceMessageManager 未初始化')
    }

    try {
      const stats = await this.voiceManager.getUserStats(userId)
      info(`[MatrixVoice] 获取用户语音统计成功: ${userId}`)
      return stats
    } catch (err) {
      error(`[MatrixVoice] 获取用户语音统计失败: ${err}`)
      throw err
    }
  }

  async convertVoice(params: VoiceConvertParams): Promise<VoiceConvertResult> {
    if (!this.voiceManager) {
      throw new Error('VoiceMessageManager 未初始化')
    }

    try {
      const result = await this.voiceManager.convertVoice(params)
      info(`[MatrixVoice] 转换语音成功: ${params.message_id} -> ${params.target_format}`)
      return result
    } catch (err) {
      error(`[MatrixVoice] 转换语音失败: ${err}`)
      throw err
    }
  }

  async optimizeVoice(params: VoiceOptimizeParams): Promise<VoiceOptimizeResult> {
    if (!this.voiceManager) {
      throw new Error('VoiceMessageManager 未初始化')
    }

    try {
      const result = await this.voiceManager.optimizeVoice(params)
      info(`[MatrixVoice] 优化语音成功: ${params.message_id}`)
      return result
    } catch (err) {
      error(`[MatrixVoice] 优化语音失败: ${err}`)
      throw err
    }
  }

  async transcribeVoice(params: VoiceTranscriptionParams): Promise<VoiceTranscriptionResult> {
    if (!this.voiceManager) {
      throw new Error('VoiceMessageManager 未初始化')
    }

    try {
      const result = await this.voiceManager.transcribeVoice(params)
      info(`[MatrixVoice] 语音转文字成功`)
      return result
    } catch (err) {
      error(`[MatrixVoice] 语音转文字失败: ${err}`)
      throw err
    }
  }

  isFormatSupported(format: string): boolean {
    if (!this.config) return false
    return this.config.supported_formats.includes(format)
  }

  validateVoiceSize(sizeBytes: number): boolean {
    if (!this.config) return true
    return sizeBytes <= this.config.max_size_bytes
  }

  validateVoiceDuration(durationMs: number): boolean {
    if (!this.config) return true
    return durationMs <= this.config.max_duration_ms
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
