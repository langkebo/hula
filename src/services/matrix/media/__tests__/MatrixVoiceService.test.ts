import type { MatrixClient, Room } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'

const TEST_BASE_URL = 'https://matrix.example.com'

const _server = setupMswServer(
  http.post(`${TEST_BASE_URL}/_matrix/client/v1/voice/upload`, () => {
    return HttpResponse.json({
      event_id: '$voice-event',
      content_uri: 'mxc://example.org/media'
    })
  }),
  http.post(`${TEST_BASE_URL}/_matrix/client/v1/voice/transcription`, async ({ request }) => {
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

const endpointCheckMock = vi.fn()

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

const mockClient = {
  http: {
    authedRequest: authedRequestMock
  },
  mxcUrlToHttp: vi.fn((mxcUrl: string) => `https://cdn.example.com/${mxcUrl.replace('mxc://', '')}`),
  getRoom: vi.fn(() => null as Room | null)
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
      eventId: '$voice-event',
      url: 'mxc://example.org/media',
      filename: 'voice.webm',
      mxcUrl: 'mxc://example.org/media',
      httpUrl: 'https://cdn.example.com/example.org/media'
    })
    expect(endpointCheckMock).toHaveBeenCalledWith('POST', '/_matrix/client/v1/voice/upload')
    expect(authedRequestMock).toHaveBeenCalledWith('POST', '/voice/upload', undefined, expect.any(FormData), {
      prefix: '/_matrix/client/v1'
    })
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

    const result = await matrixVoiceService.getVoice('!room:example.org', '$event')

    expect(result).toEqual({
      mimeType: 'audio/ogg',
      size: 2048,
      mxcUrl: 'mxc://example.org/voice-file',
      httpUrl: 'https://cdn.example.com/example.org/voice-file'
    })
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
    const result = await matrixVoiceService.transcribeVoice({
      roomId: '!room:example.org',
      eventId: '$voice-event'
    })

    expect(result).toEqual({
      text: 'hello world',
      language: 'en'
    })
    expect(endpointCheckMock).toHaveBeenCalledWith('POST', '/_matrix/client/v1/voice/transcription')
    expect(authedRequestMock).toHaveBeenCalledWith(
      'POST',
      '/voice/transcription',
      undefined,
      { message_id: '$voice-event' },
      { prefix: '/_matrix/client/v1' }
    )
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
})
