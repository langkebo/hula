import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { createRateLimitedFetch, shouldApplyClientRateLimit } from '../MatrixRateLimitInterceptor'

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
