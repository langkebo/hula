import type { MatrixClient } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import endpointCapabilityService from '../EndpointCapabilityService'
import matrixClientService from '../MatrixClientService'
import { getRuntimeAwareFetch } from '../network/runtimeFetch'

vi.mock('../MatrixClientService', () => ({
  default: { getClient: vi.fn() }
}))

vi.mock('../network/runtimeFetch', () => ({
  getRuntimeAwareFetch: vi.fn()
}))

function makeResponse(status: number): Response {
  const ok = status >= 200 && status < 300
  return { status, ok } as Response
}

function makeClient(): MatrixClient {
  return {
    getHomeserverUrl: () => 'https://hs.example.com',
    getAccessToken: () => 'tok'
  } as unknown as MatrixClient
}

describe('EndpointCapabilityService', () => {
  const getClient = matrixClientService.getClient as ReturnType<typeof vi.fn>
  const getRuntimeAwareFetchMock = getRuntimeAwareFetch as ReturnType<typeof vi.fn>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    endpointCapabilityService.clear()
    getClient.mockReset()
    getRuntimeAwareFetchMock.mockReset()
    fetchMock = vi.fn()
    getRuntimeAwareFetchMock.mockReturnValue(fetchMock)
    getClient.mockReturnValue(makeClient())
  })

  afterEach(() => {
    endpointCapabilityService.clear()
  })

  it('returns false and does not cache when client is missing', async () => {
    getClient.mockReturnValue(null)
    const result = await endpointCapabilityService.check('GET', '/friends')
    expect(result).toBe(false)
    expect(endpointCapabilityService.getCacheSnapshot().size).toBe(0)
  })

  it('builds GET url with limit=0 and auth header', async () => {
    fetchMock.mockResolvedValue(makeResponse(200))
    await endpointCapabilityService.check('GET', '/friends')
    expect(fetchMock).toHaveBeenCalledWith('https://hs.example.com/friends?limit=0', {
      method: 'GET',
      headers: { Authorization: 'Bearer tok' }
    })
  })

  it('adds limit=0 with & when path already has query', async () => {
    fetchMock.mockResolvedValue(makeResponse(200))
    await endpointCapabilityService.check('GET', '/search?q=a')
    expect(fetchMock).toHaveBeenCalledWith('https://hs.example.com/search?q=a&limit=0', expect.anything())
  })

  it('uses OPTIONS for non-GET methods', async () => {
    fetchMock.mockResolvedValue(makeResponse(200))
    await endpointCapabilityService.check('POST', '/friends/request')
    expect(fetchMock).toHaveBeenCalledWith('https://hs.example.com/friends/request', {
      method: 'OPTIONS',
      headers: { Authorization: 'Bearer tok' }
    })
  })

  it('treats 2xx as available and caches', async () => {
    fetchMock.mockResolvedValue(makeResponse(200))
    expect(await endpointCapabilityService.check('GET', '/a')).toBe(true)
    expect(endpointCapabilityService.getCacheSnapshot().get('GET:/a')?.available).toBe(true)
  })

  it.each([[405], [401], [403]])('treats status %s as available', async (status) => {
    fetchMock.mockResolvedValue(makeResponse(status))
    expect(await endpointCapabilityService.check('GET', '/a')).toBe(true)
  })

  it('treats 404 as unavailable and caches', async () => {
    fetchMock.mockResolvedValue(makeResponse(404))
    expect(await endpointCapabilityService.check('GET', '/a')).toBe(false)
    expect(endpointCapabilityService.getCacheSnapshot().get('GET:/a')?.available).toBe(false)
  })

  it('treats 5xx as unavailable without caching', async () => {
    fetchMock.mockResolvedValue(makeResponse(500))
    expect(await endpointCapabilityService.check('GET', '/a')).toBe(false)
    expect(endpointCapabilityService.getCacheSnapshot().size).toBe(0)
  })

  it('returns false and does not cache on network error', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    expect(await endpointCapabilityService.check('GET', '/a')).toBe(false)
    expect(endpointCapabilityService.getCacheSnapshot().size).toBe(0)
  })

  it('serves cached result within TTL without refetching', async () => {
    fetchMock.mockResolvedValue(makeResponse(200))
    expect(await endpointCapabilityService.check('GET', '/a')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // 第二次命中缓存，不再调用 fetch
    expect(await endpointCapabilityService.check('GET', '/a')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refetches when ttl=0 (always expire)', async () => {
    fetchMock.mockResolvedValue(makeResponse(200))
    const svc = new (endpointCapabilityService.constructor as new (ttl?: number) => typeof endpointCapabilityService)(0)
    await svc.check('GET', '/a')
    await svc.check('GET', '/a')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('checkBatch resolves all endpoints concurrently', async () => {
    fetchMock.mockResolvedValue(makeResponse(200))
    const results = await endpointCapabilityService.checkBatch([
      { method: 'GET', path: '/a' },
      { method: 'GET', path: '/b' }
    ])
    expect(results.get('GET:/a')).toBe(true)
    expect(results.get('GET:/b')).toBe(true)
  })

  it('clear(path) deletes only matching keys', async () => {
    fetchMock.mockResolvedValue(makeResponse(200))
    await endpointCapabilityService.check('GET', '/friends')
    await endpointCapabilityService.check('GET', '/rooms')
    endpointCapabilityService.clear('/friends')
    expect(endpointCapabilityService.getCacheSnapshot().has('GET:/friends')).toBe(false)
    expect(endpointCapabilityService.getCacheSnapshot().has('GET:/rooms')).toBe(true)
  })

  it('clear() empties the cache', async () => {
    fetchMock.mockResolvedValue(makeResponse(200))
    await endpointCapabilityService.check('GET', '/a')
    await endpointCapabilityService.check('GET', '/b')
    endpointCapabilityService.clear()
    expect(endpointCapabilityService.getCacheSnapshot().size).toBe(0)
  })
})
