import { beforeEach, describe, expect, it, vi } from 'vitest'

const authedRequestMock = vi.fn()

vi.mock('@/services/matrix/MatrixHttpClient', () => ({
  matrixHttpClient: { buildRoomPath: (roomId: string, type: string) => `/rooms/${roomId}/${type}` },
  authedRequestWithPath: (...args: unknown[]) => authedRequestMock(...args)
}))

vi.mock('@/services/matrix/paths', async () => {
  const actual = await vi.importActual<typeof import('@/services/matrix/paths')>('@/services/matrix/paths')
  return { ...actual }
})

vi.mock('@/services/matrix/BaseMatrixService', () => ({
  BaseMatrixService: class {
    protected getClient() {
      return { http: { authedRequest: authedRequestMock } }
    }
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
}))

import { matrixRoomAccountDataService } from '../AccountDataService'

describe('AccountDataService — P2-6 消息队列状态扩展', () => {
  beforeEach(() => {
    authedRequestMock.mockReset()
  })

  it('getMessageQueue 调用 GET /rooms/{roomId}/message_queue', async () => {
    authedRequestMock.mockResolvedValue({ queue: [{ event_id: '$e1:hs', type: 'm.room.message' }] })

    const result = await matrixRoomAccountDataService.getMessageQueue('!room:hs')

    expect(authedRequestMock).toHaveBeenCalledWith('GET', '/rooms/!room%3Ahs/message_queue')
    expect(result).toEqual({ queue: [{ event_id: '$e1:hs', type: 'm.room.message' }] })
  })

  it('getMessageQueue 失败时返回空对象', async () => {
    authedRequestMock.mockRejectedValue(new Error('boom'))

    const result = await matrixRoomAccountDataService.getMessageQueue('!room:hs')

    expect(result).toEqual({})
  })
})
