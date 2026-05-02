import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null as MatrixClient | null)
  }
}))

const createAccountDataEvent = (specialFriends: string[]) =>
  ({
    getContent: () => ({
      special_friends: specialFriends
    })
  }) as unknown as MatrixEvent

const { default: matrixClientService } = await import('../../MatrixClientService')
const { matrixSpecialFriendService } = await import('../MatrixSpecialFriendService')
const { warn, error } = await import('@tauri-apps/plugin-log')

describe('MatrixSpecialFriendService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matrixSpecialFriendService.clearCache()
    ;(matrixSpecialFriendService as unknown as { observedClient: unknown }).observedClient = null
  })

  it('warns once and returns an empty list before the matrix client is ready', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    await expect(matrixSpecialFriendService.getSpecialFriends()).resolves.toEqual([])
    await expect(matrixSpecialFriendService.getSpecialFriends()).resolves.toEqual([])

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('[SpecialFriend] Matrix 客户端未就绪，返回空特别关注列表')
    expect(error).not.toHaveBeenCalled()
  })

  it('refreshes cache and sync listener when matrix client changes', async () => {
    const oldClient = {
      on: vi.fn(),
      off: vi.fn(),
      getAccountData: vi.fn(() => createAccountDataEvent(['@old:example.com']))
    }
    const newClient = {
      on: vi.fn(),
      off: vi.fn(),
      getAccountData: vi.fn(() => createAccountDataEvent(['@new:example.com']))
    }

    vi.mocked(matrixClientService.getClient).mockReturnValue(oldClient as unknown as MatrixClient)
    await expect(matrixSpecialFriendService.getSpecialFriends()).resolves.toEqual(['@old:example.com'])

    vi.mocked(matrixClientService.getClient).mockReturnValue(newClient as unknown as MatrixClient)
    await expect(matrixSpecialFriendService.getSpecialFriends()).resolves.toEqual(['@new:example.com'])

    expect(oldClient.on).toHaveBeenCalledWith('accountData', expect.any(Function))
    expect(oldClient.off).toHaveBeenCalledWith('accountData', expect.any(Function))
    expect(newClient.on).toHaveBeenCalledWith('accountData', expect.any(Function))
  })
})
