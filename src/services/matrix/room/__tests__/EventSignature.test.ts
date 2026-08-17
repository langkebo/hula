import { beforeEach, describe, expect, it, vi } from 'vitest'

const signRoomEventMock = vi.fn()
const verifyRoomEventMock = vi.fn()

vi.mock('@/services/matrix/BaseMatrixService', () => ({
  BaseMatrixService: class {
    protected getClient() {
      return {
        getRoomSummaryManager: () => ({
          signRoomEvent: signRoomEventMock,
          verifyRoomEvent: verifyRoomEventMock
        })
      }
    }
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
}))

import { matrixRoomAccountDataService } from '../AccountDataService'

describe('AccountDataService — P2-8 事件签名与验证扩展', () => {
  beforeEach(() => {
    signRoomEventMock.mockReset()
    verifyRoomEventMock.mockReset()
  })

  it('signEvent 委托 RoomSummaryManager.signRoomEvent', async () => {
    signRoomEventMock.mockResolvedValue({ signed: true, event_id: '$e1:hs' })

    const result = await matrixRoomAccountDataService.signEvent('!room:hs', '$e1:hs')

    expect(signRoomEventMock).toHaveBeenCalledWith('!room:hs', '$e1:hs')
    expect(result).toEqual({ signed: true, event_id: '$e1:hs' })
  })

  it('signEvent 失败时抛出错误', async () => {
    signRoomEventMock.mockRejectedValue(new Error('boom'))

    await expect(matrixRoomAccountDataService.signEvent('!room:hs', '$e1:hs')).rejects.toThrow('boom')
  })

  it('verifyEvent 委托 RoomSummaryManager.verifyRoomEvent 并映射 valid', async () => {
    verifyRoomEventMock.mockResolvedValue({ valid: true })

    const result = await matrixRoomAccountDataService.verifyEvent('!room:hs', '$e1:hs')

    expect(verifyRoomEventMock).toHaveBeenCalledWith('!room:hs', '$e1:hs')
    expect(result).toEqual({ valid: true })
  })

  it('verifyEvent 失败时抛出错误', async () => {
    verifyRoomEventMock.mockRejectedValue(new Error('boom'))

    await expect(matrixRoomAccountDataService.verifyEvent('!room:hs', '$e1:hs')).rejects.toThrow('boom')
  })
})
