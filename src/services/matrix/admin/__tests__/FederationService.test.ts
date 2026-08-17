import type { AdminManager } from 'matrix-js-sdk/admin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminFederationService } from '../FederationService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const makeAdmin = () => ({
  getFederationDestinations: vi.fn(),
  getFederationDestination: vi.fn(),
  resetFederationConnection: vi.fn(),
  getFederationBlacklist: vi.fn(),
  addToFederationBlacklist: vi.fn(),
  removeFromFederationBlacklist: vi.fn()
})

describe('AdminFederationService', () => {
  let admin: ReturnType<typeof makeAdmin>
  let service: AdminFederationService

  beforeEach(() => {
    vi.clearAllMocks()
    admin = makeAdmin()
    service = new AdminFederationService(async () => admin as unknown as AdminManager)
  })

  it('getFederationDestinations 将 snake_case 映射为 camelCase', async () => {
    admin.getFederationDestinations.mockResolvedValueOnce([
      {
        destination: 'remote.hs',
        retry_last_ts: 1,
        retry_interval: 2,
        failure_ts: 3,
        last_successful_stream_ordering: 4
      }
    ])

    await expect(service.getFederationDestinations()).resolves.toEqual([
      {
        destination: 'remote.hs',
        retryLastTs: 1,
        retryInterval: 2,
        failureTs: 3,
        lastSuccessfulStreamOrdering: 4
      }
    ])
  })

  it('getFederationDestination 缺 destination 字段时用入参回填', async () => {
    admin.getFederationDestination.mockResolvedValueOnce({ retry_last_ts: 9 })

    const result = await service.getFederationDestination('fallback.hs')
    expect(result?.destination).toBe('fallback.hs')
  })

  it('resetFederationConnection 失败时向上抛出', async () => {
    admin.resetFederationConnection.mockRejectedValueOnce(new Error('reset-fail'))
    await expect(service.resetFederationConnection('remote.hs')).rejects.toThrow('reset-fail')
  })

  it('getFederationBlacklist 委托 AdminManager 并映射 server_name→domain', async () => {
    admin.getFederationBlacklist.mockResolvedValueOnce([{ server_name: 'evil.hs', reason: 'spam', added_ts: 100 }])

    await expect(service.getFederationBlacklist()).resolves.toEqual([
      { domain: 'evil.hs', reason: 'spam', addedBy: undefined, addedAt: 100 }
    ])
    expect(admin.getFederationBlacklist).toHaveBeenCalled()
  })

  it('addToFederationBlacklist 委托 AdminManager 并返回布尔结果', async () => {
    admin.addToFederationBlacklist.mockResolvedValueOnce(undefined)
    await expect(service.addToFederationBlacklist('evil.hs', 'spam')).resolves.toBe(true)
    expect(admin.addToFederationBlacklist).toHaveBeenCalledWith('evil.hs', 'spam')

    admin.addToFederationBlacklist.mockRejectedValueOnce(new Error('boom'))
    await expect(service.addToFederationBlacklist('evil.hs')).resolves.toBe(false)
  })

  it('removeFromFederationBlacklist 委托 AdminManager 且失败时返回 false', async () => {
    admin.removeFromFederationBlacklist.mockResolvedValueOnce(undefined)
    await expect(service.removeFromFederationBlacklist('evil.hs')).resolves.toBe(true)
    expect(admin.removeFromFederationBlacklist).toHaveBeenCalledWith('evil.hs')

    admin.removeFromFederationBlacklist.mockRejectedValueOnce(new Error('boom'))
    await expect(service.removeFromFederationBlacklist('evil.hs')).resolves.toBe(false)
  })
})
