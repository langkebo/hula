import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MATRIX_PATHS } from '@/services/matrix/paths'

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
    authedRequestMock.mockReset()
  })

  it('getRtcTransports 调用 GET VOICE.RTC_TRANSPORTS（FT-096: 使用 L3 常量）', async () => {
    authedRequestMock.mockResolvedValue({
      transports: [{ transport: 'webrtc', version: '1.0' }]
    })

    const result = await matrixVoiceService.getRtcTransports()

    expect(authedRequestMock).toHaveBeenCalledWith('GET', MATRIX_PATHS.VOICE.RTC_TRANSPORTS)
    expect(MATRIX_PATHS.VOICE.RTC_TRANSPORTS).toBe('/_matrix/client/unstable/org.matrix.msc4143/rtc/transports')
    expect(result).toEqual({ transports: [{ transport: 'webrtc', version: '1.0' }] })
  })

  it('getRtcTransports 失败时返回空对象', async () => {
    authedRequestMock.mockRejectedValue(new Error('boom'))

    const result = await matrixVoiceService.getRtcTransports()

    expect(result).toEqual({})
  })
})
