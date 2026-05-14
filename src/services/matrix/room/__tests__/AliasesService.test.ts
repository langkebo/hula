import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getClientMock = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  default: { getClient: () => getClientMock() },
  matrixClientService: { getClient: () => getClientMock() }
}))

const { MatrixRoomAliasesService } = await import('../AliasesService')

const makeRoom = (canonical: string | null, alts: string[] = []) =>
  ({
    getCanonicalAlias: () => canonical,
    getAltAliases: () => alts
  }) as unknown as Parameters<typeof Object>[0]

describe('MatrixRoomAliasesService', () => {
  let service: InstanceType<typeof MatrixRoomAliasesService>

  beforeEach(() => {
    service = new MatrixRoomAliasesService()
    getClientMock.mockReset()
  })

  it('getAliases throws when client is not initialized', async () => {
    getClientMock.mockReturnValueOnce(null)
    await expect(service.getAliases('!r')).rejects.toThrow('客户端未初始化')
  })

  it('getAliases returns [] when room is not in local cache', async () => {
    getClientMock.mockReturnValueOnce({ getRoom: () => null })
    expect(await service.getAliases('!r')).toEqual([])
  })

  it('getAliases prepends the canonical alias in front of alts', async () => {
    const room = makeRoom('#canon:e', ['#alt1:e', '#alt2:e'])
    getClientMock.mockReturnValueOnce({ getRoom: () => room })
    expect(await service.getAliases('!r')).toEqual(['#canon:e', '#alt1:e', '#alt2:e'])
  })

  it('getAliases returns only alts when there is no canonical', async () => {
    const room = makeRoom(null, ['#alt:e'])
    getClientMock.mockReturnValueOnce({ getRoom: () => room })
    expect(await service.getAliases('!r')).toEqual(['#alt:e'])
  })

  it('getAliases returns [] when room has no aliases at all', async () => {
    const room = makeRoom(null, [])
    getClientMock.mockReturnValueOnce({ getRoom: () => room })
    expect(await service.getAliases('!r')).toEqual([])
  })

  it('setAlias forwards to client.createAlias', async () => {
    const createAlias = vi.fn().mockResolvedValue(undefined)
    getClientMock.mockReturnValueOnce({ createAlias })
    await service.setAlias('!r', '#new:e')
    expect(createAlias).toHaveBeenCalledWith('#new:e', '!r')
  })

  it('setAlias re-throws backend errors', async () => {
    const createAlias = vi.fn().mockRejectedValue(new Error('conflict'))
    getClientMock.mockReturnValueOnce({ createAlias })
    await expect(service.setAlias('!r', '#x:e')).rejects.toThrow('conflict')
  })

  it('deleteAlias forwards to client.deleteAlias', async () => {
    const deleteAlias = vi.fn().mockResolvedValue(undefined)
    getClientMock.mockReturnValueOnce({ deleteAlias })
    await service.deleteAlias('#old:e')
    expect(deleteAlias).toHaveBeenCalledWith('#old:e')
  })

  it('deleteAlias re-throws backend errors', async () => {
    const deleteAlias = vi.fn().mockRejectedValue(new Error('404'))
    getClientMock.mockReturnValueOnce({ deleteAlias })
    await expect(service.deleteAlias('#old:e')).rejects.toThrow('404')
  })
})
