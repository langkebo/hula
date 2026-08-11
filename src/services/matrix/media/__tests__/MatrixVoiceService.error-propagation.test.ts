/**
 * FT-113: MatrixVoiceService 系统性吞错返回空值
 *
 * 验证关键方法（upload / delete / config）在端点不可用或 HTTP 失败时
 * 将错误抛给调用方，而不是静默返回空值/默认值。
 *
 * 这些测试与 MatrixVoiceService.test.ts 互补：前者验证成功路径，
 * 此文件专门覆盖错误传播路径。
 *
 * 注：deleteVoice/getVoiceConfig 已迁移到 VoiceManager（Task 5），
 * 这些方法通过 getVoiceMgr() 调用 VoiceManager。uploadVoice 仍走
 * authedRequestWithPath（FormData 上传），保留 authedRequestMock。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'
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

const deleteVoiceMessageMock = vi.fn()
const getVoiceConfigMock = vi.fn()

const voiceMgr = {
  deleteVoiceMessage: deleteVoiceMessageMock,
  getVoiceConfig: getVoiceConfigMock
}

const mockClient = {
  http: {
    authedRequest: authedRequestMock
  },
  mxcUrlToHttp: vi.fn((mxcUrl: string) => `https://cdn.example.com/${mxcUrl.replace('mxc://', '')}`),
  getRoom: vi.fn(() => null),
  getVoiceManager: vi.fn(() => voiceMgr)
}

const { matrixVoiceService } = await import('../MatrixVoiceService')

describe('MatrixVoiceService error propagation (FT-113)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as unknown as MatrixClient)
    endpointCheckMock.mockResolvedValue(true)
    authedRequestMock.mockResolvedValue({})
    deleteVoiceMessageMock.mockResolvedValue({})
    getVoiceConfigMock.mockResolvedValue({})
  })

  describe('deleteVoice via VoiceManager', () => {
    it('throws when the voice delete endpoint is unavailable instead of silently returning', async () => {
      endpointCheckMock.mockResolvedValueOnce(false)

      // 当前实现静默 return；修复后应抛出，让 UI 能感知删除未执行。
      await expect(matrixVoiceService.deleteVoice('$msg-1')).rejects.toThrow(
        'matrix_error.media.voice_message_manager_unavailable'
      )
      expect(deleteVoiceMessageMock).not.toHaveBeenCalled()
    })

    it('propagates VoiceManager errors from deleteVoiceMessage instead of swallowing them', async () => {
      deleteVoiceMessageMock.mockRejectedValueOnce(new Error('HTTP 403'))

      await expect(matrixVoiceService.deleteVoice('$msg-1')).rejects.toThrow('HTTP 403')
    })
  })

  describe('getVoiceConfig via VoiceManager', () => {
    it('throws when the voice config endpoint is unavailable instead of returning silent defaults', async () => {
      endpointCheckMock.mockResolvedValueOnce(false)

      // 当前实现返回默认配置 {maxDuration:300,...}；修复后应抛出，
      // 让调用方明确知道配置端点不可用，而不是把降级值当成真实配置使用。
      await expect(matrixVoiceService.getVoiceConfig()).rejects.toThrow(
        'matrix_error.media.voice_message_manager_unavailable'
      )
      expect(getVoiceConfigMock).not.toHaveBeenCalled()
    })

    it('propagates VoiceManager errors from getVoiceConfig instead of returning silent defaults', async () => {
      getVoiceConfigMock.mockRejectedValueOnce(new Error('HTTP 500'))

      await expect(matrixVoiceService.getVoiceConfig()).rejects.toThrow('HTTP 500')
    })

    it('still returns parsed config on the success path', async () => {
      getVoiceConfigMock.mockResolvedValueOnce({
        max_duration: 600,
        allowed_formats: ['audio/webm'],
        auto_transcribe: true
      })

      const result = await matrixVoiceService.getVoiceConfig()

      expect(result).toEqual({ maxDuration: 600, allowedFormats: ['audio/webm'], autoTranscribe: true })
    })
  })

  describe('uploadVoice (still uses authedRequestWithPath)', () => {
    it('propagates HTTP errors from the upload endpoint', async () => {
      authedRequestMock.mockRejectedValueOnce(new Error('HTTP 401'))

      await expect(
        matrixVoiceService.uploadVoice('!room:example.org', new Blob(['bytes']), 'voice.webm')
      ).rejects.toThrow('HTTP 401')
    })
  })
})
