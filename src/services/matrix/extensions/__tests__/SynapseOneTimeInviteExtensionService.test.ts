import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  responses: [] as Array<{ ok: boolean; status: number; body: string }>
}))

vi.mock('@/services/matrix/network/runtimeFetch', () => ({
  getRuntimeAwareFetch: () => mocks.fetch
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getHomeserverUrl: () => 'https://hs.example',
    getAccessToken: () => 'tok-1'
  }
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

import { synapseOneTimeInviteService } from '../SynapseOneTimeInviteExtensionService'

const HOMESERVER = 'https://hs.example'

function reply(ok: boolean, status: number, body: unknown) {
  mocks.responses.push({ ok, status, body: JSON.stringify(body) })
}

describe('SynapseOneTimeInviteExtensionService（F-5 / B-9）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.responses.length = 0
    mocks.fetch.mockImplementation(async () => {
      const next = mocks.responses.shift()
      return {
        ok: next?.ok ?? false,
        status: next?.status ?? 500,
        statusText: '',
        headers: new Headers(),
        text: async () => next?.body ?? ''
      }
    })
  })

  it('create 走 POST /_matrix/vendor/v1/invites/one-time', async () => {
    reply(true, 200, { token: 'tok', expires_at: 1, deep_link: 'https://x/claim?token=tok' })

    const created = await synapseOneTimeInviteService.create()

    const [url, init] = mocks.fetch.mock.calls[0]
    expect(url).toBe(`${HOMESERVER}/_matrix/vendor/v1/invites/one-time`)
    expect(init.method).toBe('POST')
    expect(created.token).toBe('tok')
  })

  it('create 带 ttl 时把 ttl_ms 放进请求体', async () => {
    reply(true, 200, { token: 'tok', expires_at: 1, deep_link: 'l' })

    await synapseOneTimeInviteService.create(3_600_000)

    const body = (mocks.fetch.mock.calls[0][1] as RequestInit).body as string
    expect(JSON.parse(body)).toEqual({ ttl_ms: 3_600_000 })
  })

  // 后端契约要求必返 token；缺失说明版本错配，不能静默当作成功
  it('响应缺 token 时抛错，而不是返回一个空邀请', async () => {
    reply(true, 200, { expires_at: 1, deep_link: 'l' })

    await expect(synapseOneTimeInviteService.create()).rejects.toThrow()
  })

  it('claim 走 POST /_matrix/vendor/v1/invites/claim 并带 token', async () => {
    reply(true, 200, { room_id: '!r:hs', room_alias: null })

    const result = await synapseOneTimeInviteService.claim('tok')

    const [url, init] = mocks.fetch.mock.calls[0]
    expect(url).toBe(`${HOMESERVER}/_matrix/vendor/v1/invites/claim`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ token: 'tok' })
    expect(result.room_id).toBe('!r:hs')
  })

  // 重放同一 token 第二次必须失败（B-9 的验收点）；前端必须把失败抛出去
  it('claim 被服务端拒绝（403 已使用）时抛错', async () => {
    reply(false, 403, { errcode: 'M_FORBIDDEN', error: 'Invite token has already been used' })

    await expect(synapseOneTimeInviteService.claim('tok')).rejects.toThrow()
  })

  it('claim 响应缺 room_id 时返回 null（由上层决定不跳转）', async () => {
    reply(true, 200, {})

    await expect(synapseOneTimeInviteService.claim('tok')).resolves.toEqual({
      room_id: null,
      room_alias: null
    })
  })
})
