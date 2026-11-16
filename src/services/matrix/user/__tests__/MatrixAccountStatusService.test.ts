import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatrixAccountStatusService } from '../MatrixAccountStatusService'

const loggerSpies = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => loggerSpies
}))

interface FakeManager {
  isSupported: ReturnType<typeof vi.fn>
  getAccountStatuses: ReturnType<typeof vi.fn>
}

const createService = (manager: FakeManager) =>
  new MatrixAccountStatusService({
    getClient: () => ({ getAccountStatusManager: () => manager }) as never,
    waitForClientReady: async () => ({}) as never
  })

describe('MatrixAccountStatusService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('服务端不支持账号状态时返回空对象且不发请求', async () => {
    const manager: FakeManager = {
      isSupported: vi.fn().mockResolvedValue(false),
      getAccountStatuses: vi.fn()
    }
    const service = createService(manager)

    await expect(service.getAccountStatuses(['@alice:example.org'])).resolves.toEqual({})
    expect(manager.getAccountStatuses).not.toHaveBeenCalled()
  })

  it('能力探测抛错时按不支持处理，fail closed', async () => {
    const manager: FakeManager = {
      isSupported: vi.fn().mockRejectedValue(new Error('probe failed')),
      getAccountStatuses: vi.fn()
    }
    const service = createService(manager)

    await expect(service.getAccountStatuses(['@alice:example.org'])).resolves.toEqual({})
    expect(manager.getAccountStatuses).not.toHaveBeenCalled()
    expect(loggerSpies.warn).toHaveBeenCalled()
  })

  it('支持时返回 account_statuses 并对 failures 记 warn', async () => {
    const manager: FakeManager = {
      isSupported: vi.fn().mockResolvedValue(true),
      getAccountStatuses: vi.fn().mockResolvedValue({
        account_statuses: {
          '@alice:example.org': { locked: true },
          '@bob:example.org': { suspended: false }
        },
        failures: {
          '@carol:example.org': { errcode: 'M_NOT_FOUND' }
        }
      })
    }
    const service = createService(manager)

    const result = await service.getAccountStatuses(['@alice:example.org', '@bob:example.org', '@carol:example.org'])

    expect(manager.getAccountStatuses).toHaveBeenCalledWith([
      '@alice:example.org',
      '@bob:example.org',
      '@carol:example.org'
    ])
    expect(result).toEqual({
      '@alice:example.org': { locked: true },
      '@bob:example.org': { suspended: false }
    })
    expect(loggerSpies.warn).toHaveBeenCalledWith(expect.stringContaining('@carol:example.org'))
  })

  it('请求失败时返回空对象并记录 error', async () => {
    const manager: FakeManager = {
      isSupported: vi.fn().mockResolvedValue(true),
      getAccountStatuses: vi.fn().mockRejectedValue(new Error('network down'))
    }
    const service = createService(manager)

    await expect(service.getAccountStatuses(['@alice:example.org'])).resolves.toEqual({})
    expect(loggerSpies.error).toHaveBeenCalled()
  })

  it('用户列表为空时直接返回，不创建 manager', async () => {
    const getAccountStatusManager = vi.fn()
    const service = new MatrixAccountStatusService({
      getClient: () => ({ getAccountStatusManager }) as never,
      waitForClientReady: async () => ({}) as never
    })

    await expect(service.getAccountStatuses([])).resolves.toEqual({})
    expect(getAccountStatusManager).not.toHaveBeenCalled()
  })
})
