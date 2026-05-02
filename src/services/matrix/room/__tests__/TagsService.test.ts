import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getClientMock = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  default: { getClient: () => getClientMock() as MatrixClient }
}))

const enqueueMock = vi.fn()
vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    enqueue: (type: string, status: string, data: unknown) => enqueueMock(type, status, data)
  }
}))

const { MatrixRoomTagsService } = await import('../TagsService')

function makeClient(
  userId: string | null,
  httpImpl: (method: string, url: string, qp?: unknown, body?: unknown) => unknown
): MatrixClient {
  return {
    getUserId: () => userId,
    http: {
      authedRequest: vi.fn((method: string, url: string, qp?: unknown, body?: unknown) =>
        httpImpl(method, url, qp, body)
      )
    }
  } as unknown as MatrixClient
}

describe('MatrixRoomTagsService', () => {
  let service: InstanceType<typeof MatrixRoomTagsService>

  beforeEach(() => {
    service = new MatrixRoomTagsService()
    getClientMock.mockReset()
    enqueueMock.mockReset()
  })

  it('getTags throws when client is not initialized', async () => {
    getClientMock.mockReturnValueOnce(null)
    await expect(service.getTags('!r')).rejects.toThrow('客户端未初始化')
  })

  it('getTags returns {} when the user is not logged in', async () => {
    getClientMock.mockReturnValueOnce(makeClient(null, () => ({})))
    expect(await service.getTags('!r')).toEqual({})
  })

  it('getTags hits the expected endpoint and unwraps tags', async () => {
    const client = makeClient('@me:e', () => ({ tags: { 'm.favourite': { order: 0.5 } } }))
    getClientMock.mockReturnValueOnce(client)
    const result = await service.getTags('!r:e')
    expect(result).toEqual({ 'm.favourite': { order: 0.5 } })
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'GET',
      `/_matrix/client/v3/user/${encodeURIComponent('@me:e')}/rooms/${encodeURIComponent('!r:e')}/tags`
    )
  })

  it('getTags returns {} when backend payload omits tags field', async () => {
    getClientMock.mockReturnValueOnce(makeClient('@me:e', () => ({})))
    expect(await service.getTags('!r')).toEqual({})
  })

  it('getTags swallows backend errors and returns {}', async () => {
    getClientMock.mockReturnValueOnce(
      makeClient('@me:e', () => {
        throw new Error('500')
      })
    )
    expect(await service.getTags('!r')).toEqual({})
  })

  it('setTag posts order when provided', async () => {
    const client = makeClient('@me:e', () => undefined)
    getClientMock.mockReturnValueOnce(client)
    await service.setTag('!r', 'm.favourite', 0.5)
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'PUT',
      `/_matrix/client/v3/user/${encodeURIComponent('@me:e')}/rooms/${encodeURIComponent('!r')}/tags/${encodeURIComponent('m.favourite')}`,
      undefined,
      { order: 0.5 }
    )
  })

  it('setTag posts empty body when order is undefined', async () => {
    const client = makeClient('@me:e', () => undefined)
    getClientMock.mockReturnValueOnce(client)
    await service.setTag('!r', 'm.favourite')
    expect(client.http.authedRequest).toHaveBeenCalledWith('PUT', expect.any(String), undefined, {})
  })

  it('setTag throws when user is not logged in', async () => {
    getClientMock.mockReturnValueOnce(makeClient(null, () => undefined))
    await expect(service.setTag('!r', 'x')).rejects.toThrow('用户未登录')
  })

  it('setTag re-throws backend errors', async () => {
    getClientMock.mockReturnValueOnce(
      makeClient('@me:e', () => {
        throw new Error('403')
      })
    )
    await expect(service.setTag('!r', 'x')).rejects.toThrow('403')
  })

  it('setTag enqueues when offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    await service.setTag('!r', 'm.favourite', 0.5)
    expect(enqueueMock).toHaveBeenCalledWith('tag', '!r', {
      roomId: '!r',
      tag: 'm.favourite',
      order: 0.5,
      action: 'set'
    })
    vi.stubGlobal('navigator', { onLine: true })
  })

  it('removeTag issues DELETE to the tag url', async () => {
    const client = makeClient('@me:e', () => undefined)
    getClientMock.mockReturnValueOnce(client)
    await service.removeTag('!r', 'm.favourite')
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'DELETE',
      `/_matrix/client/v3/user/${encodeURIComponent('@me:e')}/rooms/${encodeURIComponent('!r')}/tags/${encodeURIComponent('m.favourite')}`
    )
  })

  it('removeTag re-throws backend errors', async () => {
    getClientMock.mockReturnValueOnce(
      makeClient('@me:e', () => {
        throw new Error('404')
      })
    )
    await expect(service.removeTag('!r', 'x')).rejects.toThrow('404')
  })

  it('removeTag enqueues when offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    await service.removeTag('!r', 'm.favourite')
    expect(enqueueMock).toHaveBeenCalledWith('tag', '!r', {
      roomId: '!r',
      tag: 'm.favourite',
      action: 'remove'
    })
    vi.stubGlobal('navigator', { onLine: true })
  })
})
