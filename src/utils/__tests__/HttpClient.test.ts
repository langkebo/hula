import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpClient, HttpClientBlockedError, HttpClientError } from '@/utils/HttpClient'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

describe('HttpClient', () => {
  // 传输层用例以生产语义（fail-closed enforce）运行，故显式放行测试域名；
  // host allowlist 套件在各自用例内覆盖这些 env。
  beforeEach(() => {
    vi.stubEnv('VITE_HTTP_ALLOWLIST_MODE', 'enforce')
    vi.stubEnv('VITE_HTTP_ALLOWLIST_DEV', 'https://example.test')
    vi.stubEnv('VITE_HTTP_ALLOWLIST_PROD', 'https://example.test')
    vi.stubEnv('VITE_HOMESERVER_URL', '')
  })
  afterEach(() => vi.unstubAllEnvs())

  describe('get', () => {
    it('returns parsed JSON for a 200 response', async () => {
      server.use(http.get('https://example.test/api/data', () => HttpResponse.json({ ok: true })))
      const data = await HttpClient.get<{ ok: boolean }>('https://example.test/api/data')
      expect(data.ok).toBe(true)
    })

    it('throws HttpClientError on non-2xx with status and body', async () => {
      server.use(http.get('https://example.test/api/fail', () => HttpResponse.json({ err: 'gone' }, { status: 410 })))
      await expect(HttpClient.get('https://example.test/api/fail')).rejects.toThrow(HttpClientError)
      try {
        await HttpClient.get('https://example.test/api/fail')
      } catch (e) {
        const err = e as HttpClientError
        expect(err.status).toBe(410)
        expect(err.body).toContain('gone')
      }
    })

    it('applies timeout and throws a timeout error', async () => {
      server.use(
        http.get('https://example.test/api/slow', async () => {
          await new Promise((r) => setTimeout(r, 100))
          return HttpResponse.json({})
        })
      )
      await expect(HttpClient.get('https://example.test/api/slow', { timeoutMs: 10 })).rejects.toThrow(/timeout/i)
    })
  })

  describe('post', () => {
    it('sends JSON body and returns parsed response', async () => {
      server.use(
        http.post('https://example.test/api/submit', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({ echoed: body })
        })
      )
      const data = await HttpClient.post<{ echoed: unknown }>('https://example.test/api/submit', { name: 'test' })
      expect(data.echoed).toEqual({ name: 'test' })
    })
  })

  describe('head', () => {
    it('returns Response object for HEAD request', async () => {
      server.use(
        http.head(
          'https://example.test/file.bin',
          () => new HttpResponse(null, { headers: { 'Content-Length': '42' } })
        )
      )
      const resp = await HttpClient.head('https://example.test/file.bin')
      expect(resp.headers.get('Content-Length')).toBe('42')
    })
  })

  describe('downloadBytes', () => {
    it('returns ArrayBuffer for successful download', async () => {
      const payload = new Uint8Array([0x00, 0x01, 0x02])
      server.use(http.get('https://example.test/file.bin', () => HttpResponse.arrayBuffer(payload.buffer)))
      const result = await HttpClient.downloadBytes('https://example.test/file.bin')
      expect(new Uint8Array(result)).toEqual(payload)
    })
  })

  describe('host allowlist', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    })

    it('rejects and sends no request when the host is not allowlisted (enforce)', async () => {
      vi.stubEnv('VITE_HTTP_ALLOWLIST_MODE', 'enforce')
      vi.stubEnv('VITE_HTTP_ALLOWLIST_DEV', 'https://allowed.test')
      vi.stubEnv('VITE_HTTP_ALLOWLIST_PROD', 'https://allowed.test')
      vi.stubEnv('VITE_HOMESERVER_URL', '')
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await expect(HttpClient.get('https://blocked.test/api')).rejects.toThrow(HttpClientBlockedError)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('allows the request when the host is allowlisted (enforce)', async () => {
      vi.stubEnv('VITE_HTTP_ALLOWLIST_MODE', 'enforce')
      vi.stubEnv('VITE_HTTP_ALLOWLIST_DEV', 'https://example.test')
      vi.stubEnv('VITE_HTTP_ALLOWLIST_PROD', 'https://example.test')
      vi.stubEnv('VITE_HOMESERVER_URL', '')
      server.use(http.get('https://example.test/api/ok', () => HttpResponse.json({ ok: true })))

      const data = await HttpClient.get<{ ok: boolean }>('https://example.test/api/ok')
      expect(data.ok).toBe(true)
    })

    it('rejects and sends no request for an unknown host by default (fail-closed enforce)', async () => {
      vi.stubEnv('VITE_HTTP_ALLOWLIST_MODE', '')
      vi.stubEnv('VITE_HTTP_ALLOWLIST_DEV', 'https://allowed.test')
      vi.stubEnv('VITE_HTTP_ALLOWLIST_PROD', 'https://allowed.test')
      vi.stubEnv('VITE_HOMESERVER_URL', '')
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await expect(HttpClient.get('https://unknown.test/api')).rejects.toThrow(HttpClientBlockedError)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('observes but does not block an unknown host when mode is report', async () => {
      vi.stubEnv('VITE_HTTP_ALLOWLIST_MODE', 'report')
      vi.stubEnv('VITE_HTTP_ALLOWLIST_DEV', 'https://allowed.test')
      vi.stubEnv('VITE_HTTP_ALLOWLIST_PROD', 'https://allowed.test')
      vi.stubEnv('VITE_HOMESERVER_URL', '')
      server.use(http.get('https://unknown.test/api', () => HttpResponse.json({ ok: true })))

      const data = await HttpClient.get<{ ok: boolean }>('https://unknown.test/api')
      expect(data.ok).toBe(true)
    })

    it('allows a non-allowlisted host when the dynamic exemption is set (enforce)', async () => {
      vi.stubEnv('VITE_HTTP_ALLOWLIST_MODE', 'enforce')
      vi.stubEnv('VITE_HTTP_ALLOWLIST_DEV', 'https://allowed.test')
      vi.stubEnv('VITE_HTTP_ALLOWLIST_PROD', 'https://allowed.test')
      vi.stubEnv('VITE_HOMESERVER_URL', '')
      server.use(http.get('https://user-model.example.com/api', () => HttpResponse.json({ ok: true })))

      const data = await HttpClient.get<{ ok: boolean }>('https://user-model.example.com/api', {
        allowDynamicHost: true
      })
      expect(data.ok).toBe(true)
    })

    it('still blocks a non-allowlisted host without the dynamic exemption (enforce)', async () => {
      vi.stubEnv('VITE_HTTP_ALLOWLIST_MODE', 'enforce')
      vi.stubEnv('VITE_HTTP_ALLOWLIST_DEV', 'https://allowed.test')
      vi.stubEnv('VITE_HTTP_ALLOWLIST_PROD', 'https://allowed.test')
      vi.stubEnv('VITE_HOMESERVER_URL', '')
      server.use(http.get('https://user-model.example.com/api', () => HttpResponse.json({ ok: true })))

      await expect(HttpClient.get('https://user-model.example.com/api')).rejects.toThrow(HttpClientBlockedError)
    })
  })
})
