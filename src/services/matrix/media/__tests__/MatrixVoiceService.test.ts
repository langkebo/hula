import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null)
  }
}))

const mockVoiceManager = {
  uploadVoiceMessage: vi.fn(),
  getVoiceMessageInfo: vi.fn(),
  transcribeVoiceMessage: vi.fn()
}

const mockClient = {
  mxcUrlToHttp: vi.fn((mxcUrl: string) => `https://cdn.example.com/${mxcUrl.replace('mxc://', '')}`),
  getRoom: vi.fn(() => null)
}

const matrixClientService = (await import('../../MatrixClientService')).default
const { matrixVoiceService, isVoiceMessageResult } = await import('../MatrixVoiceService')

describe('MatrixVoiceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)
    ;(matrixVoiceService as any).voiceManager = mockVoiceManager
    ;(matrixVoiceService as any).observedClient = mockClient
  })

  it('should return sdk upload result instead of forging pseudo mxc url', async () => {
    const file = new Blob(['voice-bytes'], { type: 'audio/webm' })
    mockVoiceManager.uploadVoiceMessage.mockResolvedValueOnce({
      eventId: '$voice-event',
      url: 'mxc://example.org/media'
    })

    const result = await matrixVoiceService.uploadVoice('!room:example.org', file)

    expect(result).toEqual({
      eventId: '$voice-event',
      url: 'mxc://example.org/media',
      filename: 'voice.webm',
      mxcUrl: 'mxc://example.org/media',
      httpUrl: 'https://cdn.example.com/example.org/media'
    })
    expect(mockVoiceManager.uploadVoiceMessage).toHaveBeenCalledWith({
      roomId: '!room:example.org',
      file,
      filename: 'voice.webm'
    })
  })

  it('should resolve playback urls from room event content', async () => {
    mockVoiceManager.getVoiceMessageInfo.mockResolvedValueOnce({
      duration: 12,
      waveform: [1, 2, 3]
    })
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
    } as any)

    const result = await matrixVoiceService.getVoice('!room:example.org', '$event')

    expect(result).toEqual({
      duration: 12,
      waveform: [1, 2, 3],
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

  it('should forward typed transcription params to sdk', async () => {
    mockVoiceManager.transcribeVoiceMessage.mockResolvedValueOnce({
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
    expect(mockVoiceManager.transcribeVoiceMessage).toHaveBeenCalledWith({
      roomId: '!room:example.org',
      eventId: '$voice-event'
    })
  })

  it('should lazily resolve voice manager from matrix client when cache is empty', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValueOnce({
      ...mockClient,
      getVoiceMessageManager: vi.fn(() => mockVoiceManager)
    } as any)
    ;(matrixVoiceService as any).voiceManager = null
    mockVoiceManager.uploadVoiceMessage.mockResolvedValueOnce({
      eventId: '$lazy',
      url: 'mxc://example.org/lazy'
    })

    const result = await matrixVoiceService.uploadVoice('!room:example.org', new Blob(['lazy']))

    expect(result?.mxcUrl).toBe('mxc://example.org/lazy')
    expect(mockVoiceManager.uploadVoiceMessage).toHaveBeenCalledOnce()
  })

  it('should refresh cached voice manager when matrix client changes', async () => {
    const nextVoiceManager = {
      uploadVoiceMessage: vi.fn().mockResolvedValue({
        eventId: '$next',
        url: 'mxc://example.org/next'
      }),
      getVoiceMessageInfo: vi.fn(),
      transcribeVoiceMessage: vi.fn()
    }
    const nextClient = {
      mxcUrlToHttp: vi.fn((mxcUrl: string) => `https://cdn.example.com/${mxcUrl.replace('mxc://', '')}`),
      getRoom: vi.fn(() => null),
      getVoiceMessageManager: vi.fn(() => nextVoiceManager)
    }

    vi.mocked(matrixClientService.getClient).mockReturnValue(nextClient as any)
    ;(matrixVoiceService as any).voiceManager = mockVoiceManager
    ;(matrixVoiceService as any).observedClient = mockClient

    const result = await matrixVoiceService.uploadVoice('!room:example.org', new Blob(['next']))

    expect(nextClient.getVoiceMessageManager).toHaveBeenCalledOnce()
    expect(mockVoiceManager.uploadVoiceMessage).not.toHaveBeenCalled()
    expect(nextVoiceManager.uploadVoiceMessage).toHaveBeenCalledOnce()
    expect(result.mxcUrl).toBe('mxc://example.org/next')
  })

  it('should fall back to original mxc url when client is unavailable', () => {
    vi.mocked(matrixClientService.getClient).mockReturnValueOnce(null)
    ;(matrixVoiceService as any).voiceManager = null
    ;(matrixVoiceService as any).observedClient = null

    expect(matrixVoiceService.getPlayableUrl('mxc://example.org/fallback')).toBe('mxc://example.org/fallback')
  })

  it('should expose a typed guard for voice upload results', () => {
    expect(isVoiceMessageResult({ filename: 'voice.webm' })).toBe(true)
    expect(isVoiceMessageResult({ filename: 123 })).toBe(false)
    expect(isVoiceMessageResult(null)).toBe(false)
  })
})
