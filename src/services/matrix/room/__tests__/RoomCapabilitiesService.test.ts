import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn()
}))

const mockAuthedRequest = vi.fn()
const mockAccessorClient = {
  http: {
    authedRequest: mockAuthedRequest
  }
}

vi.mock('../../matrixClientAccessor', () => ({
  getMatrixClient: vi.fn(() => mockAccessorClient),
  getMatrixAccessToken: vi.fn(() => 'mock-token'),
  getMatrixHomeserverUrl: vi.fn(() => 'https://matrix.org'),
  getMatrixTelemetry: vi.fn(() => null),
  waitForMatrixClientReady: vi.fn(),
  setMatrixClientAccessor: vi.fn(),
  hasRegisteredMatrixClientAccessor: vi.fn(() => true),
  getMatrixClientAccessor: vi.fn(() => ({
    getClient: vi.fn(() => mockAccessorClient),
    getAccessToken: vi.fn(() => 'mock-token'),
    getHomeserverUrl: vi.fn(() => 'https://matrix.org')
  })),
  resetMatrixClientAccessorForTests: vi.fn()
}))

const { roomCapabilitiesService, ROOM_CAPABILITY_NAMES, __ROOM_CAPABILITIES_TTL_MS__ } = await import(
  '../RoomCapabilitiesService'
)

describe('RoomCapabilitiesService', () => {
  beforeEach(() => {
    mockAuthedRequest.mockReset()
    roomCapabilitiesService.invalidate()
  })

  it('returns capability payload from network on first fetch', async () => {
    mockAuthedRequest.mockResolvedValueOnce({
      room_id: '!a:server',
      room_version: '11',
      capabilities: { knock: { enabled: true }, threading: { enabled: false } },
      features: { encryption: { enabled: true } }
    })

    const result = await roomCapabilitiesService.fetch('!a:server')

    expect(result?.room_version).toBe('11')
    expect(result?.capabilities?.threading?.enabled).toBe(false)
    expect(mockAuthedRequest).toHaveBeenCalledTimes(1)
  })

  it('serves later calls from cache within TTL', async () => {
    mockAuthedRequest.mockResolvedValueOnce({
      room_id: '!cache:server',
      capabilities: { knock: { enabled: true } }
    })

    const first = await roomCapabilitiesService.fetch('!cache:server')
    const second = await roomCapabilitiesService.fetch('!cache:server')

    expect(first).toBe(second)
    expect(mockAuthedRequest).toHaveBeenCalledTimes(1)
  })

  it('refetches when force=true', async () => {
    mockAuthedRequest.mockResolvedValueOnce({ room_id: '!f:server', capabilities: {} })
    mockAuthedRequest.mockResolvedValueOnce({
      room_id: '!f:server',
      capabilities: { restricted: { enabled: false } }
    })

    await roomCapabilitiesService.fetch('!f:server')
    const refreshed = await roomCapabilitiesService.fetch('!f:server', { force: true })

    expect(refreshed?.capabilities?.restricted?.enabled).toBe(false)
    expect(mockAuthedRequest).toHaveBeenCalledTimes(2)
  })

  it('falls back to last cached payload on network failure', async () => {
    mockAuthedRequest.mockResolvedValueOnce({ room_id: '!fb:server', capabilities: { knock: { enabled: true } } })
    await roomCapabilitiesService.fetch('!fb:server')

    mockAuthedRequest.mockRejectedValueOnce(new Error('boom'))
    const refreshed = await roomCapabilitiesService.fetch('!fb:server', { force: true })

    expect(refreshed?.capabilities?.knock?.enabled).toBe(true)
  })

  it('invalidate(roomId) drops only that entry', async () => {
    mockAuthedRequest.mockResolvedValue({ room_id: '!x', capabilities: {} })
    await roomCapabilitiesService.fetch('!a:server')
    await roomCapabilitiesService.fetch('!b:server')

    roomCapabilitiesService.invalidate('!a:server')
    expect(roomCapabilitiesService.peek('!a:server')).toBeNull()
    expect(roomCapabilitiesService.peek('!b:server')).not.toBeNull()
  })

  it('peek returns null after TTL expiry', () => {
    roomCapabilitiesService.__test__setCache('!t:server', { room_id: '!t:server' }, -1)
    expect(roomCapabilitiesService.peek('!t:server')).toBeNull()
  })

  it('isCapabilityEnabled treats missing entry as enabled', () => {
    const payload = { room_id: '!c:server', capabilities: { threading: { enabled: false } } }
    expect(roomCapabilitiesService.isCapabilityEnabled(payload, 'threading')).toBe(false)
    expect(roomCapabilitiesService.isCapabilityEnabled(payload, 'knock')).toBe(true)
  })

  it('exports stable capability names from contract', () => {
    expect(ROOM_CAPABILITY_NAMES).toEqual(['knock', 'restricted', 'threading', 'read_receipts', 'typing_notifications'])
  })

  it('exposes TTL constant for diagnostics', () => {
    expect(__ROOM_CAPABILITIES_TTL_MS__).toBeGreaterThan(0)
  })
})
