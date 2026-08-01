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

describe('AccountDataService — P2-8 事件签名与验证扩展', () => {
  beforeEach(() => {
    authedRequestMock.mockReset()
  })

  it('signEvent 调用 PUT /rooms/{roomId}/sign/{eventId}', async () => {
    authedRequestMock.mockResolvedValue({ signature: 'sig123', signed_by: '@user:hs' })

    const result = await matrixRoomAccountDataService.signEvent('!room:hs', '$e1:hs')

    expect(authedRequestMock).toHaveBeenCalledWith('PUT', '/rooms/!room%3Ahs/sign/%24e1%3Ahs')
    expect(result).toEqual({ signature: 'sig123', signed_by: '@user:hs' })
  })

  it('signEvent 失败时抛出错误', async () => {
    authedRequestMock.mockRejectedValue(new Error('boom'))

    await expect(matrixRoomAccountDataService.signEvent('!room:hs', '$e1:hs')).rejects.toThrow('boom')
  })

  it('verifyEvent 调用 POST /rooms/{roomId}/verify/{eventId}', async () => {
    authedRequestMock.mockResolvedValue({ valid: true, verifier: '@user:hs' })

    const result = await matrixRoomAccountDataService.verifyEvent('!room:hs', '$e1:hs')

    expect(authedRequestMock).toHaveBeenCalledWith('POST', '/rooms/!room%3Ahs/verify/%24e1%3Ahs')
    expect(result).toEqual({ valid: true, verifier: '@user:hs' })
  })

  it('verifyEvent 失败时抛出错误', async () => {
    authedRequestMock.mockRejectedValue(new Error('boom'))

    await expect(matrixRoomAccountDataService.verifyEvent('!room:hs', '$e1:hs')).rejects.toThrow('boom')
  })
})
