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
  removeFromFederationBlacklist: vi.fn(),
  getFederationCache: vi.fn(),
  clearFederationCache: vi.fn(),
  deleteFederationCacheEntry: vi.fn(),
  getPendingFederationServers: vi.fn(),
  confirmFederation: vi.fn()
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
    // SDK `FederationDestination` 的时间戳键是 `last_successful_ts`
    // （`admin-federation-types.d.ts:40`），不存在 `last_successful_stream_ordering`。
    admin.getFederationDestinations.mockResolvedValueOnce([
      {
        destination: 'remote.hs',
        retry_last_ts: 1,
        retry_interval: 2,
        failure_ts: 3,
        last_successful_ts: 4
      }
    ])

    await expect(service.getFederationDestinations()).resolves.toEqual([
      {
        destination: 'remote.hs',
        retryLastTs: 1,
        retryInterval: 2,
        failureTs: 3,
        lastSuccessfulTs: 4
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
    // 后端/SDK 返回的是**响应壳** `{blacklist, total, next_batch}`（`admin-federation-types.d.ts:14-18`），
    // 条目字段是 `added_at`（不是 `added_ts`）。旧 mock 直接给了一个数组 + 错误的键名。
    admin.getFederationBlacklist.mockResolvedValueOnce({
      blacklist: [{ server_name: 'evil.hs', reason: 'spam', added_at: 100 }],
      total: 1,
      next_batch: null
    })

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

  it('getFederationDestinations 映射 failure_count/status/updated_ts', async () => {
    admin.getFederationDestinations.mockResolvedValueOnce([
      {
        destination: 'remote.hs',
        retry_last_ts: null,
        retry_interval: null,
        failure_ts: 3,
        last_successful_ts: 4,
        failure_count: 7,
        status: 'rejected',
        updated_ts: 5
      }
    ])

    await expect(service.getFederationDestinations()).resolves.toEqual([
      {
        destination: 'remote.hs',
        retryLastTs: undefined,
        retryInterval: undefined,
        failureTs: 3,
        lastSuccessfulTs: 4,
        failureCount: 7,
        status: 'rejected',
        updatedTs: 5
      }
    ])
  })

  it('getFederationCache 映射 cache 壳并在失败时降级为空页', async () => {
    admin.getFederationCache.mockResolvedValueOnce({
      cache: [{ key: 'k1', value: { a: 1 }, expiry_ts: 100 }],
      total: 1
    })
    await expect(service.getFederationCache()).resolves.toEqual({
      entries: [{ key: 'k1', value: { a: 1 }, expiryTs: 100 }],
      total: 1
    })

    admin.getFederationCache.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getFederationCache()).resolves.toEqual({ entries: [], total: 0 })
  })

  it('clearFederationCache 与 deleteFederationCacheEntry 失败时向上抛出', async () => {
    admin.clearFederationCache.mockResolvedValueOnce(undefined)
    await expect(service.clearFederationCache()).resolves.toBeUndefined()
    expect(admin.clearFederationCache).toHaveBeenCalled()

    admin.clearFederationCache.mockRejectedValueOnce(new Error('clear-fail'))
    await expect(service.clearFederationCache()).rejects.toThrow('clear-fail')

    admin.deleteFederationCacheEntry.mockResolvedValueOnce(undefined)
    await expect(service.deleteFederationCacheEntry('k1')).resolves.toBeUndefined()
    expect(admin.deleteFederationCacheEntry).toHaveBeenCalledWith('k1')

    admin.deleteFederationCacheEntry.mockRejectedValueOnce(new Error('delete-fail'))
    await expect(service.deleteFederationCacheEntry('k1')).rejects.toThrow('delete-fail')
  })

  it('getPendingFederationServers 映射分页壳并在失败时降级为空页', async () => {
    admin.getPendingFederationServers.mockResolvedValueOnce({
      servers: [
        {
          server_name: 'pending.hs',
          failure_count: 3,
          last_failed_connect_at: 10,
          last_successful_connect_at: null,
          status: 'pending',
          updated_ts: 11
        }
      ],
      total: 1,
      limit: 20,
      next_batch: 'cursor'
    })

    await expect(service.getPendingFederationServers(undefined, 20)).resolves.toEqual({
      servers: [
        {
          serverName: 'pending.hs',
          failureCount: 3,
          lastFailedConnectAt: 10,
          lastSuccessfulConnectAt: null,
          status: 'pending',
          updatedTs: 11
        }
      ],
      total: 1,
      limit: 20,
      nextBatch: 'cursor'
    })
    expect(admin.getPendingFederationServers).toHaveBeenCalledWith(undefined, 20)

    admin.getPendingFederationServers.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getPendingFederationServers()).resolves.toEqual({ servers: [], total: 0, limit: 0 })
  })

  it('confirmFederation 委托 SDK 且失败时向上抛出', async () => {
    admin.confirmFederation.mockResolvedValueOnce(undefined)
    await expect(service.confirmFederation('pending.hs', true)).resolves.toBeUndefined()
    expect(admin.confirmFederation).toHaveBeenCalledWith('pending.hs', true)

    admin.confirmFederation.mockRejectedValueOnce(new Error('confirm-fail'))
    await expect(service.confirmFederation('pending.hs', false)).rejects.toThrow('confirm-fail')
  })
})
