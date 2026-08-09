import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import {
  __resetRateLimitCircuitForTests,
  createRateLimitedFetch,
  shouldApplyClientRateLimit
} from '../MatrixRateLimitInterceptor'

const HOMESERVER = 'https://hs.example.com'

const server = setupMswServer()

describe('MatrixRateLimitInterceptor — /sync 路径跳过客户端限流', () => {
  beforeEach(() => {
    server.resetHandlers()
  })

  afterEach(() => {
    server.resetHandlers()
  })

  describe('shouldApplyClientRateLimit', () => {
    it('对 SlidingSync 路径返回 false', () => {
      const url = `${HOMESERVER}/_matrix/client/unstable/org.matrix.simplified_msc3575/sync`
      expect(shouldApplyClientRateLimit(url)).toBe(false)
    })

    it('对 r0/sync 路径返回 false', () => {
      const url = `${HOMESERVER}/_matrix/client/r0/sync?timeout=30000`
      expect(shouldApplyClientRateLimit(url)).toBe(false)
    })

    it('对 v3/sync 路径返回 false', () => {
      const url = `${HOMESERVER}/_matrix/client/v3/sync?since=12345`
      expect(shouldApplyClientRateLimit(url)).toBe(false)
    })

    it('对非 /sync 路径返回 true', () => {
      expect(shouldApplyClientRateLimit(`${HOMESERVER}/_matrix/client/r0/login`)).toBe(true)
      expect(shouldApplyClientRateLimit(`${HOMESERVER}/_matrix/client/v3/account/whoami`)).toBe(true)
      expect(shouldApplyClientRateLimit(`${HOMESERVER}/_matrix/media/v3/upload`)).toBe(true)
    })

    it('支持 URL 对象和 Request 对象', () => {
      expect(shouldApplyClientRateLimit(new URL(`${HOMESERVER}/_matrix/client/v3/sync`))).toBe(false)
      expect(shouldApplyClientRateLimit(new Request(`${HOMESERVER}/_matrix/client/v3/sync`))).toBe(false)
      expect(shouldApplyClientRateLimit(new Request(`${HOMESERVER}/_matrix/client/r0/login`))).toBe(true)
    })
  })

  describe('createRateLimitedFetch — /sync 路径不重试 429', () => {
    it('SlidingSync 路径收到 429 后不重试，直接返回响应', async () => {
      let callCount = 0
      server.use(
        http.post(`${HOMESERVER}/_matrix/client/unstable/org.matrix.simplified_msc3575/sync`, () => {
          callCount++
          return HttpResponse.json({ errcode: 'M_LIMIT_EXCEEDED', retry_after_ms: 2000 }, { status: 429 })
        })
      )

      const rateLimitedFetch = createRateLimitedFetch(fetch)
      const response = await rateLimitedFetch(
        `${HOMESERVER}/_matrix/client/unstable/org.matrix.simplified_msc3575/sync`,
        {
          method: 'POST'
        }
      )

      expect(response.status).toBe(429)
      expect(callCount).toBe(1) // 不重试
    })

    it('v3/sync 路径收到 429 后不重试，直接返回响应', async () => {
      let callCount = 0
      server.use(
        http.get(`${HOMESERVER}/_matrix/client/v3/sync`, () => {
          callCount++
          return HttpResponse.json({ errcode: 'M_LIMIT_EXCEEDED', retry_after_ms: 1000 }, { status: 429 })
        })
      )

      const rateLimitedFetch = createRateLimitedFetch(fetch)
      const response = await rateLimitedFetch(`${HOMESERVER}/_matrix/client/v3/sync?timeout=0`)

      expect(response.status).toBe(429)
      expect(callCount).toBe(1) // 不重试
    })

    it('r0/sync 路径收到 429 后不重试，直接返回响应', async () => {
      let callCount = 0
      server.use(
        http.get(`${HOMESERVER}/_matrix/client/r0/sync`, () => {
          callCount++
          return HttpResponse.json({ errcode: 'M_LIMIT_EXCEEDED' }, { status: 429 })
        })
      )

      const rateLimitedFetch = createRateLimitedFetch(fetch)
      const response = await rateLimitedFetch(`${HOMESERVER}/_matrix/client/r0/sync?timeout=0`)

      expect(response.status).toBe(429)
      expect(callCount).toBe(1) // 不重试
    })
  })

  describe('createRateLimitedFetch — 非 /sync 路径保持客户端限流', () => {
    it('GET /login 收到 429 后重试（使用 retry_after_ms）', async () => {
      let callCount = 0
      server.use(
        http.get(`${HOMESERVER}/_matrix/client/r0/login`, () => {
          callCount++
          if (callCount === 1) {
            return HttpResponse.json({ errcode: 'M_LIMIT_EXCEEDED', retry_after_ms: 50 }, { status: 429 })
          }
          return HttpResponse.json({ user_id: '@test:hs.example.com' })
        })
      )

      const rateLimitedFetch = createRateLimitedFetch(fetch)
      const response = await rateLimitedFetch(`${HOMESERVER}/_matrix/client/r0/login`)

      expect(response.status).toBe(200)
      expect(callCount).toBe(2) // 1 次 429 + 1 次成功
    })

    it('GET /account/whoami 收到 429 后使用指数退避重试', async () => {
      let callCount = 0
      server.use(
        http.get(`${HOMESERVER}/_matrix/client/v3/account/whoami`, () => {
          callCount++
          if (callCount === 1) {
            // 不提供 retry_after_ms，触发指数退避
            return HttpResponse.json({ errcode: 'M_LIMIT_EXCEEDED' }, { status: 429 })
          }
          return HttpResponse.json({ user_id: '@test:hs.example.com' })
        })
      )

      const rateLimitedFetch = createRateLimitedFetch(fetch)
      const response = await rateLimitedFetch(`${HOMESERVER}/_matrix/client/v3/account/whoami`)

      expect(response.status).toBe(200)
      expect(callCount).toBe(2) // 1 次 429 + 1 次成功
    })

    it('POST /login 收到 429 后不重试（非幂等方法）', async () => {
      let callCount = 0
      server.use(
        http.post(`${HOMESERVER}/_matrix/client/r0/login`, () => {
          callCount++
          return HttpResponse.json({ errcode: 'M_LIMIT_EXCEEDED', retry_after_ms: 100 }, { status: 429 })
        })
      )

      const rateLimitedFetch = createRateLimitedFetch(fetch)
      const response = await rateLimitedFetch(`${HOMESERVER}/_matrix/client/r0/login`, {
        method: 'POST',
        body: JSON.stringify({ type: 'm.login.password' })
      })

      expect(response.status).toBe(429)
      expect(callCount).toBe(1) // POST 不重试
    })
  })
})

describe('MatrixRateLimitInterceptor — 幂等 POST 白名单与熔断器', () => {
  beforeEach(() => {
    server.resetHandlers()
    __resetRateLimitCircuitForTests()
  })

  afterEach(() => {
    server.resetHandlers()
    __resetRateLimitCircuitForTests()
  })

  it('POST /keys/query 收到 429 后按 retry_after_ms 重试（幂等白名单）', async () => {
    let callCount = 0
    server.use(
      http.post(`${HOMESERVER}/_matrix/client/v3/keys/query`, () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ errcode: 'M_LIMIT_EXCEEDED', retry_after_ms: 10 }, { status: 429 })
        }
        return HttpResponse.json({ device_keys: {} })
      })
    )

    const rateLimitedFetch = createRateLimitedFetch(fetch)
    const response = await rateLimitedFetch(`${HOMESERVER}/_matrix/client/v3/keys/query`, {
      method: 'POST',
      body: JSON.stringify({ device_keys: { '@u:hs': [] } })
    })

    expect(response.status).toBe(200)
    expect(callCount).toBe(2)
  })

  it('POST /keys/changes 在幂等白名单内，429 会重试', async () => {
    let callCount = 0
    server.use(
      http.get(`${HOMESERVER}/_matrix/client/v3/keys/changes`, () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ errcode: 'M_LIMIT_EXCEEDED', retry_after_ms: 10 }, { status: 429 })
        }
        return HttpResponse.json({ changed: [], left: [] })
      })
    )

    const rateLimitedFetch = createRateLimitedFetch(fetch)
    const response = await rateLimitedFetch(`${HOMESERVER}/_matrix/client/v3/keys/changes`)

    expect(response.status).toBe(200)
    expect(callCount).toBe(2)
  })

  it('连续 429 达到阈值后熔断：不再发真实请求，返回合成 429', async () => {
    let callCount = 0
    server.use(
      http.post(`${HOMESERVER}/_matrix/client/v3/keys/query`, () => {
        callCount++
        return HttpResponse.json({ errcode: 'M_LIMIT_EXCEEDED', retry_after_ms: 1 }, { status: 429 })
      })
    )

    const rateLimitedFetch = createRateLimitedFetch(fetch)
    const init = { method: 'POST', body: JSON.stringify({ device_keys: {} }) }
    const url = `${HOMESERVER}/_matrix/client/v3/keys/query`

    // 3 次调用（每次内部 1+3 重试 = 4 个真实请求）后熔断器开路
    for (let i = 0; i < 3; i++) {
      const res = await rateLimitedFetch(url, init)
      expect(res.status).toBe(429)
    }
    expect(callCount).toBe(12)

    // 第 4 次调用：熔断中，不发网络请求，直接返回合成 429
    const blocked = await rateLimitedFetch(url, init)
    expect(blocked.status).toBe(429)
    expect(callCount).toBe(12)
    const body = await blocked.json()
    expect(body.errcode).toBe('M_LIMIT_EXCEEDED')
    expect(body.retry_after_ms).toBeGreaterThan(0)
  })

  it('端点恢复成功后熔断器复位', async () => {
    let callCount = 0
    server.use(
      http.post(`${HOMESERVER}/_matrix/client/v3/keys/query`, () => {
        callCount++
        if (callCount <= 3) {
          return HttpResponse.json({ errcode: 'M_LIMIT_EXCEEDED', retry_after_ms: 1 }, { status: 429 })
        }
        return HttpResponse.json({ device_keys: {} })
      })
    )

    const rateLimitedFetch = createRateLimitedFetch(fetch)
    const init = { method: 'POST', body: JSON.stringify({ device_keys: {} }) }
    const url = `${HOMESERVER}/_matrix/client/v3/keys/query`

    // 第一次调用：1 次 429 + 重试后成功（第 2、3 次 429，第 4 次成功）
    const res = await rateLimitedFetch(url, init)
    expect(res.status).toBe(200)

    // 成功响应应清空失败计数，后续调用不受熔断影响
    const res2 = await rateLimitedFetch(url, init)
    expect(res2.status).toBe(200)
  })
})
