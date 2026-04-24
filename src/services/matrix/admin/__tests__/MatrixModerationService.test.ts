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

const { default: matrixClientService } = await import('../../MatrixClientService')
const { matrixModerationService } = await import('../MatrixModerationService')

describe('MatrixModerationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matrixModerationService.stop()
    vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)
  })

  it('refreshes moderation manager when matrix client changes', async () => {
    const oldManager = {
      start: vi.fn(),
      stop: vi.fn(),
      on: vi.fn(),
      removeAllListeners: vi.fn(),
      getReports: vi.fn(async () => [{ id: 'old' }]),
      resolveReport: vi.fn(),
      getUserReputation: vi.fn(),
      setUserReputation: vi.fn(),
      getContentFilters: vi.fn(),
      addContentFilter: vi.fn(),
      removeContentFilter: vi.fn()
    }
    const newManager = {
      start: vi.fn(),
      stop: vi.fn(),
      on: vi.fn(),
      removeAllListeners: vi.fn(),
      getReports: vi.fn(async () => [{ id: 'new' }]),
      resolveReport: vi.fn(),
      getUserReputation: vi.fn(),
      setUserReputation: vi.fn(),
      getContentFilters: vi.fn(),
      addContentFilter: vi.fn(),
      removeContentFilter: vi.fn()
    }

    vi.mocked(matrixClientService.getClient)
      .mockReturnValueOnce({ moderationManager: oldManager } as any)
      .mockReturnValue({ moderationManager: newManager } as any)

    await matrixModerationService.initialize()
    const reports = await matrixModerationService.getReports()

    expect(oldManager.start).toHaveBeenCalledTimes(1)
    expect(oldManager.stop).toHaveBeenCalledTimes(1)
    expect(oldManager.removeAllListeners).toHaveBeenCalled()
    expect(newManager.start).toHaveBeenCalledTimes(1)
    expect(reports).toEqual([{ id: 'new' }])
  })
})
