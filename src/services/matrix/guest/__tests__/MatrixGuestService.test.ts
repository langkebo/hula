import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixGuestService } from '../MatrixGuestService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

describe('MatrixGuestService', () => {
  let mockGuestManager: Record<string, ReturnType<typeof vi.fn>>
  let mockClient: {
    getGuestManager: ReturnType<typeof vi.fn>
    http: { authedRequest: ReturnType<typeof vi.fn> }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    matrixGuestService.stop()

    mockGuestManager = {
      registerGuest: vi.fn(),
      getGuestInfoFromServer: vi.fn(),
      stop: vi.fn()
    }

    mockClient = {
      getGuestManager: vi.fn(() => mockGuestManager),
      http: { authedRequest: vi.fn() }
    }

    vi.spyOn(matrixGuestService as unknown as { getClient: () => MatrixClient }, 'getClient').mockReturnValue(
      mockClient as unknown as MatrixClient
    )
  })

  describe('getGuestInfoFromServer', () => {
    it('returns guest info from GuestManager and does not use HTTP', async () => {
      const guestInfo = { user_id: '@guest:server', device_id: 'dev', is_guest: true }
      mockGuestManager.getGuestInfoFromServer.mockResolvedValue(guestInfo)

      const result = await matrixGuestService.getGuestInfoFromServer()

      expect(result).toEqual(guestInfo)
      expect(mockGuestManager.getGuestInfoFromServer).toHaveBeenCalledTimes(1)
      expect(mockClient.http.authedRequest).not.toHaveBeenCalled()
    })

    it('does not fall back to HTTP when manager lacks getGuestInfoFromServer', async () => {
      // Manager that passes requireGuestManager (has registerGuest) but
      // does NOT expose getGuestInfoFromServer — triggers the fallback path.
      const limitedManager = {
        registerGuest: vi.fn(),
        stop: vi.fn()
      }
      mockClient.getGuestManager.mockReturnValue(limitedManager)
      mockClient.http.authedRequest.mockResolvedValue({
        user_id: '@guest:server',
        device_id: 'dev',
        is_guest: true
      })

      // After migration the fallback calls client.getGuestManager().getGuestInfoFromServer()
      // (which throws because the method is absent) instead of HTTP.
      await expect(matrixGuestService.getGuestInfoFromServer()).rejects.toThrow()
      expect(mockClient.http.authedRequest).not.toHaveBeenCalled()
    })
  })
})
