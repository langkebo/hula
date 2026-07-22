import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { HttpClient, HttpClientError } from '@/utils/HttpClient'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

describe('HttpClient', () => {
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
})
