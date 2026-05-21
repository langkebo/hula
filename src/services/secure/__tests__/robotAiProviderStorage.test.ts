import { beforeEach, describe, expect, it, vi } from 'vitest'

const { deleteSecureSecretMock, getSecureSecretMock, setSecureSecretMock } = vi.hoisted(() => ({
  getSecureSecretMock: vi.fn(),
  setSecureSecretMock: vi.fn(),
  deleteSecureSecretMock: vi.fn()
}))

vi.mock('../secureStorage', () => ({
  getSecureSecret: getSecureSecretMock,
  setSecureSecret: setSecureSecretMock,
  deleteSecureSecret: deleteSecureSecretMock
}))

import {
  loadRobotAiProvider,
  loadRobotOpenClawConfig,
  loadRobotTrendRadarConfig,
  saveRobotAiProvider,
  saveRobotOpenClawConfig,
  saveRobotTrendRadarConfig
} from '../robotAiProviderStorage'

describe('robotAiProviderStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    getSecureSecretMock.mockResolvedValue(null)
    setSecureSecretMock.mockResolvedValue(true)
    deleteSecureSecretMock.mockResolvedValue(true)
  })

  it('migrates legacy openclaw token out of localStorage', async () => {
    window.localStorage.setItem(
      'hula-chat-openclaw-config',
      JSON.stringify({
        gatewayUrl: ' http://127.0.0.1:3000 ',
        token: ' openclaw-token '
      })
    )
    getSecureSecretMock.mockResolvedValue('openclaw-token')

    const result = await loadRobotOpenClawConfig({
      gatewayUrl: 'http://127.0.0.1:18789',
      token: '',
      autoConnect: true,
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
      presencePenalty: 0.0,
      frequencyPenalty: 0.0
    })

    expect(result).toEqual({
      gatewayUrl: 'http://127.0.0.1:3000',
      token: 'openclaw-token',
      autoConnect: true,
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
      presencePenalty: 0.0,
      frequencyPenalty: 0.0
    })
    expect(window.localStorage.getItem('hula-chat-openclaw-config')).toBe(
      '{"gatewayUrl":"http://127.0.0.1:3000","autoConnect":true,"reconnect":true,"reconnectInterval":3000,"maxReconnectAttempts":5,"heartbeatInterval":30000,"temperature":0.7,"maxTokens":4096,"topP":1,"presencePenalty":0,"frequencyPenalty":0}'
    )
    expect(setSecureSecretMock).toHaveBeenCalledWith('hula-chat-openclaw-token', 'openclaw-token')
  })

  it('falls back to sessionStorage for trendradar apiKey when secure storage is unavailable', async () => {
    setSecureSecretMock.mockResolvedValue(false)

    const saved = await saveRobotTrendRadarConfig({
      apiUrl: 'http://127.0.0.1:3333/mcp',
      apiKey: 'trendradar-key'
    })

    expect(saved).toEqual({
      apiUrl: 'http://127.0.0.1:3333/mcp',
      apiKey: 'trendradar-key'
    })
    expect(window.localStorage.getItem('hula-chat-trendradar-config')).toBe('{"apiUrl":"http://127.0.0.1:3333/mcp"}')
    const storedApiKey = window.sessionStorage.getItem('hula-chat-trendradar-api-key-session')
    expect(storedApiKey).toBeTruthy()
    expect(storedApiKey).not.toBe('trendradar-key')

    const loaded = await loadRobotTrendRadarConfig({
      apiUrl: '',
      apiKey: ''
    })

    expect(loaded).toEqual({
      apiUrl: 'http://127.0.0.1:3333/mcp',
      apiKey: 'trendradar-key'
    })
  })

  it('persists the selected provider in localStorage', () => {
    saveRobotAiProvider('trendradar')

    expect(loadRobotAiProvider()).toBe('trendradar')
  })

  it('stores provider and openclaw config in a user-scoped namespace', async () => {
    const scope = { userId: '@alice:hula.im' }

    saveRobotAiProvider('openclaw', scope)
    await saveRobotOpenClawConfig(
      {
        gatewayUrl: 'http://127.0.0.1:20001',
        token: 'alice-token',
        autoConnect: true,
        reconnect: true,
        reconnectInterval: 3000,
        maxReconnectAttempts: 5,
        heartbeatInterval: 30000,
        temperature: 0.7,
        maxTokens: 4096,
        topP: 1.0,
        presencePenalty: 0.0,
        frequencyPenalty: 0.0
      },
      scope
    )

    expect(loadRobotAiProvider(scope)).toBe('openclaw')
    expect(window.localStorage.getItem('hula-chat-ai-provider::@alice:hula.im')).toBe('openclaw')
    expect(window.localStorage.getItem('hula-chat-openclaw-config::@alice:hula.im')).toBe(
      '{"gatewayUrl":"http://127.0.0.1:20001","autoConnect":true,"reconnect":true,"reconnectInterval":3000,"maxReconnectAttempts":5,"heartbeatInterval":30000,"temperature":0.7,"maxTokens":4096,"topP":1,"presencePenalty":0,"frequencyPenalty":0}'
    )
    expect(setSecureSecretMock).toHaveBeenCalledWith('hula-chat-openclaw-token::@alice:hula.im', 'alice-token')
  })

  it('migrates legacy openclaw config into the current user scope on load', async () => {
    const scope = { userId: '@bob:hula.im' }
    window.localStorage.setItem(
      'hula-chat-openclaw-config',
      JSON.stringify({
        gatewayUrl: 'http://127.0.0.1:3001',
        token: 'legacy-user-token'
      })
    )
    getSecureSecretMock.mockImplementation(async (key: string) => {
      if (key === 'hula-chat-openclaw-token') {
        return 'legacy-user-token'
      }
      return null
    })

    const loaded = await loadRobotOpenClawConfig(
      {
        gatewayUrl: 'http://127.0.0.1:18789',
        token: '',
        autoConnect: true,
        reconnect: true,
        reconnectInterval: 3000,
        maxReconnectAttempts: 5,
        heartbeatInterval: 30000,
        temperature: 0.7,
        maxTokens: 4096,
        topP: 1.0,
        presencePenalty: 0.0,
        frequencyPenalty: 0.0
      },
      scope
    )

    expect(loaded.gatewayUrl).toBe('http://127.0.0.1:3001')
    expect(loaded.token).toBe('legacy-user-token')
    expect(window.localStorage.getItem('hula-chat-openclaw-config::@bob:hula.im')).toBe(
      '{"gatewayUrl":"http://127.0.0.1:3001","autoConnect":true,"reconnect":true,"reconnectInterval":3000,"maxReconnectAttempts":5,"heartbeatInterval":30000,"temperature":0.7,"maxTokens":4096,"topP":1,"presencePenalty":0,"frequencyPenalty":0}'
    )
    expect(setSecureSecretMock).toHaveBeenCalledWith('hula-chat-openclaw-token::@bob:hula.im', 'legacy-user-token')
  })

  it('stores only the openclaw gateway url in localStorage on save', async () => {
    await saveRobotOpenClawConfig({
      gatewayUrl: 'http://127.0.0.1:20000',
      token: 'new-token',
      autoConnect: false,
      reconnect: true,
      reconnectInterval: 4500,
      maxReconnectAttempts: 7,
      heartbeatInterval: 45000,
      temperature: 1.1,
      maxTokens: 8192,
      topP: 1.0,
      presencePenalty: 0.0,
      frequencyPenalty: 0.0
    })

    expect(window.localStorage.getItem('hula-chat-openclaw-config')).toBe(
      '{"gatewayUrl":"http://127.0.0.1:20000","autoConnect":false,"reconnect":true,"reconnectInterval":4500,"maxReconnectAttempts":7,"heartbeatInterval":45000,"temperature":1.1,"maxTokens":8192,"topP":1,"presencePenalty":0,"frequencyPenalty":0}'
    )
    expect(setSecureSecretMock).toHaveBeenCalledWith('hula-chat-openclaw-token', 'new-token')
  })
})
