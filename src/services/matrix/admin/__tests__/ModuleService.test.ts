import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PAGE_LIMIT } from '@/common/constants'
import type { AdminModuleInfo } from '@/services/matrix/sdk'
import { AdminModuleService } from '../ModuleService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const listModules = vi.fn()

const makeService = () => {
  const client = { getAdminManager: () => ({ listModules }) }
  return new AdminModuleService({
    getClient: () => client as never,
    waitForClientReady: async () => client as never
  })
}

const rawModule = (overrides: Partial<AdminModuleInfo> = {}): AdminModuleInfo =>
  ({
    id: 1,
    module_name: 'media-repo',
    module_type: 'background',
    version: '0.1.0',
    description: '媒体仓库',
    is_enabled: true,
    priority: 10,
    execution_count: 5,
    error_count: 0,
    last_executed_ts: 1700000000000,
    ...overrides
  }) as AdminModuleInfo

describe('AdminModuleService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the default page limit and maps raw module fields', async () => {
    listModules.mockResolvedValueOnce({ modules: [rawModule()], next_batch: 'cursor-1' })
    const result = await makeService().listModules()

    expect(listModules).toHaveBeenCalledWith({ limit: DEFAULT_PAGE_LIMIT })
    expect(result.nextBatch).toBe('cursor-1')
    expect(result.modules[0]).toEqual({
      id: 1,
      name: 'media-repo',
      type: 'background',
      version: '0.1.0',
      description: '媒体仓库',
      status: 'loaded',
      priority: 10,
      executionCount: 5,
      errorCount: 0,
      lastExecutedTs: 1700000000000
    })
  })

  it('forwards cursor and derives unloaded / failed status', async () => {
    listModules.mockResolvedValueOnce({
      modules: [rawModule({ id: 2, is_enabled: false }), rawModule({ id: 3, error_count: 2, last_error: 'boom' })],
      next_batch: null
    })
    const result = await makeService().listModules({ from: 'cursor-1', limit: 10 })

    expect(listModules).toHaveBeenCalledWith({ limit: 10, from: 'cursor-1' })
    expect(result.modules.map((item) => item.status)).toEqual(['unloaded', 'failed'])
    expect(result.modules[1].lastError).toBe('boom')
    expect(result.nextBatch).toBeNull()
  })

  it('tolerates a missing payload', async () => {
    listModules.mockResolvedValueOnce(undefined)
    const result = await makeService().listModules()
    expect(result).toEqual({ modules: [], nextBatch: null })
  })

  it('rethrows backend errors after logging', async () => {
    listModules.mockRejectedValueOnce(new Error('HTTP 500'))
    await expect(makeService().listModules()).rejects.toThrow('HTTP 500')
  })
})
