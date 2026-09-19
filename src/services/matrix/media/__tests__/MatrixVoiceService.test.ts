import type { MatrixClient, Room } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import { matrixAttachmentEncryptionService } from '../../crypto/MatrixAttachmentEncryptionService'
import matrixClientService from '../../MatrixClientService'

const TEST_BASE_URL = 'https://matrix.example.com'

const _server = setupMswServer(
  http.post(`${TEST_BASE_URL}/_matrix/vendor/v1/voice/upload`, () => {
    // 后端 upload 响应形状（voice_service.rs:130-136），无 event_id
    return HttpResponse.json({
      content_uri: 'mxc://example.org/media',
      content: { msgtype: 'm.audio', url: 'mxc://example.org/media' },
      content_type: 'audio/webm',
      duration_ms: 3000,
      size: 1024
    })
  }),
  http.post(`${TEST_BASE_URL}/_matrix/vendor/v1/voice/transcription`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ text: 'hello world', language: 'en', ...(body as Record<string, unknown>) })
  })
)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('../../EndpointCapabilityService', () => ({
  default: {
    check: (...args: unknown[]) => endpointCheckMock(...args)
  }
}))

vi.mock('../../crypto/MatrixAttachmentEncryptionService', () => ({
  matrixAttachmentEncryptionService: {
    encryptAttachment: vi.fn().mockResolvedValue({
      encryptedData: new Blob(['encrypted-bytes']),
      encryptedFile: {
        url: '',
        key: { alg: 'A256CTR', key_ops: ['encrypt', 'decrypt'], kty: 'oct', k: 'test-key', ext: true },
        iv: 'test-iv',
        hashes: { sha256: 'test-hash' },
        v: 'v2'
      }
    })
  }
}))

const endpointCheckMock = vi.fn()
const encryptAttachmentMock = vi.mocked(matrixAttachmentEncryptionService.encryptAttachment)

const authedRequestMock = vi
  .fn()
  .mockImplementation(
    async (method: string, path: string, _queryParams?: unknown, body?: unknown, opts?: { prefix?: string }) => {
      const prefix = opts?.prefix ?? ''
      const url = `${TEST_BASE_URL}${prefix}${path}`
      const headers: Record<string, string> = {
        Authorization: 'Bearer test-access-token'
      }
      const response = await fetch(url, {
        method,
        headers,
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.json()
    }
  )

const transcribeVoiceMessageMock = vi.fn()
// 后端真实响应形状：synapse-services/src/voice_service.rs:130-136
// `{ content_uri, content, content_type, duration_ms, size }` —— 没有 message_id / url。
const uploadVoiceMessageMultipartMock = vi.fn().mockResolvedValue({
  content_uri: 'mxc://example.org/media',
  content: { msgtype: 'm.audio', url: 'mxc://example.org/media' },
  content_type: 'audio/webm',
  duration_ms: 3000,
  size: 1024
})

const voiceMgr = {
  transcribeVoiceMessage: transcribeVoiceMessageMock,
  uploadVoiceMessageMultipart: uploadVoiceMessageMultipartMock
}

const mockClient = {
  http: {
    authedRequest: authedRequestMock
  },
  mxcUrlToHttp: vi.fn((mxcUrl: string) => `https://cdn.example.com/${mxcUrl.replace('mxc://', '')}`),
  getRoom: vi.fn(() => null as Room | null),
  getVoiceManager: vi.fn(() => voiceMgr)
}

const { matrixVoiceService, isVoiceMessageResult } = await import('../MatrixVoiceService')

describe('MatrixVoiceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as unknown as MatrixClient)
    endpointCheckMock.mockResolvedValue(true)
  })

  it('uploads voice through the voice upload endpoint', async () => {
    const file = new Blob(['voice-bytes'], { type: 'audio/webm' })

    const result = await matrixVoiceService.uploadVoice('!room:example.org', file)

    expect(result).toEqual({
      // 上传端点不回 event_id（后端 upload 响应里没有该字段），不得伪造
      url: 'mxc://example.org/media',
      filename: 'voice.webm',
      mxcUrl: 'mxc://example.org/media',
      httpUrl: 'https://cdn.example.com/example.org/media'
    })
    expect(result.eventId).toBeUndefined()
    expect(endpointCheckMock).toHaveBeenCalledWith('POST', '/_matrix/vendor/v1/voice/upload')
    expect(uploadVoiceMessageMultipartMock).toHaveBeenCalledTimes(1)
    const call = uploadVoiceMessageMultipartMock.mock.calls[0]
    expect(call[0].formData.get('file')).toBeInstanceOf(File)
    expect(call[0].formData.get('room_id')).toBe('!room:example.org')
    expect(call[0].formData.get('content_type')).toBe('audio/webm')
    expect(authedRequestMock).not.toHaveBeenCalled()
  })

  it('上传明文通道不得加密：字节与 content_type 必须保持一致', async () => {
    const file = new Blob(['voice-bytes'], { type: 'audio/webm' })

    const result = await matrixVoiceService.uploadVoice('!room:example.org', file, 'voice.webm', 3000, 'audio/webm')

    // 加密与否由调用方 useVoiceInput 按房间加密状态单点决策；本通道只接受明文。
    // 密文若走这里会被标成 audio/webm（后端 validate_audio_content_type 只放行
    // audio/*），落库 mimetype 与真实字节不符，读取方解码必得垃圾。
    const uploaded = uploadVoiceMessageMultipartMock.mock.calls[0][0].formData.get('file') as File
    expect(uploaded.type).toBe('audio/webm')
    expect(uploaded.type).not.toBe('application/octet-stream')
    expect(uploaded.size).toBe(file.size)
    expect(result.encryptedFile).toBeUndefined()
    expect(encryptAttachmentMock).not.toHaveBeenCalled()
  })

  it('uploads voice with duration_ms when provided', async () => {
    const file = new Blob(['voice-bytes'], { type: 'audio/webm' })

    await matrixVoiceService.uploadVoice('!room:example.org', file, 'voice.webm', 5000, 'audio/ogg')

    const call = uploadVoiceMessageMultipartMock.mock.calls[0]
    expect(call[0].formData.get('duration_ms')).toBe('5000')
    expect(call[0].formData.get('content_type')).toBe('audio/ogg')
  })

  it('rejects an empty roomId instead of uploading an unscoped voice message', async () => {
    const file = new Blob(['voice-bytes'], { type: 'audio/webm' })

    // 语音上传按房间记账（后端 record_upload 的 room_id 虽有 Option 语义，
    // 但本服务的契约是「必须属于某个房间」），空 roomId 直接拒绝，不发请求。
    await expect(matrixVoiceService.uploadVoice('', file)).rejects.toThrow(/roomId/)
    expect(uploadVoiceMessageMultipartMock).not.toHaveBeenCalled()
  })

  it('should resolve playback urls from room event content', async () => {
    mockClient.getRoom.mockReturnValueOnce({
      findEventById: vi.fn(() => ({
        getContent: () => ({
          url: 'mxc://example.org/voice-file',
          info: {
            mimetype: 'audio/ogg',
            size: 2048
          }
        })
      }))
    } as unknown as Room)

    // getVoice was removed in Phase 2.3; replaced by registerEncryptedVoice path.
    // This test now verifies getPlayableUrl only.
    expect(matrixVoiceService.getPlayableUrl('mxc://example.org/voice-file')).toBe(
      'https://cdn.example.com/example.org/voice-file'
    )
  })

  it('should resolve playable urls without exposing matrix client to components', () => {
    expect(matrixVoiceService.getPlayableUrl('mxc://example.org/voice-file')).toBe(
      'https://cdn.example.com/example.org/voice-file'
    )
    expect(matrixVoiceService.getPlayableUrl(undefined, 'https://cdn.example.com/direct.ogg')).toBe(
      'https://cdn.example.com/direct.ogg'
    )
    expect(matrixVoiceService.getPlayableUrl()).toBe('')
  })

  it('should transcribe voice through the voice transcription endpoint', async () => {
    transcribeVoiceMessageMock.mockResolvedValueOnce({
      text: 'hello world',
      language: 'en'
    })

    const result = await matrixVoiceService.transcribeVoice({
      roomId: '!room:example.org',
      eventId: '$voice-event'
    })

    expect(result).toEqual({
      text: 'hello world',
      language: 'en'
    })
    expect(endpointCheckMock).toHaveBeenCalledWith('POST', '/_matrix/vendor/v1/voice/transcription')
    expect(transcribeVoiceMessageMock).toHaveBeenCalledWith(
      '$voice-event',
      undefined,
      // ClientPrefix.V1
      expect.anything()
    )
    expect(authedRequestMock).not.toHaveBeenCalled()
  })

  it('returns endpoint-unavailable error when upload api is disabled', async () => {
    endpointCheckMock.mockResolvedValueOnce(false)

    await expect(matrixVoiceService.uploadVoice('!room:example.org', new Blob(['lazy']))).rejects.toThrow(
      '语音服务不可用'
    )
    expect(authedRequestMock).not.toHaveBeenCalled()
  })

  it('returns null when transcription endpoint is unavailable', async () => {
    endpointCheckMock.mockResolvedValueOnce(false)

    await expect(
      matrixVoiceService.transcribeVoice({
        roomId: '!room:example.org',
        eventId: '$voice-event'
      })
    ).rejects.toThrow('语音服务不可用')
  })

  it('should fall back to original mxc url when client is unavailable', () => {
    vi.mocked(matrixClientService.getClient).mockReturnValueOnce(null)

    expect(matrixVoiceService.getPlayableUrl('mxc://example.org/fallback')).toBe('mxc://example.org/fallback')
  })

  it('should expose a typed guard for voice upload results', () => {
    expect(isVoiceMessageResult({ filename: 'voice.webm' })).toBe(true)
    expect(isVoiceMessageResult({ filename: 123 })).toBe(false)
    expect(isVoiceMessageResult(null)).toBe(false)
  })

  // FT-122: 所有接受 ID 参数的方法必须校验非空，不能将空字符串传给后端
  describe('FT-122: input validation', () => {
    it('uploadVoice 空 roomId 抛出错误', async () => {
      await expect(matrixVoiceService.uploadVoice('', new Blob(['x']))).rejects.toThrow()
    })

    it('registerEncryptedVoice 空 roomId 抛出错误', async () => {
      await expect(matrixVoiceService.registerEncryptedVoice('', '', 0, 0)).rejects.toThrow()
    })

    it('registerEncryptedVoice 空 mediaId 抛出错误', async () => {
      await expect(matrixVoiceService.registerEncryptedVoice('!room:id', '', 0, 0)).rejects.toThrow()
    })

    it('getUserVoiceStats 空 userId 抛出错误', async () => {
      await expect(matrixVoiceService.getUserVoiceStats('')).rejects.toThrow()
    })

    it('deleteVoice 空 messageId 抛出错误', async () => {
      await expect(matrixVoiceService.deleteVoice('')).rejects.toThrow()
    })

    it('getRoomVoiceList 空 roomId 抛出错误', async () => {
      await expect(matrixVoiceService.getRoomVoiceList('', 50, 0)).rejects.toThrow()
    })

    it('getUserVoiceList 空 userId 抛出错误', async () => {
      await expect(matrixVoiceService.getUserVoiceList('', 50, 0)).rejects.toThrow()
    })

    it('getVoiceContent 空 messageId 抛出错误', async () => {
      await expect(matrixVoiceService.getVoiceContent('')).rejects.toThrow()
    })

    it('convertVoice 空 messageId 抛出错误', async () => {
      await expect(matrixVoiceService.convertVoice('', 'mp3')).rejects.toThrow()
    })

    it('optimizeVoice 空 messageId 抛出错误', async () => {
      await expect(matrixVoiceService.optimizeVoice('', {})).rejects.toThrow()
    })
  })
})
