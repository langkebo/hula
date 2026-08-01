import type { AdminManager } from 'matrix-js-sdk/admin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminFederationService } from '../FederationService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
}))

function makeAdmin() {
  return {
    getFederationDestinations: vi.fn(),
    getFederationDestination: vi.fn(),
    resetFederationConnection: vi.fn(),
    getFederationBlacklist: vi.fn(),
    addToFederationBlacklist: vi.fn(),
    removeFromFederationBlacklist: vi.fn()
  }
}

describe('AdminFederationService', () => {
  let admin: ReturnType<typeof makeAdmin>
  let service: AdminFederationService

  beforeEach(() => {
    vi.clearAllMocks()
    admin = makeAdmin()
    service = new AdminFederationService(
      async () => admin as unknown as AdminManager,
      () => ({}) as never
    )
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

  it('getFederationBlacklist 通过 SDK 获取并映射 server_name → domain', async () => {
    admin.getFederationBlacklist.mockResolvedValueOnce([
      { server_name: 'evil.hs', reason: 'spam', added_ts: 100 },
      { not_a_server_name: true }
    ])

    await expect(service.getFederationBlacklist()).resolves.toEqual([
      { domain: 'evil.hs', reason: 'spam', addedBy: undefined, addedAt: 100 }
    ])
    expect(admin.getFederationBlacklist).toHaveBeenCalledTimes(1)
  })

  it('getFederationBlacklist 兼容 legacy domain 字段', async () => {
    admin.getFederationBlacklist.mockResolvedValueOnce([{ domain: 'legacy.hs', added_by: '@admin:hs' }])

    await expect(service.getFederationBlacklist()).resolves.toEqual([
      { domain: 'legacy.hs', reason: undefined, addedBy: '@admin:hs', addedAt: undefined }
    ])
  })

  it('getFederationBlacklist SDK 报错时降级为空数组', async () => {
    admin.getFederationBlacklist.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getFederationBlacklist()).resolves.toEqual([])
  })

  it('addToFederationBlacklist 通过 SDK 添加并返回 true', async () => {
    await expect(service.addToFederationBlacklist('evil.hs', 'spam')).resolves.toBe(true)
    expect(admin.addToFederationBlacklist).toHaveBeenCalledWith('evil.hs', 'spam')
  })

  it('addToFederationBlacklist SDK 报错时返回 false', async () => {
    admin.addToFederationBlacklist.mockRejectedValueOnce(new Error('add-fail'))
    await expect(service.addToFederationBlacklist('evil.hs')).resolves.toBe(false)
  })

  it('removeFromFederationBlacklist 通过 SDK 删除并返回 true', async () => {
    await expect(service.removeFromFederationBlacklist('evil.hs')).resolves.toBe(true)
    expect(admin.removeFromFederationBlacklist).toHaveBeenCalledWith('evil.hs')
  })

  it('removeFromFederationBlacklist SDK 报错时返回 false', async () => {
    admin.removeFromFederationBlacklist.mockRejectedValueOnce(new Error('del-fail'))
    await expect(service.removeFromFederationBlacklist('evil.hs')).resolves.toBe(false)
  })

  it('getFederationStatus 仍走直连 HTTP（SDK 未实现）', async () => {
    const authedRequestImpl = vi.fn().mockResolvedValue({ ok: true })
    const serviceWithHttp = new AdminFederationService(
      async () => admin as unknown as AdminManager,
      () =>
        ({
          http: { authedRequest: authedRequestImpl }
        }) as never
    )

    const result = await serviceWithHttp.getFederationStatus()
    expect(result).toEqual({ ok: true })
    expect(authedRequestImpl).toHaveBeenCalledWith('GET', '/federation/status', undefined, undefined, {
      prefix: '/_synapse/admin/v1'
    })
  })

  it('getFederationStatus HTTP 报错时降级为空对象', async () => {
    const authedRequestImpl = vi.fn().mockRejectedValue(new Error('http-fail'))
    const serviceWithHttp = new AdminFederationService(
      async () => admin as unknown as AdminManager,
      () =>
        ({
          http: { authedRequest: authedRequestImpl }
        }) as never
    )

    await expect(serviceWithHttp.getFederationStatus()).resolves.toEqual({})
  })
})
