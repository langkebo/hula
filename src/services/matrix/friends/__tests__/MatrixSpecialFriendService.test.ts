import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null)
  }
}))

const createAccountDataEvent = (specialFriends: string[]) =>
  ({
    getContent: () => ({
      special_friends: specialFriends
    })
  }) as any

const { default: matrixClientService } = await import('../../MatrixClientService')
const { matrixSpecialFriendService } = await import('../MatrixSpecialFriendService')

describe('MatrixSpecialFriendService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matrixSpecialFriendService.clearCache()
    ;(matrixSpecialFriendService as any).observedClient = null
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

    vi.mocked(matrixClientService.getClient).mockReturnValue(oldClient as any)
    await expect(matrixSpecialFriendService.getSpecialFriends()).resolves.toEqual(['@old:example.com'])

    vi.mocked(matrixClientService.getClient).mockReturnValue(newClient as any)
    await expect(matrixSpecialFriendService.getSpecialFriends()).resolves.toEqual(['@new:example.com'])

    expect(oldClient.on).toHaveBeenCalledWith('accountData', expect.any(Function))
    expect(oldClient.off).toHaveBeenCalledWith('accountData', expect.any(Function))
    expect(newClient.on).toHaveBeenCalledWith('accountData', expect.any(Function))
  })
})
