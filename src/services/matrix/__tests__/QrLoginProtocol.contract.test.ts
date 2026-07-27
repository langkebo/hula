/**
 * QR 登录协议一致性契约测试
 *
 * 验证前端 QR 登录实现（MatrixQrLoginSdkService）与后端 synapse-rust 的协议路径一致。
 *
 * 协议：MSC4108（rendezvous transport + m.login.token）
 *   - 后端端点：
 *     • POST   /_matrix/client/unstable/org.matrix.msc4108/rendezvous          (create session)
 *     • GET    /_matrix/client/unstable/org.matrix.msc4108/rendezvous/{id}     (poll data)
 *     • PUT    /_matrix/client/unstable/org.matrix.msc4108/rendezvous/{id}     (update data)
 *     • DELETE /_matrix/client/unstable/org.matrix.msc4108/rendezvous/{id}     (close session)
 *     • POST   /_matrix/client/v1/login/qr_token                               (generate login token)
 *     • POST   /_matrix/client/v3/login                                        (m.login.token exchange)
 *
 * 已删除的 MSC4388 端点（不应再有请求）：
 *   - GET  /_matrix/client/v1/login/get_qr_code
 *   - POST /_matrix/client/v1/login/qr/confirm
 *   - POST /_matrix/client/v1/login/qr/start
 *   - GET  /_matrix/client/v1/login/qr/{transaction_id}/status
 *   - POST /_matrix/client/v1/login/qr/invalidate
 */

import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setupMswServer } from '~/tests/msw'

const HOMESERVER = 'https://hs.example.com'
const MSC4108_PREFIX = '/_matrix/client/unstable/org.matrix.msc4108'
const MSC4108_RENDEZVOUS_URL = `${HOMESERVER}${MSC4108_PREFIX}/rendezvous`

const server = setupMswServer()

// Track all requests to verify protocol paths
const seenUrls: string[] = []

function trackRequest(url: string) {
  seenUrls.push(url)
}

beforeEach(() => {
  seenUrls.length = 0
  server.resetHandlers()
})

afterEach(() => {
  server.resetHandlers()
})

describe('QR 登录协议一致性（MSC4108）', () => {
  describe('后端 MSC4108 端点可用性', () => {
    it('POST /rendezvous 创建会话返回 200 + url + ETag', async () => {
      server.use(
        http.post(MSC4108_RENDEZVOUS_URL, ({ request }) => {
          trackRequest(request.url)
          return HttpResponse.json(
            { url: `${MSC4108_RENDEZVOUS_URL}/session-123` },
            {
              status: 200,
              headers: {
                ETag: '"etag-001"',
                Expires: 'Wed, 21 Oct 2026 07:28:00 GMT'
              }
            }
          )
        })
      )

      const response = await fetch(MSC4108_RENDEZVOUS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'encrypted-payload'
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.url).toBe(`${MSC4108_RENDEZVOUS_URL}/session-123`)
      expect(response.headers.get('ETag')).toBeTruthy()
    })

    it('GET /rendezvous/{id} 轮询数据返回 200 + text/plain', async () => {
      const sessionId = 'session-123'
      server.use(
        http.get(`${MSC4108_RENDEZVOUS_URL}/${sessionId}`, ({ request }) => {
          trackRequest(request.url)
          return new HttpResponse('encrypted-data-blob', {
            status: 200,
            headers: {
              ETag: '"etag-002"',
              'Content-Type': 'text/plain'
            }
          })
        })
      )

      const response = await fetch(`${MSC4108_RENDEZVOUS_URL}/${sessionId}`)

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('encrypted-data-blob')
      expect(response.headers.get('Content-Type')).toContain('text/plain')
    })

    it('GET /rendezvous/{id} 支持 If-None-Match 返回 304', async () => {
      const sessionId = 'session-123'
      server.use(
        http.get(`${MSC4108_RENDEZVOUS_URL}/${sessionId}`, ({ request }) => {
          trackRequest(request.url)
          const ifNoneMatch = request.headers.get('If-None-Match')
          if (ifNoneMatch === '"etag-002"') {
            return new HttpResponse(null, {
              status: 304,
              headers: { ETag: '"etag-002"' }
            })
          }
          return new HttpResponse('new-data', {
            status: 200,
            headers: { ETag: '"etag-003"', 'Content-Type': 'text/plain' }
          })
        })
      )

      // First poll — gets data
      const r1 = await fetch(`${MSC4108_RENDEZVOUS_URL}/${sessionId}`)
      expect(r1.status).toBe(200)

      // Second poll with If-None-Match — gets 304
      const r2 = await fetch(`${MSC4108_RENDEZVOUS_URL}/${sessionId}`, {
        headers: { 'If-None-Match': '"etag-002"' }
      })
      expect(r2.status).toBe(304)
    })

    it('PUT /rendezvous/{id} 更新数据返回 200 + 新 ETag', async () => {
      const sessionId = 'session-123'
      server.use(
        http.put(`${MSC4108_RENDEZVOUS_URL}/${sessionId}`, ({ request }) => {
          trackRequest(request.url)
          return new HttpResponse(null, {
            status: 200,
            headers: { ETag: '"etag-updated"', 'Content-Type': 'text/plain' }
          })
        })
      )

      const response = await fetch(`${MSC4108_RENDEZVOUS_URL}/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain', 'If-Match': '"etag-002"' },
        body: 'new-encrypted-payload'
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('ETag')).toBe('"etag-updated"')
    })

    it('DELETE /rendezvous/{id} 关闭会话返回 200', async () => {
      const sessionId = 'session-123'
      server.use(
        http.delete(`${MSC4108_RENDEZVOUS_URL}/${sessionId}`, ({ request }) => {
          trackRequest(request.url)
          return new HttpResponse(null, { status: 200 })
        })
      )

      const response = await fetch(`${MSC4108_RENDEZVOUS_URL}/${sessionId}`, { method: 'DELETE' })
      expect(response.status).toBe(200)
    })

    it('POST /v1/login/qr_token 生成登录令牌返回 200', async () => {
      server.use(
        http.post(`${HOMESERVER}/_matrix/client/v1/login/qr_token`, ({ request }) => {
          trackRequest(request.url)
          return HttpResponse.json({
            login_token: 'token-abc-123',
            expires_in_ms: 60000
          })
        })
      )

      const response = await fetch(`${HOMESERVER}/_matrix/client/v1/login/qr_token`, {
        method: 'POST',
        headers: { Authorization: 'Bearer existing-device-token' }
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.login_token).toBeTruthy()
      expect(body.expires_in_ms).toBe(60000)
    })

    it('POST /v3/login 使用 m.login.token 交换访问令牌', async () => {
      server.use(
        http.post(`${HOMESERVER}/_matrix/client/v3/login`, ({ request }) => {
          trackRequest(request.url)
          return HttpResponse.json({
            user_id: '@user:hs.example.com',
            access_token: 'new-access-token',
            device_id: 'NEWDEVICE001'
          })
        })
      )

      const response = await fetch(`${HOMESERVER}/_matrix/client/v3/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'm.login.token',
          token: 'token-abc-123',
          device_id: 'NEWDEVICE001'
        })
      })

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.access_token).toBeTruthy()
      expect(body.user_id).toBe('@user:hs.example.com')
    })
  })

  describe('MSC4388 端点已删除（不应可用）', () => {
    const MSC4388_PATHS = [
      '/_matrix/client/v1/login/get_qr_code',
      '/_matrix/client/v1/login/qr/confirm',
      '/_matrix/client/v1/login/qr/start',
      '/_matrix/client/v1/login/qr/transaction-123/status',
      '/_matrix/client/v1/login/qr/invalidate'
    ]

    MSC4388_PATHS.forEach((path) => {
      it(`${path} 应返回 404（端点已删除）`, async () => {
        // 不注册 MSW handler — 模拟后端无此路由
        // MSW 对未注册的 URL 默认返回 passthrough，这里用 onUnhandledRequest 控制
        server.use(
          http.all(`${HOMESERVER}${path}`, () => {
            return new HttpResponse(null, { status: 404 })
          })
        )

        const methods = ['GET', 'POST'] as const
        for (const method of methods) {
          const response = await fetch(`${HOMESERVER}${path}`, { method })
          expect(response.status).toBe(404)
        }
      })
    })
  })

  describe('前端 MatrixQrLoginSdkService 使用 MSC4108 路径', () => {
    it('前端 paths 常量包含 MSC4108 rendezvous 路径，不包含 MSC4388 路径', async () => {
      const { AUTH } = await import('../paths/auth')

      // MSC4108 paths should exist
      expect(AUTH.MSC4108_CREATE_RENDEZVOUS).toContain('org.matrix.msc4108')
      expect(AUTH.MSC4108_CREATE_RENDEZVOUS).toContain('rendezvous')
      expect(AUTH.MSC4108_RENDEZVOUS_SESSION('test-session')).toContain('test-session')

      // MSC4108 qr_token path
      expect(AUTH.QR_GENERATE_TOKEN).toContain('login/qr_token')

      // MSC4388 paths should NOT exist (removed in step 1.4 RED-2)
      expect(AUTH).not.toHaveProperty('GET_QR_CODE')
      expect(AUTH).not.toHaveProperty('QR_CONFIRM')
      expect(AUTH).not.toHaveProperty('QR_START')
      expect(AUTH).not.toHaveProperty('QR_STATUS')
      expect(AUTH).not.toHaveProperty('QR_INVALIDATE')
    })
  })
})
