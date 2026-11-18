import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 能力位「路由面探测」的判据（CAP-02 探测面）。
 *
 * 探测的价值全在**归类是否保守**：把 404 当可用会做出假入口，把 403 当缺失会把
 * 「没权限」误报成「后端没实现」。下面逐条锁定归类，并覆盖缓存与上下文缺失两条路径。
 */
const { safeGetMock, normalizeMock, clientMock } = vi.hoisted(() => ({
  safeGetMock: vi.fn(),
  normalizeMock: vi.fn(),
  clientMock: vi.fn()
}))

vi.mock('../MatrixRequestHelper', () => ({
  safeGet: safeGetMock,
  normalizeMatrixError: normalizeMock
}))

vi.mock('../MatrixClientService', () => ({
  matrixClientService: { getClient: clientMock }
}))

import {
  canProbeCapability,
  classifyProbeFailure,
  clearProbeCache,
  probeCapabilities,
  probeCapability
} from '../capabilityProbe'

describe('classifyProbeFailure', () => {
  it('404 与 M_UNRECOGNIZED 判为路由缺失', () => {
    expect(classifyProbeFailure(404, 'M_NOT_FOUND')).toBe('route-missing')
    expect(classifyProbeFailure(400, 'M_UNRECOGNIZED')).toBe('route-missing')
  })

  it('400/401/403/405 判为路由存在（参数或权限问题，路径已注册）', () => {
    for (const status of [400, 401, 403, 405]) {
      expect(classifyProbeFailure(status, 'M_UNKNOWN')).toBe('route-present')
    }
  })

  it('429/5xx/网络错误判为无法判定，不冤枉服务端', () => {
    expect(classifyProbeFailure(429, 'M_LIMIT_EXCEEDED')).toBe('inconclusive')
    expect(classifyProbeFailure(502, 'M_UNKNOWN')).toBe('inconclusive')
    expect(classifyProbeFailure(0, 'M_UNKNOWN')).toBe('inconclusive')
  })
})

describe('probeCapability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearProbeCache()
    clientMock.mockReturnValue({})
  })

  it('请求成功即判 route-present', async () => {
    safeGetMock.mockResolvedValue({})

    const result = await probeCapability('rtc-transports')

    expect(result.outcome).toBe('route-present')
    expect(result.reason).toBe('ok')
    expect(safeGetMock).toHaveBeenCalledWith('/_matrix/client/unstable/org.matrix.msc4143/rtc/transports', undefined)
  })

  it('404 判 route-missing', async () => {
    safeGetMock.mockRejectedValue(new Error('not found'))
    normalizeMock.mockReturnValue({ httpStatus: 404, errcode: 'M_UNRECOGNIZED' })

    const result = await probeCapability('scheduled-send')

    expect(result.outcome).toBe('route-missing')
    expect(result.httpStatus).toBe(404)
  })

  it('403 判 route-present（仅权限不足，不谎报缺失）', async () => {
    safeGetMock.mockRejectedValue(new Error('forbidden'))
    normalizeMock.mockReturnValue({ httpStatus: 403, errcode: 'M_FORBIDDEN' })

    const result = await probeCapability('dehydrated-device')

    expect(result.outcome).toBe('route-present')
    expect(result.reason).toBe('rejected-but-present')
  })

  it('网络错误判 inconclusive 且不写缓存（下次仍会重新探测）', async () => {
    safeGetMock.mockRejectedValue(new Error('network'))
    normalizeMock.mockReturnValue({ httpStatus: 0, errcode: 'M_UNKNOWN' })

    const first = await probeCapability('rtc-transports')
    expect(first.outcome).toBe('inconclusive')

    safeGetMock.mockResolvedValue({})
    const second = await probeCapability('rtc-transports')
    expect(second.outcome).toBe('route-present')
    expect(safeGetMock).toHaveBeenCalledTimes(2)
  })

  it('缺上下文时不发请求，返回 missing-context', async () => {
    const result = await probeCapability('sticky-events', {})
    expect(result.reason).toBe('missing-context:roomId')
    expect(safeGetMock).not.toHaveBeenCalled()

    const withRoom = await probeCapability('sticky-events', { roomId: '!r:hs' })
    expect(withRoom.route).toContain('/rooms/!r:hs/sticky_events')
  })

  it('不可探测的能力位返回 no-probe', async () => {
    expect(canProbeCapability('e2ee')).toBe(false)
    const result = await probeCapability('e2ee')
    expect(result.reason).toBe('no-probe')
    expect(safeGetMock).not.toHaveBeenCalled()
  })

  it('client 未就绪返回 client-not-ready，不抛错', async () => {
    clientMock.mockReturnValue(null)
    const result = await probeCapability('rtc-transports')
    expect(result.reason).toBe('client-not-ready')
    expect(safeGetMock).not.toHaveBeenCalled()
  })

  it('同上下文二次调用命中缓存；force 可绕过', async () => {
    safeGetMock.mockResolvedValue({})

    await probeCapability('rtc-transports')
    await probeCapability('rtc-transports')
    expect(safeGetMock).toHaveBeenCalledTimes(1)

    await probeCapability('rtc-transports', {}, { force: true })
    expect(safeGetMock).toHaveBeenCalledTimes(2)
  })

  it('批量探测只跑有规格的能力位', async () => {
    safeGetMock.mockResolvedValue({})
    const results = await probeCapabilities(['rtc-transports', 'e2ee', 'mutual-rooms'], { userId: '@me:hs' })

    expect(Object.keys(results).sort()).toEqual(['mutual-rooms', 'rtc-transports'])
    expect(safeGetMock).toHaveBeenCalledTimes(2)
  })
})
