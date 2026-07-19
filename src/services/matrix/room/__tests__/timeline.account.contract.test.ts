/**
 * Timeline + AccountData service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Uses a REAL SDK client so URL construction and prefix handling execute
 * through real matrix-js-sdk code. Catches V1 double-prefix bugs
 * (/_matrix/client/v3/_matrix/client/v1/rooms/.../timestamp_to_event → 404)
 * that vi.fn() mock tests miss because the stub bypasses SDK URL construction.
 *
 * Covers 2 authedRequestWithPath call sites:
 * - TimelineService.timestampToEvent → ROOM.TIMESTAMP_TO_EVENT (V1 prefix)
 * - AccountDataService.getReportScannerInfo → ROOM.REPORT_SCANNER_INFO (V1 prefix)
 */
import { createClient, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { MatrixRoomAccountDataService } from '../AccountDataService'
import { MatrixRoomTimelineService } from '../TimelineService'

const HOMESERVER = 'https://hs.timeline-account-contract.test'
const seenUrls: { method: string; url: string }[] = []
let realClient: MatrixClient

vi.mock('../../MatrixClientService', () => {
  const instance = {
    getClient: (): MatrixClient => realClient,
    getHomeserverUrl: () => HOMESERVER,
    waitForClientReady: () => Promise.resolve(realClient)
  }
  return { default: instance, matrixClientService: instance }
})

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

const server = setupMswServer(
  http.get(`${HOMESERVER}/_matrix/client/v1/rooms/:roomId/timestamp_to_event`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ event_id: '$evt-1:hs', origin_server_ts: 1700000000000 })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v1/rooms/:roomId/report/:eventId/scanner_info`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ clean: true, scanned_at: 1700000000000 })
  })
)

describe('Timeline + AccountData services URL construction contract (real SDK + msw)', () => {
  let timelineService: MatrixRoomTimelineService
  let accountDataService: MatrixRoomAccountDataService

  beforeEach(() => {
    seenUrls.length = 0
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.timeline-account-contract.test',
      deviceId: 'DEV1'
    })
    timelineService = new MatrixRoomTimelineService()
    accountDataService = new MatrixRoomAccountDataService()
  })

  afterEach(() => {
    vi.clearAllMocks()
    server.resetHandlers()
  })

  const V1_DOUBLE_PREFIX = /\/_matrix\/client\/v3\/_matrix\/client\/v1/

  describe('TimelineService.timestampToEvent', () => {
    it('hits /_matrix/client/v1/rooms/:roomId/timestamp_to_event with ts + dir (no V1 double-prefix)', async () => {
      const result = await timelineService.timestampToEvent('!room:hs', 1700000000000, 'f')

      const calls = seenUrls.filter((u) => u.url.includes('/timestamp_to_event'))
      expect(calls).toHaveLength(1)
      expect(calls[0].method).toBe('GET')
      expect(calls[0].url).toBe(
        `${HOMESERVER}/_matrix/client/v1/rooms/!room%3Ahs/timestamp_to_event?ts=1700000000000&dir=f`
      )
      expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
      expect(result?.event_id).toBe('$evt-1:hs')
      expect(result?.origin_server_ts).toBe(1700000000000)
    })

    it('defaults dir to "b" when omitted (no V1 double-prefix)', async () => {
      await timelineService.timestampToEvent('!room:hs', 12345)

      const calls = seenUrls.filter((u) => u.url.includes('/timestamp_to_event'))
      expect(calls).toHaveLength(1)
      expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/rooms/!room%3Ahs/timestamp_to_event?ts=12345&dir=b`)
      expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    })

    it('returns null on 404 (no V1 double-prefix on the failing call)', async () => {
      server.use(
        http.get(`${HOMESERVER}/_matrix/client/v1/rooms/:roomId/timestamp_to_event`, ({ request }) => {
          seenUrls.push({ method: request.method, url: request.url })
          return new HttpResponse(null, { status: 404 })
        })
      )

      const result = await timelineService.timestampToEvent('!missing:hs', 99999)
      expect(result).toBeNull()

      const calls = seenUrls.filter((u) => u.url.includes('/timestamp_to_event'))
      expect(calls).toHaveLength(1)
      expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    })
  })

  describe('AccountDataService.getReportScannerInfo', () => {
    it('hits /_matrix/client/v1/rooms/:roomId/report/:eventId/scanner_info (no V1 double-prefix)', async () => {
      const result = await accountDataService.getReportScannerInfo('!room:hs', '$evt-1:hs')

      const calls = seenUrls.filter((u) => u.url.includes('/scanner_info'))
      expect(calls).toHaveLength(1)
      expect(calls[0].method).toBe('GET')
      expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/rooms/!room%3Ahs/report/%24evt-1%3Ahs/scanner_info`)
      expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
      expect(result?.clean).toBe(true)
      expect(result?.scanned_at).toBe(1700000000000)
    })

    it('returns null on 404 (no V1 double-prefix on the failing call)', async () => {
      server.use(
        http.get(`${HOMESERVER}/_matrix/client/v1/rooms/:roomId/report/:eventId/scanner_info`, ({ request }) => {
          seenUrls.push({ method: request.method, url: request.url })
          return new HttpResponse(null, { status: 404 })
        })
      )

      const result = await accountDataService.getReportScannerInfo('!room:hs', '$missing:hs')
      expect(result).toBeNull()

      const calls = seenUrls.filter((u) => u.url.includes('/scanner_info'))
      expect(calls).toHaveLength(1)
      expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    })
  })
})
