import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { setupMswServer } from '~/tests/msw'

const server = setupMswServer(
  http.get('https://hs.example.com/_matrix/client/versions', ({ request }) => {
    return HttpResponse.json({ versions: ['v1.11'], requestedUrl: request.url })
  })
)

describe('msw vitest integration', () => {
  it('intercepts fetch at the HTTP boundary and exposes the real URL', async () => {
    const res = await fetch('https://hs.example.com/_matrix/client/versions')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.versions).toEqual(['v1.11'])
    expect(body.requestedUrl).toBe('https://hs.example.com/_matrix/client/versions')
  })

  it('supports per-test handler overrides via resetHandlers lifecycle', async () => {
    server.use(
      http.get('https://hs.example.com/_matrix/client/versions', () => {
        return HttpResponse.json({}, { status: 401 })
      })
    )

    const res = await fetch('https://hs.example.com/_matrix/client/versions')
    expect(res.status).toBe(401)
  })
})
