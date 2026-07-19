/**
 * AI Connection service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Uses a REAL SDK client so URL construction and prefix handling execute
 * through real matrix-js-sdk code. Catches V1 double-prefix bugs
 * (/_matrix/client/v3/_matrix/client/v1/ai/... → 404) that vi.mock tests
 * miss because the stub authedRequest bypasses SDK URL construction.
 *
 * Covers all 6 authedRequestWithPath call sites in MatrixAIConnectionService:
 * listConnections, createConnection, getConnection, deleteConnection,
 * listMcpTools, callMcpTool.
 */
import { createClient, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixAIConnectionService } from '../MatrixAIConnectionService'

const HOMESERVER = 'https://hs.ai-contract.test'
const seenUrls: { method: string; url: string }[] = []
let realClient: MatrixClient

vi.mock('../../MatrixClientService', () => {
  const instance = {
    getClient: (): MatrixClient => realClient,
    getHomeserverUrl: () => HOMESERVER,
    waitForClientReady: () => Promise.resolve(realClient)
  }
  return { default: instance, matrixClientService: instance }
})

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

setupMswServer(
  http.get(`${HOMESERVER}/_matrix/client/v1/ai/connections`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ connections: [{ id: 'c1', name: 'Conn 1', type: 'openai', status: 'active' }] })
  }),
  http.post(`${HOMESERVER}/_matrix/client/v1/ai/connections`, async ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ id: 'new-conn-' + String(body.name).toLowerCase() })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v1/ai/connections/:id`, ({ request, params }) => {
    seenUrls.push({ method: request.method, url: request.url })
    const id = params.id as string
    return HttpResponse.json({ id, name: 'Conn ' + id, type: 'openai', status: 'active' })
  }),
  http.delete(`${HOMESERVER}/_matrix/client/v1/ai/connections/:id`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({})
  }),
  http.get(`${HOMESERVER}/_matrix/client/v1/ai/mcp/tools`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ tools: [{ name: 'search', description: 'Search the web', parameters: {} }] })
  }),
  http.post(`${HOMESERVER}/_matrix/client/v1/ai/mcp/tools/call`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ result: { ok: true } })
  })
)

describe('AI Connection service URL construction contract (real SDK + msw)', () => {
  beforeEach(() => {
    seenUrls.length = 0
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.ai-contract.test',
      deviceId: 'DEV1'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const V1_DOUBLE_PREFIX = /\/_matrix\/client\/v3\/_matrix\/client\/v1/

  it('listConnections hits GET /_matrix/client/v1/ai/connections (no V1 double-prefix)', async () => {
    const result = await matrixAIConnectionService.listConnections()

    const calls = seenUrls.filter((u) => u.url.endsWith('/ai/connections'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/ai/connections`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c1')
  })

  it('createConnection hits POST /_matrix/client/v1/ai/connections with body (no V1 double-prefix)', async () => {
    const result = await matrixAIConnectionService.createConnection({
      name: 'MyConn',
      type: 'openai',
      config: { apiKey: 'sk-xxx' }
    })

    const calls = seenUrls.filter((u) => u.method === 'POST' && u.url.endsWith('/ai/connections'))
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/ai/connections`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result).toBe('new-conn-myconn')
  })

  it('getConnection hits GET /_matrix/client/v1/ai/connections/:id (no V1 double-prefix)', async () => {
    const result = await matrixAIConnectionService.getConnection('c42')

    const calls = seenUrls.filter((u) => u.url.includes('/ai/connections/c42'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/ai/connections/c42`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.id).toBe('c42')
    expect(result.name).toBe('Conn c42')
  })

  it('deleteConnection hits DELETE /_matrix/client/v1/ai/connections/:id (no V1 double-prefix)', async () => {
    await matrixAIConnectionService.deleteConnection('c99')

    const calls = seenUrls.filter((u) => u.method === 'DELETE')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/ai/connections/c99`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
  })

  it('listMcpTools hits GET /_matrix/client/v1/ai/mcp/tools (no V1 double-prefix)', async () => {
    const result = await matrixAIConnectionService.listMcpTools()

    const calls = seenUrls.filter((u) => u.url.includes('/ai/mcp/tools') && !u.url.includes('/call'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/ai/mcp/tools`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('search')
  })

  it('callMcpTool hits POST /_matrix/client/v1/ai/mcp/tools/call with body (no V1 double-prefix)', async () => {
    const result = await matrixAIConnectionService.callMcpTool({
      tool: 'search',
      parameters: { query: 'hello' }
    })

    const calls = seenUrls.filter((u) => u.url.includes('/ai/mcp/tools/call'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/ai/mcp/tools/call`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result).toEqual({ ok: true })
  })
})
