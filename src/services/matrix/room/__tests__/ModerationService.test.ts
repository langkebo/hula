import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getClientMock = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  default: { getClient: () => getClientMock() }
}))

const { MatrixRoomModerationService } = await import('../ModerationService')

const makeHttp = (impl: (method: string, url: string, qp?: unknown, body?: unknown) => unknown) => ({
  http: {
    authedRequest: vi.fn((method: string, url: string, qp?: unknown, body?: unknown) => impl(method, url, qp, body))
  }
})

describe('MatrixRoomModerationService', () => {
  let service: InstanceType<typeof MatrixRoomModerationService>

  beforeEach(() => {
    service = new MatrixRoomModerationService()
    getClientMock.mockReset()
  })

  it('getInviteBlocklist throws when client is not initialized', async () => {
    getClientMock.mockReturnValueOnce(null)
    await expect(service.getInviteBlocklist('!r')).rejects.toThrow('[MatrixRoom] 客户端未初始化')
  })

  it('getInviteBlocklist GETs the right URL and unwraps `blocked`', async () => {
    const client = makeHttp(() => ({ blocked: ['@a:e'] }))
    getClientMock.mockReturnValueOnce(client)
    expect(await service.getInviteBlocklist('!r:e')).toEqual(['@a:e'])
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'GET',
      `/_matrix/client/v3/rooms/${encodeURIComponent('!r:e')}/invite_blocklist`
    )
  })

  it('getInviteBlocklist returns [] when backend omits `blocked`', async () => {
    getClientMock.mockReturnValueOnce(makeHttp(() => ({})))
    expect(await service.getInviteBlocklist('!r')).toEqual([])
  })

  it('getInviteBlocklist swallows errors and returns []', async () => {
    getClientMock.mockReturnValueOnce(
      makeHttp(() => {
        throw new Error('500')
      })
    )
    expect(await service.getInviteBlocklist('!r')).toEqual([])
  })

  it('setInviteBlocklist POSTs { blocked } to the right URL', async () => {
    const client = makeHttp(() => undefined)
    getClientMock.mockReturnValueOnce(client)
    await service.setInviteBlocklist('!r', ['@a:e', '@b:e'])
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'POST',
      `/_matrix/client/v3/rooms/${encodeURIComponent('!r')}/invite_blocklist`,
      undefined,
      { blocked: ['@a:e', '@b:e'] }
    )
  })

  it('setInviteBlocklist re-throws backend errors', async () => {
    getClientMock.mockReturnValueOnce(
      makeHttp(() => {
        throw new Error('403')
      })
    )
    await expect(service.setInviteBlocklist('!r', [])).rejects.toThrow('403')
  })

  it('getInviteAllowlist GETs the right URL and unwraps `allowed`', async () => {
    const client = makeHttp(() => ({ allowed: ['@x:e'] }))
    getClientMock.mockReturnValueOnce(client)
    expect(await service.getInviteAllowlist('!r')).toEqual(['@x:e'])
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'GET',
      `/_matrix/client/v3/rooms/${encodeURIComponent('!r')}/invite_allowlist`
    )
  })

  it('getInviteAllowlist swallows errors and returns []', async () => {
    getClientMock.mockReturnValueOnce(
      makeHttp(() => {
        throw new Error('500')
      })
    )
    expect(await service.getInviteAllowlist('!r')).toEqual([])
  })

  it('setInviteAllowlist POSTs { allowed } to the right URL', async () => {
    const client = makeHttp(() => undefined)
    getClientMock.mockReturnValueOnce(client)
    await service.setInviteAllowlist('!r', ['@x:e'])
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'POST',
      `/_matrix/client/v3/rooms/${encodeURIComponent('!r')}/invite_allowlist`,
      undefined,
      { allowed: ['@x:e'] }
    )
  })

  it('setInviteAllowlist re-throws backend errors', async () => {
    getClientMock.mockReturnValueOnce(
      makeHttp(() => {
        throw new Error('403')
      })
    )
    await expect(service.setInviteAllowlist('!r', [])).rejects.toThrow('403')
  })
})
