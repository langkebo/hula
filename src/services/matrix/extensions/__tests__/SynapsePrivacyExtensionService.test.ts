import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { matrixBurnAfterReadService } from '../../messaging/MatrixBurnAfterReadService'
import { getRuntimeAwareFetch } from '../../network/runtimeFetch'
import { synapsePrivacyExtensionService } from '../SynapsePrivacyExtensionService'

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getHomeserverUrl: vi.fn(),
    getAccessToken: vi.fn(),
    waitForClientReady: vi.fn()
  }
}))

vi.mock('../../network/runtimeFetch', () => ({
  getRuntimeAwareFetch: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('../../messaging/MatrixBurnAfterReadService', () => ({
  matrixBurnAfterReadService: {
    enableBurn: vi.fn()
  }
}))

vi.mock('../../paths', () => ({
  PREFIX_V3: '/_matrix/client/v3',
  MATRIX_PATHS: {}
}))

function makeResponse(args: { ok: boolean; status: number; textResp?: string }): Response {
  return {
    ok: args.ok,
    status: args.status,
    text: async () => args.textResp ?? '',
    headers: { get: () => null }
  } as unknown as Response
}

describe('SynapsePrivacyExtensionService', () => {
  const getHomeserverUrl = matrixClientService.getHomeserverUrl as ReturnType<typeof vi.fn>
  const getAccessToken = matrixClientService.getAccessToken as ReturnType<typeof vi.fn>
  const getRuntimeAwareFetchMock = getRuntimeAwareFetch as ReturnType<typeof vi.fn>
  const enableBurnMock = matrixBurnAfterReadService.enableBurn as ReturnType<typeof vi.fn>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getHomeserverUrl.mockReset()
    getAccessToken.mockReset()
    getRuntimeAwareFetchMock.mockReset()
    enableBurnMock.mockReset()
    fetchMock = vi.fn()
    getRuntimeAwareFetchMock.mockReturnValue(fetchMock)
    getHomeserverUrl.mockReturnValue('https://hs.example.com')
    getAccessToken.mockReturnValue('tok')
    enableBurnMock.mockResolvedValue({ enabled: true, burnAfterMs: 1000 })
    synapsePrivacyExtensionService.clear()
  })

  describe('enableAntiScreenshot', () => {
    it('sends a PUT with enabled=true and resolves on success', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await expect(synapsePrivacyExtensionService.enableAntiScreenshot('!room:hs')).resolves.toBeUndefined()
      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('/rooms/!room%3Ahs/anti_screenshot')
      expect(init.method).toBe('PUT')
      expect(JSON.parse(init.body)).toEqual({ enabled: true })
    })

    it('sends enabled=false when explicitly disabled', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await synapsePrivacyExtensionService.enableAntiScreenshot('!room:hs', false)
      const [, init] = fetchMock.mock.calls[0]
      expect(JSON.parse(init.body)).toEqual({ enabled: false })
    })

    it('rethrows when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('boom'))
      await expect(synapsePrivacyExtensionService.enableAntiScreenshot('!room:hs')).rejects.toThrow('boom')
    })
  })

  describe('isAntiScreenshotEnabled', () => {
    it('returns true when enabled is true', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ enabled: true }) }))
      const result = await synapsePrivacyExtensionService.isAntiScreenshotEnabled('!room:hs')
      expect(result).toBe(true)
    })

    it('returns true from wrapped { data } response', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: { enabled: true } }) })
      )
      const result = await synapsePrivacyExtensionService.isAntiScreenshotEnabled('!room:hs')
      expect(result).toBe(true)
    })

    it('returns false when enabled is false', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ enabled: false }) }))
      const result = await synapsePrivacyExtensionService.isAntiScreenshotEnabled('!room:hs')
      expect(result).toBe(false)
    })

    it('returns false when the response carries no data', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: null }) }))
      const result = await synapsePrivacyExtensionService.isAntiScreenshotEnabled('!room:hs')
      expect(result).toBe(false)
    })

    it('returns false when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      const result = await synapsePrivacyExtensionService.isAntiScreenshotEnabled('!room:hs')
      expect(result).toBe(false)
    })
  })

  describe('createPrivateChat', () => {
    it('creates a private chat, enables burn and anti-screenshot, returns roomId', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ room_id: '!private:hs' }) })
      )
      const roomId = await synapsePrivacyExtensionService.createPrivateChat(['@alice:hs', '@bob:hs'])
      expect(roomId).toBe('!private:hs')
      expect(enableBurnMock).toHaveBeenCalledWith('!private:hs')
      // 两次请求：create_private POST + anti_screenshot PUT
      expect(fetchMock).toHaveBeenCalledTimes(2)
      const [createUrl, createInit] = fetchMock.mock.calls[0]
      expect(String(createUrl)).toContain('/rooms/create_private')
      expect(createInit.method).toBe('POST')
      const body = JSON.parse(createInit.body)
      expect(body.invite).toEqual(['@alice:hs', '@bob:hs'])
      expect(body.is_direct).toBe(false)
      expect(body.preset).toBe('trusted_private_chat')
    })

    it('marks is_direct true for a single user chat', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ room_id: '!private2:hs' }) })
      )
      await synapsePrivacyExtensionService.createPrivateChat(['@alice:hs'])
      const [, createInit] = fetchMock.mock.calls[0]
      expect(JSON.parse(createInit.body).is_direct).toBe(true)
    })

    it('throws create_failed_no_id when no room_id is returned', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: null }) }))
      await expect(synapsePrivacyExtensionService.createPrivateChat(['@alice:hs'])).rejects.toThrow(
        'matrix_error.room.create_failed_no_id'
      )
      expect(enableBurnMock).not.toHaveBeenCalled()
    })

    it('rethrows when enabling burn after read fails', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ room_id: '!private3:hs' }) })
      )
      enableBurnMock.mockRejectedValue(new Error('burn boom'))
      await expect(synapsePrivacyExtensionService.createPrivateChat(['@alice:hs'])).rejects.toThrow('burn boom')
    })

    it('rethrows when the create request fails', async () => {
      fetchMock.mockRejectedValue(new Error('boom'))
      await expect(synapsePrivacyExtensionService.createPrivateChat(['@alice:hs'])).rejects.toThrow('boom')
    })
  })
})
