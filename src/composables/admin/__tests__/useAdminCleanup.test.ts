import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/matrix/admin', () => ({
  adminCleanupService: {
    cleanupAll: vi.fn(),
    cleanupRooms: vi.fn(),
    cleanupTokens: vi.fn()
  }
}))

import { adminCleanupService } from '@/services/matrix/admin'
import { useAdminCleanup } from '../useAdminCleanup'

describe('useAdminCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('全部清理记录 kind 为 all 并透传 min_age_ms', async () => {
    const result = {
      rooms: { deleted_empty_rooms: 1, deleted_events_in_empty_rooms: 2 },
      tokens: {
        access_tokens_deleted: 3,
        refresh_tokens_deleted: 4,
        registration_tokens_deleted: 5,
        email_tokens_deleted: 6
      }
    }
    vi.mocked(adminCleanupService.cleanupAll).mockResolvedValue(result)

    const state = useAdminCleanup()
    const ok = await state.runCleanupAll(1000)

    expect(ok).toBe(true)
    expect(adminCleanupService.cleanupAll).toHaveBeenCalledWith({ min_age_ms: 1000 })
    expect(state.outcome.value).toEqual({ kind: 'all', result })
  })

  it('房间清理记录 kind 为 rooms 且未传年龄时不带请求体', async () => {
    const result = { deleted_empty_rooms: 1, deleted_events_in_empty_rooms: 2 }
    vi.mocked(adminCleanupService.cleanupRooms).mockResolvedValue(result)

    const state = useAdminCleanup()
    const ok = await state.runCleanupRooms()

    expect(ok).toBe(true)
    expect(adminCleanupService.cleanupRooms).toHaveBeenCalledWith(undefined)
    expect(state.outcome.value).toEqual({ kind: 'rooms', result })
  })

  it('令牌清理记录 kind 为 tokens', async () => {
    const result = { access_tokens_deleted: 3, refresh_tokens_deleted: 4 }
    vi.mocked(adminCleanupService.cleanupTokens).mockResolvedValue(result)

    const state = useAdminCleanup()
    const ok = await state.runCleanupTokens()

    expect(ok).toBe(true)
    expect(state.outcome.value).toEqual({ kind: 'tokens', result })
  })

  it('失败时返回 false 并记录错误', async () => {
    vi.mocked(adminCleanupService.cleanupTokens).mockRejectedValue(new Error('HTTP 500'))

    const state = useAdminCleanup()
    const ok = await state.runCleanupTokens()

    expect(ok).toBe(false)
    expect(state.error.value).toBe('HTTP 500')
    expect(state.outcome.value).toBeNull()
  })
})
