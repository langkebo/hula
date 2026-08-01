import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
}))

vi.mock('../../MatrixRequestDeduper', () => ({
  MatrixRequestDeduper: {
    dedupe: vi.fn(async (_key: string, task: () => Promise<unknown>) => task())
  }
}))

import matrixClientService from '../../MatrixClientService'
import {
  __ROOM_CAPABILITIES_TTL_MS__,
  ROOM_CAPABILITY_NAMES,
  roomCapabilitiesService
} from '../RoomCapabilitiesService'

function mockClientWithCapabilities(
  result:
    | {
        room_id?: string
        room_version?: string
        capabilities?: Record<string, { enabled?: boolean }>
        features?: Record<string, { enabled?: boolean }>
        join_rule?: string
      }
    | Error
) {
  const getRoomCapabilities = vi.fn()
  if (result instanceof Error) {
    getRoomCapabilities.mockRejectedValue(result)
  } else {
    getRoomCapabilities.mockResolvedValue(result)
  }
  vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
    getRoomSummaryManager: () => ({ getRoomCapabilities })
  } as unknown as MatrixClient)
  return getRoomCapabilities
}

describe('RoomCapabilitiesService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    roomCapabilitiesService.invalidate()
  })

  it('returns capability payload from SDK on first fetch', async () => {
    const getRoomCapabilities = mockClientWithCapabilities({
      room_id: '!a:server',
      room_version: '11',
      capabilities: { knock: { enabled: true }, threading: { enabled: false } },
      features: { encryption: { enabled: true } }
    })

    const result = await roomCapabilitiesService.fetch('!a:server')

    expect(getRoomCapabilities).toHaveBeenCalledWith('!a:server')
    expect(result?.room_version).toBe('11')
    expect(result?.capabilities?.threading?.enabled).toBe(false)
    expect(getRoomCapabilities).toHaveBeenCalledTimes(1)
  })

  it('serves later calls from cache within TTL', async () => {
    const getRoomCapabilities = mockClientWithCapabilities({
      room_id: '!cache:server',
      capabilities: { knock: { enabled: true } }
    })

    const first = await roomCapabilitiesService.fetch('!cache:server')
    const second = await roomCapabilitiesService.fetch('!cache:server')

    expect(first).toBe(second)
    expect(getRoomCapabilities).toHaveBeenCalledTimes(1)
  })

  it('refetches when force=true', async () => {
    const getRoomCapabilities = mockClientWithCapabilities({
      room_id: '!f:server',
      capabilities: { restricted: { enabled: false } }
    })

    await roomCapabilitiesService.fetch('!f:server')
    const refreshed = await roomCapabilitiesService.fetch('!f:server', { force: true })

    expect(refreshed?.capabilities?.restricted?.enabled).toBe(false)
    expect(getRoomCapabilities).toHaveBeenCalledTimes(2)
  })

  it('falls back to last cached payload on SDK failure', async () => {
    mockClientWithCapabilities({
      room_id: '!fb:server',
      capabilities: { knock: { enabled: true } }
    })
    await roomCapabilitiesService.fetch('!fb:server')

    mockClientWithCapabilities(new Error('boom'))
    const refreshed = await roomCapabilitiesService.fetch('!fb:server', { force: true })

    expect(refreshed?.capabilities?.knock?.enabled).toBe(true)
  })

  it('invalidate(roomId) drops only that entry', async () => {
    mockClientWithCapabilities({ room_id: '!x', capabilities: {} })
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

  it('returns null when roomId is empty', async () => {
    const result = await roomCapabilitiesService.fetch('')
    expect(result).toBeNull()
  })

  it('falls back to cache when client is null', async () => {
    roomCapabilitiesService.__test__setCache('!null:server', { room_id: '!null:server' })
    const result = await roomCapabilitiesService.fetch('!null:server')
    expect(result?.room_id).toBe('!null:server')
  })
})
