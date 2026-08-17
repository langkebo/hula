import { beforeEach, describe, expect, it, vi } from 'vitest'

const getEncryptedEventsMock = vi.fn()

vi.mock('@/services/matrix/BaseMatrixService', () => ({
  BaseMatrixService: class {
    protected getClient() {
      return {
        getRoomSummaryManager: () => ({
          getEncryptedEvents: getEncryptedEventsMock
        })
      }
    }
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
}))

import { matrixRoomAccountDataService } from '../AccountDataService'

describe('AccountDataService — P2-9 加密事件列表扩展', () => {
  beforeEach(() => {
    getEncryptedEventsMock.mockReset()
  })

  it('getEncryptedEvents 委托 RoomSummaryManager.getEncryptedEvents', async () => {
    getEncryptedEventsMock.mockResolvedValue({
      events: [{ event_id: '$e1:hs', algorithm: 'm.megolm.v1.aes-sha2', session_id: 'sess1' }]
    })

    const result = await matrixRoomAccountDataService.getEncryptedEvents('!room:hs')

    expect(getEncryptedEventsMock).toHaveBeenCalledWith('!room:hs')
    expect(result).toEqual({
      events: [{ event_id: '$e1:hs', algorithm: 'm.megolm.v1.aes-sha2', session_id: 'sess1' }]
    })
  })

  it('getEncryptedEvents 失败时返回空对象', async () => {
    getEncryptedEventsMock.mockRejectedValue(new Error('boom'))

    const result = await matrixRoomAccountDataService.getEncryptedEvents('!room:hs')

    expect(result).toEqual({})
  })
})
