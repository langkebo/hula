import { beforeEach, describe, expect, it, vi } from 'vitest'

const getRtcTransportsMock = vi.fn()

vi.mock('@/services/matrix/MatrixHttpClient', () => ({
  matrixHttpClient: { buildRoomPath: (roomId: string, type: string) => `/rooms/${roomId}/${type}` },
  authedRequestWithPath: (...args: unknown[]) => vi.fn()(...args)
}))

vi.mock('@/services/matrix/paths', async () => {
  const actual = await vi.importActual<typeof import('@/services/matrix/paths')>('@/services/matrix/paths')
  return { ...actual }
})

vi.mock('@/services/matrix/BaseMatrixService', () => ({
  BaseMatrixService: class {
    protected getClient() {
      return { getVoiceManager: () => ({ getRtcTransports: getRtcTransportsMock }) }
    }
  }
}))

vi.mock('@/services/matrix/EndpointCapabilityService', () => ({
  default: { check: vi.fn(() => Promise.resolve(true)), clear: vi.fn() }
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null),
    getHomeserverUrl: vi.fn(() => null),
    getAccessToken: vi.fn(() => null),
    waitForClientReady: vi.fn()
  },
  matrixClientService: {
    getClient: vi.fn(() => null),
    getHomeserverUrl: vi.fn(() => null),
    getAccessToken: vi.fn(() => null),
    waitForClientReady: vi.fn()
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
}))

import { matrixVoiceService } from '../MatrixVoiceService'

describe('MatrixVoiceService — P2-7 RTC 传输协议信息扩展', () => {
  beforeEach(() => {
    getRtcTransportsMock.mockReset()
  })

  it('getRtcTransports 委托 SDK VoiceManager.getRtcTransports（FT-096）', async () => {
    getRtcTransportsMock.mockResolvedValue({
      transports: [{ transport: 'webrtc', version: '1.0' }]
    })

    const result = await matrixVoiceService.getRtcTransports()

    expect(getRtcTransportsMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ transports: [{ transport: 'webrtc', version: '1.0' }] })
  })

  it('getRtcTransports 失败时返回空对象', async () => {
    getRtcTransportsMock.mockRejectedValue(new Error('boom'))

    const result = await matrixVoiceService.getRtcTransports()

    expect(result).toEqual({})
  })
})
