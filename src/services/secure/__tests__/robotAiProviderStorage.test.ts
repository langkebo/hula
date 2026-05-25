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
  loadRobotTrendRadarConfig,
  saveRobotAiProvider,
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

  it('stores provider in a user-scoped namespace', () => {
    const scope = { userId: '@alice:hula.im' }

    saveRobotAiProvider('hula', scope)

    expect(loadRobotAiProvider(scope)).toBe('hula')
    expect(window.localStorage.getItem('hula-chat-ai-provider::@alice:hula.im')).toBe('hula')
  })
})
