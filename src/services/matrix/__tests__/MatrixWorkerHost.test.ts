import { beforeEach, describe, expect, it, vi } from 'vitest'

// 顶层 hoisted mock:所有测试共用同一个 fetch mock
const mockFetch = vi.hoisted(() =>
  vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
)

vi.mock('@/services/matrix/network/runtimeFetch', () => ({
  getRuntimeAwareFetch: () => mockFetch
}))

// 必须在 mock 之后 dynamic import,确保 mock 生效
const { MatrixWorkerHost } = await import('../MatrixWorkerHost')

interface FakeMessage {
  type: string
  id: string
  payload?: unknown
}

class FakeWorker {
  postedMessages: FakeMessage[] = []
  terminated = false
  private listeners = new Map<string, Set<EventListener>>()

  postMessage = vi.fn((msg: FakeMessage) => {
    this.postedMessages.push(msg)
  })

  terminate = vi.fn(() => {
    this.terminated = true
  })

  addEventListener = vi.fn((event: string, cb: EventListener) => {
    const set = this.listeners.get(event) ?? new Set()
    set.add(cb)
    this.listeners.set(event, set)
  })

  removeEventListener = vi.fn((event: string, cb: EventListener) => {
    this.listeners.get(event)?.delete(cb)
  })

  emit(data: unknown) {
    const evt = { data } as unknown as MessageEvent
    for (const cb of this.listeners.get('message') ?? []) cb(evt)
  }

  onerror: ((event: Event) => void) | null = null

  emitError(message = 'worker boom') {
    const evt = { message } as unknown as Event
    this.onerror?.(evt)
    for (const cb of this.listeners.get('error') ?? []) cb(evt)
  }
}

const makeHost = () => {
  const worker = new FakeWorker()
  const host = new MatrixWorkerHost(() => worker)
  return { host, worker }
}

const makeReadyHost = () => {
  const { host, worker } = makeHost()
  host.start()
  worker.emit({ type: 'ready', id: 'init', success: true })
  return { host, worker }
}

describe('MatrixWorkerHost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
  })

  it('start() registers a message listener and returns a pending Promise until ready arrives', async () => {
    const { host, worker } = makeHost()
    const ready = host.start()

    expect(worker.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))

    let resolved = false
    void ready.then(() => {
      resolved = true
    })
    await Promise.resolve()
    expect(resolved).toBe(false)

    worker.emit({ type: 'ready', id: 'init', success: true })
    await ready
    expect(resolved).toBe(true)
  })

  it('start() is idempotent — repeat calls return the same Promise without spawning new workers', async () => {
    const factory = vi.fn(() => new FakeWorker())
    const host = new MatrixWorkerHost(factory)
    const a = host.start()
    const b = host.start()
    expect(a).toBe(b)
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('ping() postMessages a ping and resolves when response with matching id arrives', async () => {
    const { host, worker } = makeReadyHost()

    const promise = host.ping()
    expect(worker.postedMessages).toHaveLength(1)
    const sent = worker.postedMessages[0]
    expect(sent.type).toBe('ping')
    expect(typeof sent.id).toBe('string')

    worker.emit({ type: 'ping', id: sent.id, success: true, data: { timestamp: 12345 } })
    await expect(promise).resolves.toEqual({ timestamp: 12345 })
  })

  it('rejects the pending promise when the worker reports success: false', async () => {
    const { host, worker } = makeReadyHost()

    const promise = host.ping()
    const sent = worker.postedMessages[0]
    worker.emit({ type: 'ping', id: sent.id, success: false, error: 'boom' })
    await expect(promise).rejects.toThrow('boom')
  })

  it('throws when ping() is called before start()', async () => {
    const { host } = makeHost()
    await expect(host.ping()).rejects.toThrow(/worker 未启动/)
  })

  it('ignores responses with unknown ids without throwing', async () => {
    const { worker } = makeReadyHost()
    expect(() => worker.emit({ type: 'ping', id: 'never-registered', success: true })).not.toThrow()
  })

  it('terminate() removes the listener, terminates the worker, and rejects pending requests', async () => {
    const { host, worker } = makeReadyHost()

    const pending = host.ping().catch((err) => err)
    host.terminate('shutdown')

    expect(worker.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function))
    expect(worker.terminate).toHaveBeenCalled()

    const err = await pending
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('shutdown')
  })

  it('terminate() is a no-op when nothing is started', () => {
    const factory = vi.fn(() => new FakeWorker())
    const host = new MatrixWorkerHost(factory)
    expect(() => host.terminate()).not.toThrow()
    expect(factory).not.toHaveBeenCalled()
  })

  it('after terminate(), start() can spawn a fresh worker', () => {
    const factory = vi.fn(() => new FakeWorker())
    const host = new MatrixWorkerHost(factory)
    host.start().catch(() => {})
    host.terminate()
    host.start()
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('isStarted reflects start()/terminate() lifecycle', () => {
    const { host } = makeHost()
    expect(host.isStarted).toBe(false)
    host.start().catch(() => {})
    expect(host.isStarted).toBe(true)
    host.terminate()
    expect(host.isStarted).toBe(false)
  })

  // === 探测函数:已迁移到主线程,直接用 getRuntimeAwareFetch() ===

  it('getServerVersions() calls fetch on main thread and resolves with parsed response', async () => {
    const { host } = makeReadyHost()

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ versions: ['v1.6', 'v1.7'], unstable_features: { 'org.matrix.msc3886.sliding_sync': true } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const result = await host.getServerVersions('https://matrix.test', 'tok-abc')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://matrix.test/_matrix/client/versions',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: 'Bearer tok-abc'
        })
      })
    )
    expect(result).toEqual({
      versions: ['v1.6', 'v1.7'],
      unstable_features: { 'org.matrix.msc3886.sliding_sync': true }
    })
  })

  it('getServerVersions() rejects when fetch returns non-ok status', async () => {
    const { host } = makeReadyHost()
    mockFetch.mockResolvedValueOnce(new Response('', { status: 502 }))
    await expect(host.getServerVersions('https://matrix.test')).rejects.toThrow('getVersions HTTP 502')
  })

  it('getLoginFlows() calls fetch on main thread and resolves with parsed flows', async () => {
    const { host } = makeReadyHost()

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ flows: [{ type: 'm.login.password' }, { type: 'm.login.sso' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    const result = await host.getLoginFlows('https://matrix.test')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://matrix.test/_matrix/client/v3/login',
      expect.objectContaining({ method: 'GET' })
    )
    expect(result).toEqual({ flows: [{ type: 'm.login.password' }, { type: 'm.login.sso' }] })
  })

  it('probeSlidingSyncEndpoints() calls fetch for each endpoint and resolves with the probe array', async () => {
    const { host } = makeReadyHost()

    // 第一个端点返回 400,第二个返回 404
    mockFetch
      .mockResolvedValueOnce(new Response('', { status: 400 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }))

    const endpoints = ['/_matrix/client/v1/sync', '/_matrix/client/unstable/org.matrix.msc3575/sync']
    const result = await host.probeSlidingSyncEndpoints('https://matrix.test', endpoints)

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result).toEqual([
      { endpoint: endpoints[0], status: 400, available: true },
      { endpoint: endpoints[1], status: 404, available: false }
    ])
  })

  it('probeCors() calls fetch with OPTIONS and resolves with the three CORS headers', async () => {
    const { host } = makeReadyHost()

    mockFetch.mockResolvedValueOnce(
      new Response('', {
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'Authorization, Content-Type'
        }
      })
    )

    const result = await host.probeCors('https://matrix.test')

    expect(mockFetch).toHaveBeenCalledWith('https://matrix.test/_matrix/client/versions', {
      method: 'OPTIONS'
    })
    expect(result).toEqual({
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'Authorization, Content-Type'
    })
  })

  it('getCapabilities() calls fetch on main thread and resolves with the capabilities map', async () => {
    const { host } = makeReadyHost()

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          capabilities: {
            'm.change_password': { enabled: true },
            'm.room_versions': { default: '10', available: { '10': 'stable' } }
          }
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    )

    const result = await host.getCapabilities('https://matrix.test', 'tok-abc')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://matrix.test/_matrix/client/v3/capabilities',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok-abc'
        })
      })
    )
    expect(result).toEqual({
      capabilities: {
        'm.change_password': { enabled: true },
        'm.room_versions': { default: '10', available: { '10': 'stable' } }
      }
    })
  })

  it('querySearchIndex() forwards the search payload and resolves with worker hits', async () => {
    const { host, worker } = makeReadyHost()

    const payload = {
      term: 'hello',
      scope: 'messages' as const,
      roomId: '!room:example.com',
      limit: 10,
      offset: 0
    }
    const promise = host.querySearchIndex(payload)
    const sent = worker.postedMessages[0]
    expect(sent.type).toBe('search.query')
    expect(sent.payload).toEqual(payload)

    const result = {
      messages: [
        {
          eventId: '$event_1',
          roomId: '!room:example.com',
          sender: '@user:example.com',
          timestamp: 1234567890,
          preview: 'hello world',
          score: 120
        }
      ]
    }
    worker.emit({ type: 'search.query', id: sent.id, success: true, data: result })
    await expect(promise).resolves.toEqual(result)
  })

  // === Worker 错误处理 ===

  it('worker error 使 start() reject 且 pending 请求全部失败', async () => {
    const worker = new FakeWorker()
    const host = new MatrixWorkerHost(() => worker as unknown as Worker)

    const ready = host.start()
    const readyOutcome = ready.catch((e: Error) => e)
    const pingOutcome = host.ping().catch((e: Error) => e)

    worker.emitError('load failed')

    expect((await readyOutcome) instanceof Error).toBe(true)
    expect((await pingOutcome) instanceof Error).toBe(true)
    expect(host.isStarted).toBe(false)
    expect(worker.terminated).toBe(true)
  })

  it('error 后可重新 start()', async () => {
    let current = new FakeWorker()
    const host = new MatrixWorkerHost(() => current as unknown as Worker)

    const first = host.start().catch(() => 'failed')
    current.emitError()
    expect(await first).toBe('failed')

    current = new FakeWorker()
    const second = host.start()
    current.emit({ type: 'ready', id: 'init', success: true })
    await expect(second).resolves.toBeUndefined()
  })

  it('terminate 时未就绪的 start() 也被 reject', async () => {
    const worker = new FakeWorker()
    const host = new MatrixWorkerHost(() => worker as unknown as Worker)

    const ready = host.start().catch((e: Error) => e)
    host.terminate('bye')

    expect((await ready) instanceof Error).toBe(true)
  })
})
