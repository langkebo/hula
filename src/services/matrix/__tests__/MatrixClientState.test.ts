import { describe, expect, it, vi } from 'vitest'
import type { MatrixClient, SlidingSync, User } from '@/services/matrix/sdk'
import { MatrixClientState, type MatrixClientStateDeps } from '../MatrixClientState'

const asUnknown = <T>(value: unknown): T => value as unknown as T

function makeClient(partial: Partial<Record<string, unknown>> = {}): MatrixClient {
  return asUnknown<MatrixClient>({
    getUserId: vi.fn(),
    getAccessToken: vi.fn(),
    getHomeserverUrl: vi.fn(),
    getDomain: vi.fn(),
    getDeviceId: vi.fn(),
    getUser: vi.fn(),
    isRoomEncrypted: vi.fn(),
    ...partial
  })
}

function makeDeps(overrides: Partial<MatrixClientStateDeps> = {}): MatrixClientStateDeps {
  const connectionManager = overrides.connectionManager ?? {
    getClient: vi.fn(),
    getConfig: vi.fn(),
    getConnectionState: vi.fn(),
    updateConnectionState: vi.fn()
  }
  const syncManager = overrides.syncManager ?? {
    get: vi.fn()
  }
  const cryptoTracker = overrides.cryptoTracker ?? {
    getRustCryptoDebugState: vi.fn(),
    getEventDecryptedDebugState: vi.fn()
  }
  return {
    connectionManager: asUnknown<MatrixClientStateDeps['connectionManager']>(connectionManager),
    syncManager: asUnknown<MatrixClientStateDeps['syncManager']>(syncManager),
    cryptoTracker: asUnknown<MatrixClientStateDeps['cryptoTracker']>(cryptoTracker)
  }
}

function getMockedDeps(deps: MatrixClientStateDeps) {
  return {
    connectionManager: deps.connectionManager as unknown as {
      getClient: ReturnType<typeof vi.fn>
      getConfig: ReturnType<typeof vi.fn>
      getConnectionState: ReturnType<typeof vi.fn>
      updateConnectionState: ReturnType<typeof vi.fn>
    },
    syncManager: deps.syncManager as unknown as { get: ReturnType<typeof vi.fn> },
    cryptoTracker: deps.cryptoTracker as unknown as {
      getRustCryptoDebugState: ReturnType<typeof vi.fn>
      getEventDecryptedDebugState: ReturnType<typeof vi.fn>
    }
  }
}

describe('MatrixClientState', () => {
  it('getClient returns the client from connectionManager', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const client = makeClient()
    mocked.connectionManager.getClient.mockReturnValue(client)
    const state = new MatrixClientState(deps)
    expect(state.getClient()).toBe(client)
  })

  it('getClient returns null when connectionManager has no client', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    mocked.connectionManager.getClient.mockReturnValue(null)
    const state = new MatrixClientState(deps)
    expect(state.getClient()).toBeNull()
  })

  it('getConnectionState delegates to connectionManager', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    mocked.connectionManager.getConnectionState.mockReturnValue('CONNECTED')
    const state = new MatrixClientState(deps)
    expect(state.getConnectionState()).toBe('CONNECTED')
  })

  it('updateConnectionState delegates to connectionManager', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const state = new MatrixClientState(deps)
    state.updateConnectionState('RECONNECTING')
    expect(mocked.connectionManager.updateConnectionState).toHaveBeenCalledWith('RECONNECTING')
  })

  it('getSlidingSync returns the sliding sync instance', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const slidingSync = {} as SlidingSync
    mocked.syncManager.get.mockReturnValue(slidingSync)
    const state = new MatrixClientState(deps)
    expect(state.getSlidingSync()).toBe(slidingSync)
  })

  it('getSlidingSync returns null when syncManager has none', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    mocked.syncManager.get.mockReturnValue(null)
    const state = new MatrixClientState(deps)
    expect(state.getSlidingSync()).toBeNull()
  })

  it('getUserId returns the client user id', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const client = makeClient({ getUserId: vi.fn(() => '@alice:matrix.org') })
    mocked.connectionManager.getClient.mockReturnValue(client)
    const state = new MatrixClientState(deps)
    expect(state.getUserId()).toBe('@alice:matrix.org')
  })

  it('getUserId returns null when client is missing', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    mocked.connectionManager.getClient.mockReturnValue(null)
    const state = new MatrixClientState(deps)
    expect(state.getUserId()).toBeNull()
  })

  it('getAccessToken returns the client access token', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const client = makeClient({ getAccessToken: vi.fn(() => 'token-abc') })
    mocked.connectionManager.getClient.mockReturnValue(client)
    const state = new MatrixClientState(deps)
    expect(state.getAccessToken()).toBe('token-abc')
  })

  it('getAccessToken falls back to config accessToken when client getAccessToken is unavailable', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const client = makeClient({ getAccessToken: undefined })
    mocked.connectionManager.getClient.mockReturnValue(client)
    mocked.connectionManager.getConfig.mockReturnValue({ homeserverUrl: 'https://hs.test', accessToken: 'cfg-token' })
    const state = new MatrixClientState(deps)
    expect(state.getAccessToken()).toBe('cfg-token')
  })

  it('getAccessToken returns null when client and config are missing', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    mocked.connectionManager.getClient.mockReturnValue(null)
    mocked.connectionManager.getConfig.mockReturnValue(null)
    const state = new MatrixClientState(deps)
    expect(state.getAccessToken()).toBeNull()
  })

  it('getHomeserverUrl returns the client homeserver url', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const client = makeClient({ getHomeserverUrl: vi.fn(() => 'https://hs.test') })
    mocked.connectionManager.getClient.mockReturnValue(client)
    const state = new MatrixClientState(deps)
    expect(state.getHomeserverUrl()).toBe('https://hs.test')
  })

  it('getHomeserverUrl falls back to config homeserverUrl when client getHomeserverUrl is unavailable', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const client = makeClient({ getHomeserverUrl: undefined })
    mocked.connectionManager.getClient.mockReturnValue(client)
    mocked.connectionManager.getConfig.mockReturnValue({ homeserverUrl: 'https://cfg.test' })
    const state = new MatrixClientState(deps)
    expect(state.getHomeserverUrl()).toBe('https://cfg.test')
  })

  it('getHomeserverUrl returns null when client and config are missing', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    mocked.connectionManager.getClient.mockReturnValue(null)
    mocked.connectionManager.getConfig.mockReturnValue(null)
    const state = new MatrixClientState(deps)
    expect(state.getHomeserverUrl()).toBeNull()
  })

  it('getServerDomain returns the client domain', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const client = makeClient({ getDomain: vi.fn(() => 'matrix.org') })
    mocked.connectionManager.getClient.mockReturnValue(client)
    const state = new MatrixClientState(deps)
    expect(state.getServerDomain()).toBe('matrix.org')
  })

  it('getServerDomain returns empty string when client is missing', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    mocked.connectionManager.getClient.mockReturnValue(null)
    const state = new MatrixClientState(deps)
    expect(state.getServerDomain()).toBe('')
  })

  it('getServerDomain returns empty string when client has no getDomain', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const client = makeClient({ getDomain: undefined })
    mocked.connectionManager.getClient.mockReturnValue(client)
    const state = new MatrixClientState(deps)
    expect(state.getServerDomain()).toBe('')
  })

  it('getDeviceId returns the client device id', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const client = makeClient({ getDeviceId: vi.fn(() => 'DEVICE1') })
    mocked.connectionManager.getClient.mockReturnValue(client)
    const state = new MatrixClientState(deps)
    expect(state.getDeviceId()).toBe('DEVICE1')
  })

  it('getDeviceId returns null when client is missing', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    mocked.connectionManager.getClient.mockReturnValue(null)
    const state = new MatrixClientState(deps)
    expect(state.getDeviceId()).toBeNull()
  })

  it('getUser returns the user from the client', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const user = { userId: '@alice:matrix.org' } as User
    const client = makeClient({ getUser: vi.fn(() => user) })
    mocked.connectionManager.getClient.mockReturnValue(client)
    const state = new MatrixClientState(deps)
    expect(state.getUser('@alice:matrix.org')).toBe(user)
    expect(client.getUser).toHaveBeenCalledWith('@alice:matrix.org')
  })

  it('getUser returns null when client is missing', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    mocked.connectionManager.getClient.mockReturnValue(null)
    const state = new MatrixClientState(deps)
    expect(state.getUser('@alice:matrix.org')).toBeNull()
  })

  it('isRoomEncrypted returns the client result', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const client = makeClient({ isRoomEncrypted: vi.fn(() => true) })
    mocked.connectionManager.getClient.mockReturnValue(client)
    const state = new MatrixClientState(deps)
    expect(state.isRoomEncrypted('!room:matrix.org')).toBe(true)
    expect(client.isRoomEncrypted).toHaveBeenCalledWith('!room:matrix.org')
  })

  it('isRoomEncrypted returns false when client is missing', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    mocked.connectionManager.getClient.mockReturnValue(null)
    const state = new MatrixClientState(deps)
    expect(state.isRoomEncrypted('!room:matrix.org')).toBe(false)
  })

  it('isRoomEncrypted returns false when client has no isRoomEncrypted', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const client = makeClient({ isRoomEncrypted: undefined })
    mocked.connectionManager.getClient.mockReturnValue(client)
    const state = new MatrixClientState(deps)
    expect(state.isRoomEncrypted('!room:matrix.org')).toBe(false)
  })

  it('isCryptoReady returns true when crypto is initialized', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    mocked.cryptoTracker.getRustCryptoDebugState.mockReturnValue({
      attempted: true,
      initialized: true,
      skippedReason: null,
      error: null,
      usedIndexedDB: true
    })
    const state = new MatrixClientState(deps)
    expect(state.isCryptoReady()).toBe(true)
  })

  it('isCryptoReady returns false when crypto is not initialized', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    mocked.cryptoTracker.getRustCryptoDebugState.mockReturnValue({
      attempted: false,
      initialized: false,
      skippedReason: 'missing-client-or-access-token',
      error: null,
      usedIndexedDB: null
    })
    const state = new MatrixClientState(deps)
    expect(state.isCryptoReady()).toBe(false)
  })

  it('getRustCryptoDebugState delegates to cryptoTracker', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const debugState = {
      attempted: true,
      initialized: true,
      skippedReason: null,
      error: null,
      usedIndexedDB: true
    }
    mocked.cryptoTracker.getRustCryptoDebugState.mockReturnValue(debugState)
    const state = new MatrixClientState(deps)
    expect(state.getRustCryptoDebugState()).toBe(debugState)
  })

  it('getEventDecryptedDebugState delegates to cryptoTracker', () => {
    const deps = makeDeps()
    const mocked = getMockedDeps(deps)
    const eventState = { count: 3, lastEventId: '$e', lastRoomId: '!r', lastError: null }
    mocked.cryptoTracker.getEventDecryptedDebugState.mockReturnValue(eventState)
    const state = new MatrixClientState(deps)
    expect(state.getEventDecryptedDebugState()).toBe(eventState)
  })
})
