/**
 * User service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Tests URL construction for MatrixAccountService, MatrixDeviceService,
 * and MatrixPresenceService.
 */
import { createClient, extendMatrixClientWithManagers, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixAccountService } from '../MatrixAccountService'
import { matrixDeviceService } from '../MatrixDeviceService'
import { matrixPresenceService } from '../MatrixPresenceService'

const HOMESERVER = 'https://hs.user-contract.test'
const seenUrls: string[] = []
let realClient: MatrixClient

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: () => realClient,
    getHomeserverUrl: () => HOMESERVER,
    waitForClientReady: () => Promise.resolve(realClient)
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

setupMswServer(
  http.get(`${HOMESERVER}/_matrix/client/versions`, () => {
    return HttpResponse.json({ versions: ['v3'], unstable_features: {} })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/thirdparty/protocols`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({ protocols: {} })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/my_rooms`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({ room_ids: ['!room1:test', '!room2:test'] })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/events`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({ start: 's1', end: 's2', chunk: [] })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/devices`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({ devices: [{ device_id: 'DEV1', display_name: 'Test' }] })
  }),
  http.post(`${HOMESERVER}/_matrix/client/v3/delete_devices`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({})
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/room_keys/request`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({ requests: [] })
  }),
  http.post(`${HOMESERVER}/_matrix/client/v3/presence/list`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({})
  })
)

describe('User service URL construction contract (real SDK + msw)', () => {
  beforeAll(async () => {
    await extendMatrixClientWithManagers()
  })

  beforeEach(() => {
    seenUrls.length = 0
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.user-contract.test',
      deviceId: 'DEV1'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // --- MatrixAccountService ---

  it('getThirdPartyProtocols hits /_matrix/client/v3/thirdparty/protocols (no duplication)', async () => {
    await matrixAccountService.getThirdPartyProtocols()

    const calls = seenUrls.filter((u) => u.includes('/thirdparty/protocols'))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/thirdparty/protocols`)
  })

  it('getMyRooms hits /_matrix/client/v3/my_rooms (no duplication)', async () => {
    const result = await matrixAccountService.getMyRooms()

    const calls = seenUrls.filter((u) => u.includes('/my_rooms'))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/my_rooms`)
    expect(result).toEqual(['!room1:test', '!room2:test'])
  })

  it('getEventStream hits /_matrix/client/v3/events (no duplication)', async () => {
    await matrixAccountService.getEventStream(undefined, 1000)

    const calls = seenUrls.filter((u) => u.includes('/events'))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/events?timeout=1000`)
  })

  // --- MatrixDeviceService ---

  it('getDevices hits /_matrix/client/v3/devices (no duplication)', async () => {
    await matrixDeviceService.getDevices()

    const calls = seenUrls.filter((u) => u.includes('/devices'))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/devices`)
  })

  it('deleteDevices hits /_matrix/client/v3/delete_devices (no duplication)', async () => {
    await matrixDeviceService.deleteDevices(['DEV2'])

    const calls = seenUrls.filter((u) => u.includes('/delete_devices'))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/delete_devices`)
  })

  it('getRoomKeyRequests delegates to RoomKeysManager.getRoomKeyRequests', async () => {
    // room-keys module is not in the default SDK extensions; mock the manager
    // to verify delegation (URL construction is covered by SDK unit tests)
    const mockGetRoomKeyRequests = vi.fn().mockResolvedValue({ requests: [] })
    ;(realClient as unknown as Record<string, unknown>).getRoomKeysManager = () => ({
      getRoomKeyRequests: mockGetRoomKeyRequests
    })

    await matrixDeviceService.getRoomKeyRequests()

    expect(mockGetRoomKeyRequests).toHaveBeenCalledOnce()
  })

  // --- MatrixPresenceService ---

  it('unsubscribeFromPresence hits /_matrix/client/v3/presence/list (no duplication)', async () => {
    await matrixPresenceService.unsubscribeFromPresence(['@user1:test', '@user2:test'])

    const calls = seenUrls.filter((u) => u.includes('/presence/list'))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/presence/list`)
  })
})
