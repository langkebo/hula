/**
 * FT-113: MatrixVoiceService 系统性吞错返回空值
 *
 * 验证关键方法（upload / delete / config）在端点不可用或 HTTP 失败时
 * 将错误抛给调用方，而不是静默返回空值/默认值。
 *
 * 这些测试与 MatrixVoiceService.test.ts 互补：前者验证成功路径，
 * 此文件专门覆盖错误传播路径。
 */
import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

const endpointCheckMock = vi.fn()

vi.mock('../../EndpointCapabilityService', () => ({
  default: {
    check: (...args: unknown[]) => endpointCheckMock(...args)
  }
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

const authedRequestMock = vi.fn()

const mockClient = {
  http: {
    authedRequest: authedRequestMock
  },
  mxcUrlToHttp: vi.fn((mxcUrl: string) => `https://cdn.example.com/${mxcUrl.replace('mxc://', '')}`),
  getRoom: vi.fn(() => null)
}

const { matrixVoiceService } = await import('../MatrixVoiceService')

describe('MatrixVoiceService error propagation (FT-113)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as unknown as MatrixClient)
    endpointCheckMock.mockResolvedValue(true)
    authedRequestMock.mockResolvedValue({})
  })

  describe('deleteVoice', () => {
    it('throws when the voice delete endpoint is unavailable instead of silently returning', async () => {
      endpointCheckMock.mockResolvedValueOnce(false)

      // 当前实现静默 return；修复后应抛出，让 UI 能感知删除未执行。
      await expect(matrixVoiceService.deleteVoice('$msg-1')).rejects.toThrow(
        'matrix_error.media.voice_message_manager_unavailable'
      )
      expect(authedRequestMock).not.toHaveBeenCalled()
    })

    it('propagates HTTP errors from the delete endpoint instead of swallowing them', async () => {
      authedRequestMock.mockRejectedValueOnce(new Error('HTTP 403'))

      await expect(matrixVoiceService.deleteVoice('$msg-1')).rejects.toThrow('HTTP 403')
    })
  })

  describe('getVoiceConfig', () => {
    it('throws when the voice config endpoint is unavailable instead of returning silent defaults', async () => {
      endpointCheckMock.mockResolvedValueOnce(false)

      // 当前实现返回默认配置 {maxDuration:300,...}；修复后应抛出，
      // 让调用方明确知道配置端点不可用，而不是把降级值当成真实配置使用。
      await expect(matrixVoiceService.getVoiceConfig()).rejects.toThrow(
        'matrix_error.media.voice_message_manager_unavailable'
      )
      expect(authedRequestMock).not.toHaveBeenCalled()
    })

    it('propagates HTTP errors from the config endpoint instead of returning silent defaults', async () => {
      authedRequestMock.mockRejectedValueOnce(new Error('HTTP 500'))

      await expect(matrixVoiceService.getVoiceConfig()).rejects.toThrow('HTTP 500')
    })

    it('still returns parsed config on the success path', async () => {
      authedRequestMock.mockResolvedValueOnce({
        max_duration: 600,
        allowed_formats: ['audio/webm'],
        auto_transcribe: true
      })

      const result = await matrixVoiceService.getVoiceConfig()

      expect(result).toEqual({ maxDuration: 600, allowedFormats: ['audio/webm'], autoTranscribe: true })
    })
  })

  describe('uploadVoice', () => {
    it('propagates HTTP errors from the upload endpoint', async () => {
      authedRequestMock.mockRejectedValueOnce(new Error('HTTP 401'))

      await expect(
        matrixVoiceService.uploadVoice('!room:example.org', new Blob(['bytes']), 'voice.webm')
      ).rejects.toThrow('HTTP 401')
    })
  })
})
