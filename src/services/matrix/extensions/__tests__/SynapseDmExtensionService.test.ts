import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { getRuntimeAwareFetch } from '../../network/runtimeFetch'
import { synapseDmExtensionService } from '../SynapseDmExtensionService'

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

vi.mock('../../paths', () => ({
  PREFIX_V3: '/_matrix/client/v3',
  MATRIX_PATHS: {
    FRIENDS: {
      DM: (userId: string) => `/friends/dm/${userId}`
    }
  }
}))

function makeResponse(args: { ok: boolean; status: number; textResp?: string }): Response {
  return {
    ok: args.ok,
    status: args.status,
    text: async () => args.textResp ?? '',
    headers: { get: () => null }
  } as unknown as Response
}

describe('SynapseDmExtensionService', () => {
  const getHomeserverUrl = matrixClientService.getHomeserverUrl as ReturnType<typeof vi.fn>
  const getAccessToken = matrixClientService.getAccessToken as ReturnType<typeof vi.fn>
  const getRuntimeAwareFetchMock = getRuntimeAwareFetch as ReturnType<typeof vi.fn>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getHomeserverUrl.mockReset()
    getAccessToken.mockReset()
    getRuntimeAwareFetchMock.mockReset()
    fetchMock = vi.fn()
    getRuntimeAwareFetchMock.mockReturnValue(fetchMock)
    getHomeserverUrl.mockReturnValue('https://hs.example.com')
    getAccessToken.mockReturnValue('tok')
    synapseDmExtensionService.clear()
  })

  describe('createPrivateDm', () => {
    it('returns unwrapped data on success', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ room_id: '!dm:hs', created: true }) })
      )
      const result = await synapseDmExtensionService.createPrivateDm('@alice:hs')
      expect(result).toEqual({ room_id: '!dm:hs', created: true })
    })

    it('returns unwrapped data from wrapped { data } response', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify({ data: { room_id: '!dm2:hs', created: false } })
        })
      )
      const result = await synapseDmExtensionService.createPrivateDm('@alice:hs')
      expect(result).toEqual({ room_id: '!dm2:hs', created: false })
    })

    it('falls back to default empty result when response carries no data', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: null }) }))
      const result = await synapseDmExtensionService.createPrivateDm('@alice:hs')
      expect(result).toEqual({ room_id: '', created: false })
    })

    it('默认发送 is_private=false（与后端 create_friend_dm 的缺省值对齐）', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await synapseDmExtensionService.createPrivateDm('@alice:hs')
      const [, init] = fetchMock.mock.calls[0]
      expect(init.method).toBe('POST')
      // 实测 POST /friends/dm/{uid} 无 body 时后端返回 is_private:false；
      // 前端默认值曾是 true，会让普通「发消息」静默创建私密会话。
      expect(JSON.parse(init.body)).toEqual({ is_private: false })
    })

    it('sends is_private=false when isPrivate is false', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await synapseDmExtensionService.createPrivateDm('@alice:hs', false)
      const [, init] = fetchMock.mock.calls[0]
      expect(JSON.parse(init.body)).toEqual({ is_private: false })
    })

    it('encodes the userId in the request path', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await synapseDmExtensionService.createPrivateDm('@a b:hs')
      const [url] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('/friends/dm/%40a%20b%3Ahs')
    })

    it('rethrows when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('boom'))
      await expect(synapseDmExtensionService.createPrivateDm('@alice:hs')).rejects.toThrow('boom')
    })
  })

  describe('getDmRoom', () => {
    // 真实响应只有 {room_id, user_id}，没有 exists（实测）；无会话时 room_id 为 null。
    it('returns room_id and derives exists from it', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify({ room_id: '!dm:hs', user_id: '@alice:hs' })
        })
      )
      const result = await synapseDmExtensionService.getDmRoom('@alice:hs')
      expect(result).toEqual({ room_id: '!dm:hs', exists: true })
    })

    it('unwraps { data } response and derives exists', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: { room_id: '!dm2:hs' } }) })
      )
      const result = await synapseDmExtensionService.getDmRoom('@alice:hs')
      expect(result).toEqual({ room_id: '!dm2:hs', exists: true })
    })

    it('treats null room_id (no existing DM) as not exists', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ room_id: null, user_id: '@alice:hs' }) })
      )
      const result = await synapseDmExtensionService.getDmRoom('@alice:hs')
      expect(result).toEqual({ room_id: null, exists: false })
    })

    it('falls back to empty result when response carries no data', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: null }) }))
      const result = await synapseDmExtensionService.getDmRoom('@alice:hs')
      expect(result).toEqual({ room_id: null, exists: false })
    })

    it('returns default empty result on request failure (does not throw)', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      const result = await synapseDmExtensionService.getDmRoom('@alice:hs')
      expect(result).toEqual({ room_id: null, exists: false })
    })
  })
})
