import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatrixRelationshipService } from '../MatrixRelationshipService'

const loggerSpies = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => loggerSpies
}))

interface FakeRoomManager {
  getMutualRooms: ReturnType<typeof vi.fn>
}

const createService = (roomManager: FakeRoomManager) =>
  new MatrixRelationshipService({
    getClient: () => ({ getRoomManager: () => roomManager }) as never,
    waitForClientReady: async () => ({}) as never
  })

describe('MatrixRelationshipService.getMutualRooms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('委托 SDK 并透传 limit / batchToken，映射返回字段', async () => {
    const roomManager: FakeRoomManager = {
      getMutualRooms: vi.fn().mockResolvedValue({
        joined: ['!a:example.org', '!b:example.org'],
        next_batch_token: 'token-2'
      })
    }
    const service = createService(roomManager)

    const result = await service.getMutualRooms('@alice:example.org', 10, 'token-1')

    expect(roomManager.getMutualRooms).toHaveBeenCalledWith('@alice:example.org', {
      limit: 10,
      batchToken: 'token-1'
    })
    expect(result).toEqual({
      roomIds: ['!a:example.org', '!b:example.org'],
      nextBatchToken: 'token-2'
    })
  })

  it('没有 next_batch_token 时不返回该字段', async () => {
    const roomManager: FakeRoomManager = {
      getMutualRooms: vi.fn().mockResolvedValue({ joined: ['!a:example.org'] })
    }
    const service = createService(roomManager)

    const result = await service.getMutualRooms('@alice:example.org')

    expect(roomManager.getMutualRooms).toHaveBeenCalledWith('@alice:example.org', { limit: 20 })
    expect(result).toEqual({ roomIds: ['!a:example.org'] })
  })

  it('403 时抛出错误并记录 warn，供 UI 展示错误态', async () => {
    const forbidden = Object.assign(new Error('Forbidden'), { httpStatus: 403 })
    const roomManager: FakeRoomManager = {
      getMutualRooms: vi.fn().mockRejectedValue(forbidden)
    }
    const service = createService(roomManager)

    await expect(service.getMutualRooms('@alice:example.org')).rejects.toThrow('Forbidden')
    expect(loggerSpies.warn).toHaveBeenCalledWith(expect.stringContaining('403'))
  })

  it('其他错误抛出并记录 error', async () => {
    const roomManager: FakeRoomManager = {
      getMutualRooms: vi.fn().mockRejectedValue(new Error('network down'))
    }
    const service = createService(roomManager)

    await expect(service.getMutualRooms('@alice:example.org')).rejects.toThrow('network down')
    expect(loggerSpies.error).toHaveBeenCalled()
  })

  it('userId 为空时直接抛错且不调用 SDK', async () => {
    const roomManager: FakeRoomManager = { getMutualRooms: vi.fn() }
    const service = createService(roomManager)

    await expect(service.getMutualRooms('')).rejects.toThrow('userId is required')
    expect(roomManager.getMutualRooms).not.toHaveBeenCalled()
  })
})
