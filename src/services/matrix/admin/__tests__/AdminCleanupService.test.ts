import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminCleanupService, type CleanupAllRequest, type CleanupRoomsRequest } from '../AdminCleanupService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const cleanupAll = vi.fn()
const cleanupRooms = vi.fn()
const cleanupTokens = vi.fn()

const makeDeps = () => {
  const client = {
    getAdminManager: () => ({
      cleanup: { all: cleanupAll, rooms: cleanupRooms, tokens: cleanupTokens }
    })
  }
  return {
    getClient: () => client as never,
    waitForClientReady: async () => client as never
  }
}

const allResponse = {
  rooms: { deleted_empty_rooms: 2, deleted_events_in_empty_rooms: 5 },
  tokens: {
    access_tokens_deleted: 3,
    refresh_tokens_deleted: 4,
    registration_tokens_deleted: 1,
    email_tokens_deleted: 6
  }
}

const roomsResponse = { deleted_empty_rooms: 2, deleted_events_in_empty_rooms: 5 }
const tokensResponse = { access_tokens_deleted: 3, refresh_tokens_deleted: 4 }

describe('AdminCleanupService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cleanupAll 透传 min_age_ms 并返回清理结果', async () => {
    const payload: CleanupAllRequest = { min_age_ms: 86400000 }
    cleanupAll.mockResolvedValueOnce(allResponse)

    const result = await new AdminCleanupService(makeDeps()).cleanupAll(payload)

    expect(cleanupAll).toHaveBeenCalledWith(payload)
    expect(result).toEqual(allResponse)
  })

  it('cleanupAll 允许不传参数', async () => {
    cleanupAll.mockResolvedValueOnce(allResponse)

    await new AdminCleanupService(makeDeps()).cleanupAll()

    expect(cleanupAll).toHaveBeenCalledWith(undefined)
  })

  it('cleanupRooms 透传 min_age_ms 并返回清理结果', async () => {
    const payload: CleanupRoomsRequest = { min_age_ms: 3600000 }
    cleanupRooms.mockResolvedValueOnce(roomsResponse)

    const result = await new AdminCleanupService(makeDeps()).cleanupRooms(payload)

    expect(cleanupRooms).toHaveBeenCalledWith(payload)
    expect(result).toEqual(roomsResponse)
  })

  it('cleanupTokens 返回令牌清理结果', async () => {
    cleanupTokens.mockResolvedValueOnce(tokensResponse)

    const result = await new AdminCleanupService(makeDeps()).cleanupTokens()

    expect(cleanupTokens).toHaveBeenCalledWith()
    expect(result).toEqual(tokensResponse)
  })

  it('后端失败时记录日志并重新抛出', async () => {
    cleanupRooms.mockRejectedValueOnce(new Error('HTTP 500'))

    await expect(new AdminCleanupService(makeDeps()).cleanupRooms()).rejects.toThrow('HTTP 500')
  })
})
