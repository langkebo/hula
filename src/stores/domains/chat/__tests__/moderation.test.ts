import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const moderationMock = vi.hoisted(() => ({
  getReports: vi.fn(),
  resolveReport: vi.fn(),
  getUserReputation: vi.fn(),
  setUserReputation: vi.fn(),
  getContentFilters: vi.fn(),
  addContentFilter: vi.fn(),
  removeContentFilter: vi.fn()
}))

vi.mock('@/services/matrix', () => ({
  matrixModerationService: moderationMock
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

import { useModerationStore } from '../moderation'

const makeReport = (id: string, status: 'open' | 'resolved' | 'dismissed' = 'open'): any => ({
  id,
  status,
  reason: 'r',
  reporter: '@u:x'
})

describe('useModerationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(moderationMock).forEach((fn) => fn.mockReset())
  })

  it('initializes empty', () => {
    const store = useModerationStore()
    expect(store.reports).toEqual([])
    expect(store.contentFilters).toEqual([])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.openReportCount).toBe(0)
  })

  it('fetchReports populates reports and clears error', async () => {
    moderationMock.getReports.mockResolvedValue([
      makeReport('r1', 'open'),
      makeReport('r2', 'resolved'),
      makeReport('r3', 'dismissed')
    ])
    const store = useModerationStore()
    await store.fetchReports({ status: 'open' } as any)
    expect(store.reports).toHaveLength(3)
    expect(store.openReports).toHaveLength(1)
    expect(store.resolvedReports).toHaveLength(1)
    expect(store.dismissedReports).toHaveLength(1)
    expect(store.openReportCount).toBe(1)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.currentFilters).toEqual({ status: 'open' })
  })

  it('fetchReports captures error message on failure', async () => {
    moderationMock.getReports.mockRejectedValue(new Error('boom'))
    const store = useModerationStore()
    await store.fetchReports()
    expect(store.error).toBe('boom')
    expect(store.loading).toBe(false)
  })

  it('resolveReport flips matching report to resolved', async () => {
    moderationMock.getReports.mockResolvedValue([makeReport('r1', 'open')])
    moderationMock.resolveReport.mockResolvedValue(undefined)
    const store = useModerationStore()
    await store.fetchReports()
    const ok = await store.resolveReport('r1', 'warn', 'note')
    expect(ok).toBe(true)
    expect(store.reports[0].status).toBe('resolved')
    expect(moderationMock.resolveReport).toHaveBeenCalledWith('r1', { action: 'warn', notes: 'note' })
  })

  it('resolveReport returns false on failure', async () => {
    moderationMock.resolveReport.mockRejectedValue(new Error('nope'))
    const store = useModerationStore()
    const ok = await store.resolveReport('r1', 'ban')
    expect(ok).toBe(false)
    expect(store.error).toBe('nope')
  })

  it('fetchUserReputation caches reputation', async () => {
    moderationMock.getUserReputation.mockResolvedValue({ level: 'good', score: 80 })
    const store = useModerationStore()
    const rep = await store.fetchUserReputation('@a:x')
    expect(rep?.score).toBe(80)
    expect(store.userReputations.get('@a:x')?.score).toBe(80)
  })

  it('fetchUserReputation returns null on failure', async () => {
    moderationMock.getUserReputation.mockRejectedValue(new Error('x'))
    const store = useModerationStore()
    const rep = await store.fetchUserReputation('@a:x')
    expect(rep).toBeNull()
  })

  it('setUserReputation updates cached score when present', async () => {
    moderationMock.getUserReputation.mockResolvedValue({ level: 'good', score: 50 })
    moderationMock.setUserReputation.mockResolvedValue(undefined)
    const store = useModerationStore()
    await store.fetchUserReputation('@a:x')
    const ok = await store.setUserReputation('@a:x', 90)
    expect(ok).toBe(true)
    expect(store.userReputations.get('@a:x')?.score).toBe(90)
  })

  it('setUserReputation returns false on failure', async () => {
    moderationMock.setUserReputation.mockRejectedValue(new Error('fail'))
    const store = useModerationStore()
    const ok = await store.setUserReputation('@a:x', 1)
    expect(ok).toBe(false)
    expect(store.error).toBe('fail')
  })

  it('fetchContentFilters loads list', async () => {
    moderationMock.getContentFilters.mockResolvedValue([
      { id: 'f1', enabled: true } as any,
      { id: 'f2', enabled: false } as any
    ])
    const store = useModerationStore()
    await store.fetchContentFilters()
    expect(store.contentFilters).toHaveLength(2)
    expect(store.enabledFilters.map((f) => f.id)).toEqual(['f1'])
  })

  it('addContentFilter appends new filter', async () => {
    moderationMock.addContentFilter.mockResolvedValue({ id: 'new', enabled: true } as any)
    const store = useModerationStore()
    const created = await store.addContentFilter({ type: 'keyword', pattern: 'p', action: 'flag' })
    expect(created?.id).toBe('new')
    expect(store.contentFilters.map((f) => f.id)).toEqual(['new'])
  })

  it('addContentFilter returns null on failure', async () => {
    moderationMock.addContentFilter.mockRejectedValue(new Error('bad'))
    const store = useModerationStore()
    const created = await store.addContentFilter({ type: 'keyword', pattern: 'p', action: 'flag' })
    expect(created).toBeNull()
    expect(store.error).toBe('bad')
  })

  it('removeContentFilter removes by id', async () => {
    moderationMock.getContentFilters.mockResolvedValue([{ id: 'a', enabled: true } as any])
    moderationMock.removeContentFilter.mockResolvedValue(undefined)
    const store = useModerationStore()
    await store.fetchContentFilters()
    const ok = await store.removeContentFilter('a')
    expect(ok).toBe(true)
    expect(store.contentFilters).toEqual([])
  })

  it('removeContentFilter returns false on failure', async () => {
    moderationMock.removeContentFilter.mockRejectedValue(new Error('x'))
    const store = useModerationStore()
    const ok = await store.removeContentFilter('a')
    expect(ok).toBe(false)
    expect(store.error).toBe('x')
  })

  it('clearError clears error state', async () => {
    moderationMock.getReports.mockRejectedValue(new Error('e'))
    const store = useModerationStore()
    await store.fetchReports()
    expect(store.error).toBe('e')
    store.clearError()
    expect(store.error).toBeNull()
  })

  it('$reset clears everything', async () => {
    moderationMock.getReports.mockResolvedValue([makeReport('r1')])
    moderationMock.getContentFilters.mockResolvedValue([{ id: 'a', enabled: true } as any])
    moderationMock.getUserReputation.mockResolvedValue({ level: 'ok', score: 1 })
    const store = useModerationStore()
    await store.fetchReports({ status: 'open' } as any)
    await store.fetchContentFilters()
    await store.fetchUserReputation('@a:x')
    store.$reset()
    expect(store.reports).toEqual([])
    expect(store.contentFilters).toEqual([])
    expect(store.userReputations.size).toBe(0)
    expect(store.currentFilters).toEqual({})
  })
})
