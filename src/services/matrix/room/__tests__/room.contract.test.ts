/**
 * Room service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Uses a REAL SDK client so URL construction and prefix handling execute.
 * Catches URL duplication bugs that vi.mock tests miss.
 */
import { createClient, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixClientService } from '../../MatrixClientService'
import { roomOperations } from '../RoomOperations'

const HOMESERVER = 'https://hs.room-contract.test'
const seenUrls: string[] = []
let realClient: MatrixClient

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

setupMswServer(
  http.post(`${HOMESERVER}/_matrix/client/v3/translate`, async ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({ translated_text: 'translated' })
  })
)

describe('Room service URL construction contract (real SDK + msw)', () => {
  beforeEach(() => {
    seenUrls.length = 0
    vi.spyOn(matrixClientService, 'getHomeserverUrl').mockReturnValue(HOMESERVER)
    vi.spyOn(matrixClientService, 'getClient').mockImplementation(() => realClient)
    vi.spyOn(matrixClientService, 'waitForClientReady').mockImplementation(() => Promise.resolve(realClient))
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.room-contract.test',
      deviceId: 'DEV1'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('translateText hits /_matrix/client/v3/translate exactly once (no duplication)', async () => {
    const result = await roomOperations.translateText('hello', 'zh', false)

    const translateCalls = seenUrls.filter((u) => u.includes('/translate'))
    expect(translateCalls).toHaveLength(1)
    expect(translateCalls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/translate`)
    expect(result).toBe('translated')
  })
})
