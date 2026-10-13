/**
 * SynapseRust extensions (rooms) contract tests — MSW intercepts
 * at the HTTP boundary.
 *
 * Like the friends contract test, these methods use the service's own
 * `this.request()` → `getRuntimeAwareFetch()` → `globalThis.fetch`, so we
 * DO NOT mock getRuntimeAwareFetch. MSW intercepts the real fetch call.
 *
 * 前缀口径（2026-10-11，见 `scripts/bare-matrix-paths-baseline.json` 的 history）：
 * - room ephemeral 仍走 `/_matrix/client/v3`（该路由确实注册在 v3）；
 * - room summary（含 members/state/stats）**已不在本文件覆盖**：该能力已收敛到 SDK
 *   `RoomSummaryManager`，其路径正确性由 SDK 侧 path-contract / wire-format 门禁保证
 *   （历史 404 见 L-D05~L-D08：曾误用 client/v3，后端无该形态）。
 * - sticky events 亦**已不在本文件覆盖**（C2 收敛）：前端自建直连服务
 *   `SynapseStickyEventService` 已删除，能力统一走 SDK
 *   `client.getRoomManager().getStickyEvents/setStickyEvents`，其 MSC4354 unstable 前缀
 *   正确性由 SDK 侧门禁（`RoomManager` 的 msc4354 路径断言）保证。
 * Contract value: verify URL correctness (path, encoded roomId, query string),
 * HTTP method, request body shape, and response unwrapping
 * (`{data: ...}` wrapper vs bare payload).
 *
 * Covers: invite blocklist/allowlist, ephemeral.
 * Burn-after-read endpoints are covered by MatrixBurnAfterReadService tests.
 * Captcha endpoints are covered by SDK CaptchaManager (matrix-js-sdk/lib/captcha),
 * not exposed via package.json exports — frontend has no production callers.
 */
import type { MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { synapseRoomSummaryService } from '../extensions/SynapseRoomSummaryService'
import { matrixClientService } from '../MatrixClientService'

const HOMESERVER = 'https://hs.synapserust-rooms-contract.test'
const ACCESS_TOKEN = 'rooms-contract-at'
const seenUrls: { method: string; url: string; body?: string }[] = []

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('../MatrixCapabilityService', () => ({
  matrixCapabilityService: { canUseFriendList: vi.fn(() => true) }
}))

// check() must return true so getStickyEvents / getRoomSummary / getRoomEphemeral
// proceed past the capability gate to the actual fetch call.
vi.mock('../EndpointCapabilityService', () => ({
  default: { check: vi.fn(() => Promise.resolve(true)), clear: vi.fn() }
}))

const server = setupMswServer(
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/ephemeral`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ data: { chunk: [{ type: 'm.typing', content: {} }] } })
  })
)

describe('SynapseRust extensions rooms URL construction contract (real fetch + msw)', () => {
  beforeEach(() => {
    seenUrls.length = 0
    vi.spyOn(matrixClientService, 'getHomeserverUrl').mockReturnValue(HOMESERVER)
    vi.spyOn(matrixClientService, 'getAccessToken').mockReturnValue(ACCESS_TOKEN)
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null as unknown as MatrixClient)
    vi.spyOn(matrixClientService, 'waitForClientReady').mockResolvedValue(null as unknown as MatrixClient)
    const services = [synapseRoomSummaryService]
    for (const svc of services) {
      svc.clear()
      ;(svc as unknown as { baseUrl: string }).baseUrl = HOMESERVER
      ;(svc as unknown as { accessToken: string }).accessToken = ACCESS_TOKEN
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
    server.resetHandlers()
  })

  const filterBy = (substring: string) => seenUrls.filter((u) => u.url.includes(substring))

  describe('room ephemeral', () => {
    it('getRoomEphemeral hits GET /_matrix/client/v3/rooms/{roomId}/ephemeral and unwraps {data:{chunk}}', async () => {
      const result = await synapseRoomSummaryService.getRoomEphemeral('!room:hs')
      const calls = filterBy('/ephemeral')
      expect(calls).toHaveLength(1)
      expect(calls[0].method).toBe('GET')
      expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!room%3Ahs/ephemeral`)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('m.typing')
    })

    it('getRoomEphemeral appends ?types=... when types filter provided', async () => {
      await synapseRoomSummaryService.getRoomEphemeral('!room:hs', ['m.typing', 'm.receipt'])
      const calls = filterBy('/ephemeral')
      expect(calls).toHaveLength(1)
      expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!room%3Ahs/ephemeral?types=m.typing,m.receipt`)
    })
  })
})
