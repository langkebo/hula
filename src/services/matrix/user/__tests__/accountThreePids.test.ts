import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authedRequestWithPath } from '@/services/matrix/MatrixHttpClient'
import type { MatrixClient } from '@/services/matrix/sdk'
import { addThreePid, fetchThreePids, requestAddEmailToken, submitEmailToken } from '../accountThreePids'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/services/matrix/MatrixHttpClient', () => ({
  authedRequestWithPath: vi.fn()
}))

const authedRequestMock = vi.mocked(authedRequestWithPath)

interface FakeClientOptions {
  threepids?: unknown[]
  getThreePidsError?: Error
  requestTokenResponse?: Record<string, unknown>
  requestTokenError?: Error
  addError?: Error
}

function createFakeClient(options: FakeClientOptions = {}) {
  const manager = {
    getThreePids: vi.fn(async () => {
      if (options.getThreePidsError) {
        throw options.getThreePidsError
      }
      return { threepids: options.threepids ?? [] }
    }),
    addThreePidOnly: vi.fn(async () => {
      if (options.addError) {
        throw options.addError
      }
      return {}
    })
  }

  const client = {
    getThreePidsManager: () => manager,
    requestAdd3pidEmailToken: vi.fn(async () => {
      if (options.requestTokenError) {
        throw options.requestTokenError
      }
      return options.requestTokenResponse ?? { sid: 'sid-1', submit_url: 'https://id.example.com/submit' }
    })
  }

  return { client: client as unknown as MatrixClient, manager }
}

describe('accountThreePids', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authedRequestMock.mockResolvedValue({} as never)
  })

  describe('fetchThreePids', () => {
    it('把 validated_ts / validated_at 归一化为 validated 布尔值', async () => {
      const { client } = createFakeClient({
        threepids: [
          { medium: 'email', address: ' alice@example.com ', validated_ts: 1700000000000, added_at: 1690000000000 },
          { medium: 'msisdn', address: '+8613800000000', validated_at: 0 }
        ]
      })

      const result = await fetchThreePids(() => client)

      expect(result.threepids).toEqual([
        {
          medium: 'email',
          address: 'alice@example.com',
          validated: true,
          addedAt: 1690000000000,
          validatedAt: 1700000000000
        },
        {
          medium: 'msisdn',
          address: '+8613800000000',
          validated: false,
          addedAt: null,
          validatedAt: null
        }
      ])
      expect(result.pending3pids).toEqual([])
    })

    it('未绑定任何 3PID 时返回空列表', async () => {
      const { client } = createFakeClient({ threepids: [] })

      const result = await fetchThreePids(() => client)

      expect(result.threepids).toEqual([])
    })

    it('丢弃缺少地址的脏数据', async () => {
      const { client } = createFakeClient({ threepids: [{ medium: 'email' }, { medium: 'email', address: '' }] })

      const result = await fetchThreePids(() => client)

      expect(result.threepids).toEqual([])
    })

    it('SDK 抛错时向上抛出', async () => {
      const { client } = createFakeClient({ getThreePidsError: new Error('offline') })

      await expect(fetchThreePids(() => client)).rejects.toThrow('offline')
    })
  })

  describe('requestAddEmailToken', () => {
    it('返回 sid 与 submitUrl，并去除邮箱两端空格', async () => {
      const { client } = createFakeClient()

      const result = await requestAddEmailToken(() => client, '  alice@example.com  ', 'secret', 2)

      expect(result).toEqual({ sid: 'sid-1', submitUrl: 'https://id.example.com/submit' })
      expect(client.requestAdd3pidEmailToken).toHaveBeenCalledWith('alice@example.com', 'secret', 2)
    })

    it('服务端未返回 sid 时抛错', async () => {
      const { client } = createFakeClient({ requestTokenResponse: { submit_url: 'https://id.example.com/submit' } })

      await expect(requestAddEmailToken(() => client, 'alice@example.com', 'secret')).rejects.toThrow('sid')
    })

    it('请求失败时向上抛出', async () => {
      const { client } = createFakeClient({ requestTokenError: new Error('M_THREEPID_IN_USE') })

      await expect(requestAddEmailToken(() => client, 'alice@example.com', 'secret')).rejects.toThrow(
        'M_THREEPID_IN_USE'
      )
    })
  })

  describe('submitEmailToken', () => {
    it('走 SDK 鉴权通道提交 sid / client_secret / token', async () => {
      const { client } = createFakeClient()

      await submitEmailToken(() => client, 'sid-1', 'secret', ' 123456 ')

      expect(authedRequestMock).toHaveBeenCalledWith(
        client,
        'POST',
        '/_matrix/client/v3/account/3pid/email/submitToken',
        undefined,
        { sid: 'sid-1', client_secret: 'secret', token: '123456' }
      )
    })

    it('提交失败时向上抛出', async () => {
      authedRequestMock.mockRejectedValue(new Error('M_THREEPID_AUTH_FAILED') as never)

      const { client } = createFakeClient()

      await expect(submitEmailToken(() => client, 'sid-1', 'secret', '000000')).rejects.toThrow(
        'M_THREEPID_AUTH_FAILED'
      )
    })
  })

  describe('addThreePid', () => {
    it('把 UIA 认证数据一并传给 SDK', async () => {
      const { client, manager } = createFakeClient()
      const auth = { type: 'm.login.password', password: 'pwd' }

      await addThreePid(() => client, 'sid-1', 'secret', auth)

      expect(manager.addThreePidOnly).toHaveBeenCalledWith('secret', 'sid-1', auth)
    })

    it('添加失败时向上抛出', async () => {
      const { client } = createFakeClient({ addError: new Error('M_UNAUTHORIZED') })

      await expect(addThreePid(() => client, 'sid-1', 'secret')).rejects.toThrow('M_UNAUTHORIZED')
    })
  })
})
