import { beforeEach, describe, expect, it, vi } from 'vitest'

const getRoomMessageQueueMock = vi.fn()

vi.mock('@/services/matrix/BaseMatrixService', () => ({
  BaseMatrixService: class {
    protected getClient() {
      return {
        getRoomSummaryManager: () => ({
          getRoomMessageQueue: getRoomMessageQueueMock
        })
      }
    }
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
}))

import { matrixRoomAccountDataService } from '../AccountDataService'

describe('AccountDataService — P2-6 消息队列状态扩展', () => {
  beforeEach(() => {
    getRoomMessageQueueMock.mockReset()
  })

  it('getMessageQueue 委托 RoomSummaryManager.getRoomMessageQueue', async () => {
    getRoomMessageQueueMock.mockResolvedValue({ queue: { pending: [], pending_count: 0 } })

    const result = await matrixRoomAccountDataService.getMessageQueue('!room:hs')

    expect(getRoomMessageQueueMock).toHaveBeenCalledWith('!room:hs')
    expect(result).toEqual({ queue: { pending: [], pending_count: 0 } })
  })

  it('getMessageQueue 失败时返回空对象', async () => {
    getRoomMessageQueueMock.mockRejectedValue(new Error('boom'))

    const result = await matrixRoomAccountDataService.getMessageQueue('!room:hs')

    expect(result).toEqual({})
  })
})
