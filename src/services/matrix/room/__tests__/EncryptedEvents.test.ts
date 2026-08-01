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

describe('AccountDataService — P2-9 加密事件列表扩展', () => {
  beforeEach(() => {
    authedRequestMock.mockReset()
  })

  it('getEncryptedEvents 调用 GET /rooms/{roomId}/encrypted_events', async () => {
    authedRequestMock.mockResolvedValue({
      events: [{ event_id: '$e1:hs', algorithm: 'm.megolm.v1.aes-sha2', session_id: 'sess1' }]
    })

    const result = await matrixRoomAccountDataService.getEncryptedEvents('!room:hs')

    expect(authedRequestMock).toHaveBeenCalledWith('GET', '/rooms/!room%3Ahs/encrypted_events')
    expect(result).toEqual({
      events: [{ event_id: '$e1:hs', algorithm: 'm.megolm.v1.aes-sha2', session_id: 'sess1' }]
    })
  })

  it('getEncryptedEvents 失败时返回空对象', async () => {
    authedRequestMock.mockRejectedValue(new Error('boom'))

    const result = await matrixRoomAccountDataService.getEncryptedEvents('!room:hs')

    expect(result).toEqual({})
  })
})
