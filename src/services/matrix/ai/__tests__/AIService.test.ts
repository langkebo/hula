import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/backend', () => ({
  matrixExtensionEndpoints: {
    CONVERSATION_GET_MY: '/api/ai/conversation/my',
    CONVERSATION_CREATE_MY: '/api/ai/conversation/create',
    CONVERSATION_UPDATE_MY: '/api/ai/conversation/update',
    CONVERSATION_DELETE_MY: '/api/ai/conversation/delete',
    MESSAGE_SAVE_GENERATED_CONTENT: '/api/ai/message/save',
    MESSAGE_LIST_BY_CONVERSATION_ID: '/api/ai/message/list',
    MESSAGE_DELETE: '/api/ai/message/delete',
    MESSAGE_DELETE_BY_CONVERSATION_ID: '/api/ai/message/deleteByConversation',
    MODEL_PAGE: '/api/ai/model/page',
    MODEL_REMAINING_USAGE: '/api/ai/model/remaining',
    IMAGE_DRAW: '/api/ai/image/draw',
    IMAGE_MY_PAGE: '/api/ai/image/my/page',
    IMAGE_MY_LIST_BY_IDS: '/api/ai/image/my/list',
    VIDEO_MY_PAGE: '/api/ai/video/my/page',
    VIDEO_MY_LIST_BY_IDS: '/api/ai/video/my/list',
    VIDEO_GENERATE: '/api/ai/video/generate',
    AUDIO_MY_PAGE: '/api/ai/audio/my/page',
    AUDIO_MY_LIST_BY_IDS: '/api/ai/audio/my/list',
    AUDIO_GENERATE: '/api/ai/audio/generate',
    AUDIO_VOICES: '/api/ai/audio/voices',
    CHAT_ROLE_PAGE: '/api/ai/chat-role/page'
  }
}))

const mockRequest = vi.fn()
vi.mock('../../MatrixHttpClient', () => ({
  matrixHttpClient: { request: mockRequest }
}))

const mockGetClient = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  matrixClientService: { getClient: mockGetClient }
}))

// Capture handler for the Channel so the test can fire events into it.
type ChannelHandler = (event: {
  eventType: 'chunk' | 'done' | 'error'
  data?: string
  error?: string
  requestId: string
}) => void
let lastChannel: { onmessage?: ChannelHandler } | null = null
class FakeChannel {
  onmessage?: ChannelHandler
  constructor() {
    lastChannel = this
  }
}

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  Channel: FakeChannel
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const { aiService } = await import('../AIService')

describe('AIService · conversation CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest.mockReset()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('conversationGetMy resolves the list', async () => {
    mockRequest.mockResolvedValueOnce([{ id: 'c1', title: 'A' }])
    const result = await aiService.conversationGetMy({ id: 'c1' })
    expect(result).toEqual([{ id: 'c1', title: 'A' }])
    expect(mockRequest).toHaveBeenCalledWith({
      url: '/api/ai/conversation/my',
      params: { id: 'c1' }
    })
  })

  it('conversationGetMy propagates network errors', async () => {
    mockRequest.mockRejectedValueOnce(new Error('timeout'))
    await expect(aiService.conversationGetMy()).rejects.toThrow('timeout')
  })

  it('conversationCreate posts body and returns the created entity', async () => {
    mockRequest.mockResolvedValueOnce({ id: 'c1', title: 'New' })
    const result = await aiService.conversationCreate({ roleId: 'r1', title: 'New' })
    expect(result.id).toBe('c1')
    expect(mockRequest).toHaveBeenCalledWith({
      url: '/api/ai/conversation/create',
      body: { roleId: 'r1', title: 'New' }
    })
  })

  it('conversationUpdate posts body with id', async () => {
    mockRequest.mockResolvedValueOnce({ id: 'c1', pinned: true })
    const result = await aiService.conversationUpdate({ id: 'c1', pinned: true })
    expect(result.pinned).toBe(true)
    expect(mockRequest).toHaveBeenCalledWith({
      url: '/api/ai/conversation/update',
      body: { id: 'c1', pinned: true }
    })
  })

  it('conversationDelete wraps the id list and returns true', async () => {
    mockRequest.mockResolvedValueOnce(undefined)
    const ok = await aiService.conversationDelete(['c1', 'c2'])
    expect(ok).toBe(true)
    expect(mockRequest).toHaveBeenCalledWith({
      url: '/api/ai/conversation/delete',
      body: { conversationIdList: ['c1', 'c2'] }
    })
  })

  it('conversationDelete re-throws on request failure', async () => {
    mockRequest.mockRejectedValueOnce(new Error('403'))
    await expect(aiService.conversationDelete(['c1'])).rejects.toThrow('403')
  })
})

describe('AIService · message CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest.mockReset()
  })

  it('messageSaveGeneratedContent returns true on success', async () => {
    mockRequest.mockResolvedValueOnce(undefined)
    const ok = await aiService.messageSaveGeneratedContent({
      conversationId: 'c1',
      prompt: 'hi',
      generatedContent: 'hello'
    })
    expect(ok).toBe(true)
  })

  it('messageListByConversationId returns messages', async () => {
    mockRequest.mockResolvedValueOnce([{ id: 'm1', conversationId: 'c1', role: 'user', content: 'hi' }])
    const result = await aiService.messageListByConversationId({ conversationId: 'c1' })
    expect(result).toHaveLength(1)
  })

  it('messageDelete re-throws when backend fails', async () => {
    mockRequest.mockRejectedValueOnce(new Error('not found'))
    await expect(aiService.messageDelete({ id: 'm1' })).rejects.toThrow('not found')
  })

  it('messageDeleteByConversationId posts body', async () => {
    mockRequest.mockResolvedValueOnce(undefined)
    const ok = await aiService.messageDeleteByConversationId({ conversationIdList: ['c1'] })
    expect(ok).toBe(true)
    expect(mockRequest).toHaveBeenCalledWith({
      url: '/api/ai/message/deleteByConversation',
      body: { conversationIdList: ['c1'] }
    })
  })
})

describe('AIService · media generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest.mockReset()
  })

  it('generateImage posts request body', async () => {
    mockRequest.mockResolvedValueOnce({ url: 'https://i.example.com/x.png' })
    const result = await aiService.generateImage({ modelId: 'm1', prompt: 'sunset', width: 512, height: 512 })
    expect(typeof result).toBe('object')
    expect(result && typeof result === 'object' ? result.url : undefined).toContain('https://')
    expect(mockRequest).toHaveBeenCalledWith({
      url: '/api/ai/image/draw',
      body: { modelId: 'm1', prompt: 'sunset', width: 512, height: 512 }
    })
  })

  it('videoGenerate propagates network errors', async () => {
    mockRequest.mockRejectedValueOnce(new Error('rate limit'))
    await expect(aiService.videoGenerate({ prompt: 'cat' })).rejects.toThrow('rate limit')
  })

  it('audioGetVoices fetches by model param', async () => {
    mockRequest.mockResolvedValueOnce([{ id: 'v1', name: 'Alice' }])
    const voices = await aiService.audioGetVoices({ model: 'tts-1' })
    expect(voices).toHaveLength(1)
    expect(mockRequest).toHaveBeenCalledWith({
      url: '/api/ai/audio/voices',
      params: { model: 'tts-1' }
    })
  })
})

describe('AIService · paginated reads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest.mockReset()
  })

  it.each([
    ['modelPage', '/api/ai/model/page'],
    ['imageMyPage', '/api/ai/image/my/page'],
    ['videoMyPage', '/api/ai/video/my/page'],
    ['audioMyPage', '/api/ai/audio/my/page'],
    ['chatRolePage', '/api/ai/chat-role/page']
  ])('%s calls the expected endpoint with pagination params', async (method, expectedUrl) => {
    mockRequest.mockResolvedValueOnce({ list: [], total: 0 })
    const result = await (aiService as unknown as Record<string, (args: unknown) => Promise<unknown>>)[method]({
      pageNo: 2,
      pageSize: 20
    })
    expect(result).toEqual({ list: [], total: 0 })
    expect(mockRequest).toHaveBeenCalledWith({
      url: expectedUrl,
      params: { pageNo: 2, pageSize: 20 }
    })
  })
})

describe('AIService · messageCancelStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockReset()
  })

  it('returns true when invoke resolves', async () => {
    mockInvoke.mockResolvedValueOnce(undefined)
    const ok = await aiService.messageCancelStream('req-1')
    expect(ok).toBe(true)
    expect(mockInvoke).toHaveBeenCalledWith('ai_message_cancel_stream', { requestId: 'req-1' })
  })

  it('swallows invoke errors and returns false', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('IPC failed'))
    const ok = await aiService.messageCancelStream('req-2')
    expect(ok).toBe(false)
  })
})

describe('AIService · messageSendStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockReset()
    mockGetClient.mockReset()
    lastChannel = null
  })

  const waitFor = async (predicate: () => boolean, maxTicks = 20) => {
    for (let i = 0; i < maxTicks; i++) {
      if (predicate()) return
      await Promise.resolve()
    }
    throw new Error(`waitFor exhausted after ${maxTicks} ticks`)
  }

  it('rejects when matrix client is not initialized', async () => {
    mockGetClient.mockReturnValueOnce(null)
    await expect(aiService.messageSendStream('c1', 'hi')).rejects.toThrow('Matrix client not initialized')
  })

  it('accumulates chunks and resolves on done', async () => {
    mockGetClient.mockReturnValueOnce({} as unknown as Record<string, unknown>)
    mockInvoke.mockResolvedValueOnce(undefined)
    const onChunk = vi.fn()
    const onDone = vi.fn()
    const onStart = vi.fn()

    const promise = aiService.messageSendStream('c1', 'hi', { onStart, onChunk, onDone })
    await waitFor(() => onStart.mock.calls.length > 0)

    const requestId = onStart.mock.calls[0][0] as string
    expect(requestId).toMatch(/^ai-stream-/)
    expect(lastChannel?.onmessage).toBeDefined()

    lastChannel?.onmessage?.({ eventType: 'chunk', data: 'Hel', requestId })
    lastChannel?.onmessage?.({ eventType: 'chunk', data: 'lo', requestId })
    lastChannel?.onmessage?.({ eventType: 'done', requestId })

    await expect(promise).resolves.toBe('Hello')
    expect(onChunk).toHaveBeenCalledWith('Hel')
    expect(onChunk).toHaveBeenCalledWith('lo')
    expect(onDone).toHaveBeenCalledWith('Hello')
  })

  it('ignores events with mismatched requestId', async () => {
    mockGetClient.mockReturnValueOnce({} as unknown as Record<string, unknown>)
    mockInvoke.mockResolvedValueOnce(undefined)
    const onChunk = vi.fn()
    const onDone = vi.fn()
    const onStart = vi.fn()

    const promise = aiService.messageSendStream('c1', 'hi', { onStart, onChunk, onDone })
    await waitFor(() => onStart.mock.calls.length > 0)

    const requestId = onStart.mock.calls[0][0] as string
    lastChannel?.onmessage?.({ eventType: 'chunk', data: 'foreign', requestId: 'other-request' })
    lastChannel?.onmessage?.({ eventType: 'done', data: 'final', requestId })

    await expect(promise).resolves.toBe('final')
    expect(onChunk).not.toHaveBeenCalled()
  })

  it('rejects on error event with the provided message', async () => {
    mockGetClient.mockReturnValueOnce({} as unknown as Record<string, unknown>)
    mockInvoke.mockResolvedValueOnce(undefined)
    const onError = vi.fn()
    const onStart = vi.fn()

    const promise = aiService.messageSendStream('c1', 'hi', { onStart, onError })
    await waitFor(() => onStart.mock.calls.length > 0)

    const requestId = onStart.mock.calls[0][0] as string
    lastChannel?.onmessage?.({ eventType: 'error', error: 'upstream overload', requestId })

    await expect(promise).rejects.toThrow('upstream overload')
    expect(onError).toHaveBeenCalledWith('upstream overload')
  })

  it('rejects when invoke itself fails before any events arrive', async () => {
    mockGetClient.mockReturnValueOnce({} as unknown as Record<string, unknown>)
    mockInvoke.mockRejectedValueOnce(new Error('bridge-down'))
    const onError = vi.fn()

    await expect(aiService.messageSendStream('c1', 'hi', { onError })).rejects.toThrow('bridge-down')
    expect(onError).toHaveBeenCalledWith('bridge-down')
  })
})
