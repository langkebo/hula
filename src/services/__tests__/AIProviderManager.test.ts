import { describe, it, expect, vi, beforeEach } from 'vitest'
import { aiProviderManager } from '../AIProviderManager'

const mockOpenClawProvider = {
  type: 'openclaw' as const,
  state: 'connected' as const,
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true),
  chat: vi.fn().mockResolvedValue({ id: '1', model: 'test', message: { role: 'assistant', content: 'openclaw response' }, finish_reason: 'stop' }),
  streamChat: vi.fn()
}

const mockTrendRadarProvider = {
  type: 'trendradar' as const,
  state: 'connected' as const,
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true),
  chat: vi.fn().mockResolvedValue({ id: '1', model: 'test', message: { role: 'assistant', content: 'trendradar response' }, finish_reason: 'stop' }),
  streamChat: vi.fn()
}

vi.mock('../AIProviderManager', () => {
  return {
    aiProviderManager: {
      state: { value: 'disconnected' },
      currentProvider: { value: 'openclaw' },
      initialized: { value: false },
      lastErrorMessage: { value: null },
      currentProviderName: { value: 'OpenClaw' },
      initialize: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      setProvider: vi.fn(),
      testConnection: vi.fn().mockResolvedValue(true),
      chat: vi.fn().mockResolvedValue({ id: '1', model: 'test', message: { role: 'assistant', content: 'test response' }, finish_reason: 'stop' }),
      getAvailableProviders: vi.fn().mockReturnValue(['openclaw', 'trendradar', 'hula']),
      isProviderAvailable: vi.fn().mockReturnValue(true)
    }
  }
})

describe('AIProviderManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })

  it('should initialize successfully', async () => {
    await aiProviderManager.initialize()
    expect(aiProviderManager.initialize).toHaveBeenCalled()
  })

  it('should have correct initial state', () => {
    expect(aiProviderManager.currentProvider.value).toBe('openclaw')
    expect(aiProviderManager.state.value).toBe('disconnected')
  })

  it('should return available providers', () => {
    const providers = aiProviderManager.getAvailableProviders()
    expect(providers).toContain('openclaw')
    expect(providers).toContain('trendradar')
    expect(providers).toContain('hula')
  })

  it('should check provider availability', () => {
    expect(aiProviderManager.isProviderAvailable('openclaw')).toBe(true)
    expect(aiProviderManager.isProviderAvailable('trendradar')).toBe(true)
  })

  it('should handle chat request', async () => {
    const response = await aiProviderManager.chat({ messages: [{ role: 'user', content: 'hello' }] })
    expect(response.message.content).toBe('test response')
  })
})
