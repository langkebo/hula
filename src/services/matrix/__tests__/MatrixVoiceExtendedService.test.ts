import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../MatrixClientService'
import { matrixVoiceService } from '../media/MatrixVoiceService'

vi.mock('../MatrixClientService', () => {
  const getClient = vi.fn()
  return {
    default: { getClient },
    matrixClientService: { getClient }
  }
})

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixVoiceService - Extended Features', () => {
  let mockClient: Partial<MatrixClient>
  let mockHttp: { authedRequest: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockHttp = {
      authedRequest: vi.fn()
    }

    mockClient = {
      http: mockHttp as unknown as MatrixClient['http']
    }

    vi.mocked(matrixClientService.getClient).mockReset()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as MatrixClient)
  })

  describe('getVoiceStats', () => {
    it('should return voice stats for all rooms', async () => {
      mockHttp.authedRequest.mockResolvedValue({
        total_duration: 1200,
        total_messages: 50,
        average_duration: 24
      })

      const result = await matrixVoiceService.getVoiceStats()

      expect(result).toEqual({
        totalDuration: 1200,
        totalMessages: 50,
        averageDuration: 24
      })
      expect(mockHttp.authedRequest).toHaveBeenCalledWith('GET', '/_matrix/client/v1/voice/stats')
    })

    it('should return voice stats for specific room', async () => {
      mockHttp.authedRequest.mockResolvedValue({
        total_duration: 300,
        total_messages: 10,
        average_duration: 30
      })

      const _result = await matrixVoiceService.getVoiceStats('!room:example.com')

      expect(mockHttp.authedRequest).toHaveBeenCalledWith(
        'GET',
        expect.stringContaining('/_matrix/client/v1/voice/room/')
      )
    })

    it('should return zeros on error', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('Network error'))

      const result = await matrixVoiceService.getVoiceStats()

      expect(result).toEqual({ totalDuration: 0, totalMessages: 0, averageDuration: 0 })
    })
  })

  describe('getUserVoiceStats', () => {
    it('should return user voice stats', async () => {
      mockHttp.authedRequest.mockResolvedValue({
        total_duration: 500,
        total_messages: 20
      })

      const result = await matrixVoiceService.getUserVoiceStats('@user:example.com')

      expect(result).toEqual({ totalDuration: 500, totalMessages: 20 })
    })

    it('should return zeros on error', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('Network error'))

      const result = await matrixVoiceService.getUserVoiceStats('@user:example.com')

      expect(result).toEqual({ totalDuration: 0, totalMessages: 0 })
    })
  })

  describe('getVoiceConfig', () => {
    it('should return voice config from server', async () => {
      mockHttp.authedRequest.mockResolvedValue({
        max_duration: 600,
        allowed_formats: ['audio/webm', 'audio/ogg'],
        auto_transcribe: true
      })

      const result = await matrixVoiceService.getVoiceConfig()

      expect(result).toEqual({
        maxDuration: 600,
        allowedFormats: ['audio/webm', 'audio/ogg'],
        autoTranscribe: true
      })
    })

    it('should return defaults on error', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('Network error'))

      const result = await matrixVoiceService.getVoiceConfig()

      expect(result.maxDuration).toBe(300)
      expect(result.allowedFormats).toContain('audio/webm')
      expect(result.autoTranscribe).toBe(false)
    })
  })

  describe('deleteVoice', () => {
    it('should delete voice message', async () => {
      mockHttp.authedRequest.mockResolvedValue({})

      await matrixVoiceService.deleteVoice('$event123')

      expect(mockHttp.authedRequest).toHaveBeenCalledWith('DELETE', '/_matrix/client/v1/voice/%24event123')
    })
  })

  describe('getRoomVoiceList', () => {
    it('should return voice list for room', async () => {
      mockHttp.authedRequest.mockResolvedValue({
        voices: [{ event_id: '$e1', sender: '@u1:example.com', duration: 10, timestamp: 1000 }],
        total: 1
      })

      const result = await matrixVoiceService.getRoomVoiceList('!room:example.com')

      expect(result.voices).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('should return empty on error', async () => {
      mockHttp.authedRequest.mockRejectedValue(new Error('error'))

      const result = await matrixVoiceService.getRoomVoiceList('!room:example.com')

      expect(result).toEqual({ voices: [], total: 0 })
    })
  })

  describe('getUserVoiceList', () => {
    it('should return voice list for user', async () => {
      mockHttp.authedRequest.mockResolvedValue({
        voices: [{ event_id: '$e1', room_id: '!r1:example.com', duration: 10, timestamp: 1000 }],
        total: 1
      })

      const result = await matrixVoiceService.getUserVoiceList('@user:example.com')

      expect(result.voices).toHaveLength(1)
      expect(result.total).toBe(1)
    })
  })
})
