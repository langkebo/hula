import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const initConfigMock = vi.fn()
vi.mock('@/services/ConfigService', () => ({
  configService: {
    initConfig: () => initConfigMock()
  }
}))
vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const { parseIceServerEntry, getIceConfiguration, setIceConfiguration, resetIceConfiguration, loadIceServers } =
  await import('../iceServers')

describe('parseIceServerEntry', () => {
  it('returns null for non-object / null input', () => {
    expect(parseIceServerEntry(null)).toBeNull()
    expect(parseIceServerEntry('string')).toBeNull()
    expect(parseIceServerEntry(42)).toBeNull()
  })

  it('returns null when urls is missing or empty', () => {
    expect(parseIceServerEntry({})).toBeNull()
    expect(parseIceServerEntry({ urls: [] })).toBeNull()
    expect(parseIceServerEntry({ urls: 'not-array' })).toBeNull()
  })

  it('returns bare entry when urls is present without credentials', () => {
    expect(parseIceServerEntry({ urls: ['stun:a'] })).toEqual({ urls: ['stun:a'] })
  })

  it('returns credentialed entry when username + credential both present', () => {
    expect(parseIceServerEntry({ urls: ['turn:a'], username: 'u', credential: 'p' })).toEqual({
      urls: ['turn:a'],
      username: 'u',
      credential: 'p'
    })
  })

  it('omits credentials when only one of username/credential is present', () => {
    expect(parseIceServerEntry({ urls: ['turn:a'], username: 'u' })).toEqual({ urls: ['turn:a'] })
    expect(parseIceServerEntry({ urls: ['turn:a'], credential: 'p' })).toEqual({ urls: ['turn:a'] })
  })
})

describe('getIceConfiguration / setIceConfiguration / resetIceConfiguration', () => {
  afterEach(() => {
    resetIceConfiguration()
  })

  it('returns the built-in default initially', () => {
    resetIceConfiguration()
    const cfg = getIceConfiguration()
    expect(cfg.iceServers?.length).toBeGreaterThan(0)
    expect(cfg.iceTransportPolicy).toBe('all')
  })

  it('setIceConfiguration swaps the current config', () => {
    setIceConfiguration({ iceServers: [{ urls: 'stun:x' }], iceTransportPolicy: 'relay' })
    expect(getIceConfiguration().iceTransportPolicy).toBe('relay')
  })

  it('resetIceConfiguration returns to the default', () => {
    setIceConfiguration({ iceServers: [], iceTransportPolicy: 'relay' })
    resetIceConfiguration()
    expect(getIceConfiguration().iceTransportPolicy).toBe('all')
  })
})

describe('loadIceServers', () => {
  beforeEach(() => {
    resetIceConfiguration()
    initConfigMock.mockReset()
  })

  it('swaps in server-provided config when valid', async () => {
    initConfigMock.mockResolvedValueOnce({
      iceServer: { urls: ['turn:remote:3478'], username: 'u', credential: 'p' }
    })
    await loadIceServers()
    const cfg = getIceConfiguration()
    expect(cfg.iceServers).toEqual([{ urls: ['turn:remote:3478'], username: 'u', credential: 'p' }])
    expect(cfg.iceTransportPolicy).toBe('all')
  })

  it('keeps default when server response lacks iceServer', async () => {
    initConfigMock.mockResolvedValueOnce({})
    await loadIceServers()
    const cfg = getIceConfiguration()
    // Default has 2 entries (stun + turn pair)
    expect(cfg.iceServers?.length).toBe(2)
  })

  it('keeps default when server response has empty urls', async () => {
    initConfigMock.mockResolvedValueOnce({ iceServer: { urls: [] } })
    await loadIceServers()
    expect(getIceConfiguration().iceServers?.length).toBe(2)
  })

  it('swallows backend errors and keeps current config', async () => {
    initConfigMock.mockRejectedValueOnce(new Error('net'))
    await expect(loadIceServers()).resolves.toBeUndefined()
    expect(getIceConfiguration().iceServers?.length).toBe(2)
  })
})
