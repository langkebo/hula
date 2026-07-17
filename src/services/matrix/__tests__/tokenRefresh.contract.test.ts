import { createClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { MatrixTokenManager } from '../MatrixTokenManager'

const { persistRefreshedTokenMock, logoutExpiredSessionMock } = vi.hoisted(() => ({
  persistRefreshedTokenMock: vi.fn().mockResolvedValue(undefined),
  logoutExpiredSessionMock: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/services/matrix/matrixClientPlatform', () => ({
  persistRefreshedToken: persistRefreshedTokenMock,
  logoutExpiredSession: logoutExpiredSessionMock
}))

const HOMESERVER = 'https://hs.contract.test'
const REFRESH_URL = `${HOMESERVER}/_matrix/client/v3/refresh`

const seenBodies: unknown[] = []

const server = setupMswServer(
  http.post(REFRESH_URL, async ({ request }) => {
    seenBodies.push(await request.json())
    return HttpResponse.json({
      access_token: 'at-new',
      refresh_token: 'rt-new',
      expires_in_ms: 7200000
    })
  })
)

describe('token refresh contract (real SDK http layer + msw)', () => {
  let manager: MatrixTokenManager

  const client = createClient({
    baseUrl: HOMESERVER,
    accessToken: 'at-old',
    userId: '@contract:hs.contract.test'
  })

  beforeEach(() => {
    seenBodies.length = 0
    vi.clearAllMocks()
    vi.useFakeTimers()
    manager = new MatrixTokenManager()
  })

  afterEach(() => {
    manager.clear()
    vi.useRealTimers()
  })

  it('refresh request hits /_matrix/client/v3/refresh on the wire and persists new tokens', async () => {
    manager.schedule(client, 'rt-old', 120000)

    await vi.advanceTimersByTimeAsync(60001)
    vi.useRealTimers()

    await vi.waitFor(() => {
      expect(persistRefreshedTokenMock).toHaveBeenCalledWith('@contract:hs.contract.test', 'at-new', 'rt-new')
    })
    expect(seenBodies).toEqual([{ refresh_token: 'rt-old' }])
    expect(logoutExpiredSessionMock).not.toHaveBeenCalled()
  })

  it('logs out when the server rejects the refresh token with 401 M_UNKNOWN_TOKEN', async () => {
    server.use(
      http.post(REFRESH_URL, () =>
        HttpResponse.json({ errcode: 'M_UNKNOWN_TOKEN', error: 'Invalid refresh token' }, { status: 401 })
      )
    )

    manager.schedule(client, 'rt-revoked', 120000)

    await vi.advanceTimersByTimeAsync(60001)
    vi.useRealTimers()

    await vi.waitFor(() => {
      expect(logoutExpiredSessionMock).toHaveBeenCalled()
    })
    expect(persistRefreshedTokenMock).not.toHaveBeenCalled()
  })
})
