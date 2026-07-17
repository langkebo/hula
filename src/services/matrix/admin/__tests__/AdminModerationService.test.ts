import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminModerationService } from '../AdminModerationService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const makeManager = () => {
  const handlers = new Map<string, (...args: unknown[]) => void>()
  return {
    handlers,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      handlers.set(event, callback)
    }),
    removeAllListeners: vi.fn(),
    getReports: vi.fn(),
    resolveReport: vi.fn(),
    getUserReputation: vi.fn(),
    setUserReputation: vi.fn(),
    getContentFilters: vi.fn(),
    addContentFilter: vi.fn(),
    removeContentFilter: vi.fn()
  }
}

describe('AdminModerationService', () => {
  let manager: ReturnType<typeof makeManager>
  let service: AdminModerationService

  beforeEach(() => {
    manager = makeManager()
    const client = { moderationManager: manager } as unknown as MatrixClient
    service = new AdminModerationService(() => client)
  })

  it('moderationManager 未初始化时抛错', async () => {
    const bareService = new AdminModerationService(() => ({}) as unknown as MatrixClient)
    await expect(bareService.getModerationReports()).rejects.toThrow('moderationManager 未初始化')
  })

  it('首次调用启动 manager，后续复用（start 只调一次）', async () => {
    manager.getReports.mockResolvedValue([])

    await service.getModerationReports()
    await service.getModerationReports()

    expect(manager.start).toHaveBeenCalledTimes(1)
  })

  it('getModerationReports 透传过滤器且失败时向上抛出', async () => {
    manager.getReports.mockResolvedValueOnce([{ id: 'rep-1' }])
    await expect(service.getModerationReports({ status: 'open' } as never)).resolves.toEqual([{ id: 'rep-1' }])
    expect(manager.getReports).toHaveBeenCalledWith({ status: 'open' })

    manager.getReports.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getModerationReports()).rejects.toThrow('boom')
  })

  it('resolveModerationReport / setUserReputation 透传参数', async () => {
    manager.resolveReport.mockResolvedValueOnce(undefined)
    await service.resolveModerationReport('rep-1', { action: 'dismiss' } as never)
    expect(manager.resolveReport).toHaveBeenCalledWith('rep-1', { action: 'dismiss' })

    manager.setUserReputation.mockResolvedValueOnce(undefined)
    await service.setUserReputation('@u:hs', -10)
    expect(manager.setUserReputation).toHaveBeenCalledWith('@u:hs', -10)
  })

  it('manager 事件转发给 onModerationEvent 订阅者', async () => {
    manager.getReports.mockResolvedValue([])
    await service.getModerationReports()

    const reportListener = vi.fn()
    service.onModerationEvent('reportCreated', reportListener)

    const report = { id: 'rep-9' }
    manager.handlers.get('Moderation.report.created')?.(report)

    expect(reportListener).toHaveBeenCalledWith(report)
  })

  it('offModerationEvent 取消订阅后不再收到事件', async () => {
    manager.getReports.mockResolvedValue([])
    await service.getModerationReports()

    const listener = vi.fn()
    service.onModerationEvent('reportResolved', listener)
    service.offModerationEvent('reportResolved', listener)

    manager.handlers.get('Moderation.report.resolved')?.({ id: 'rep-2' })

    expect(listener).not.toHaveBeenCalled()
  })

  it('stopModeration 停止 manager 并清理监听，之后可重新启动', async () => {
    manager.getReports.mockResolvedValue([])
    await service.getModerationReports()

    service.stopModeration()
    expect(manager.stop).toHaveBeenCalledTimes(1)

    await service.getModerationReports()
    expect(manager.start).toHaveBeenCalledTimes(2)
  })

  it('addContentFilter/removeContentFilter 透传且失败时向上抛出', async () => {
    manager.addContentFilter.mockResolvedValueOnce({ id: 'f1' })
    await expect(service.addContentFilter({ pattern: 'bad' } as never)).resolves.toEqual({ id: 'f1' })

    manager.removeContentFilter.mockRejectedValueOnce(new Error('remove-fail'))
    await expect(service.removeContentFilter('f1')).rejects.toThrow('remove-fail')
  })
})
