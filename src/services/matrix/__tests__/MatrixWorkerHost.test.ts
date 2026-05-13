import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatrixWorkerHost } from '../MatrixWorkerHost'

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
}

const makeHost = () => {
  const worker = new FakeWorker()
  const host = new MatrixWorkerHost(() => worker)
  return { host, worker }
}

describe('MatrixWorkerHost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    const { host, worker } = makeHost()
    const ready = host.start()
    worker.emit({ type: 'ready', id: 'init', success: true })
    await ready

    const promise = host.ping()
    expect(worker.postedMessages).toHaveLength(1)
    const sent = worker.postedMessages[0]
    expect(sent.type).toBe('ping')
    expect(typeof sent.id).toBe('string')

    worker.emit({ type: 'ping', id: sent.id, success: true, data: { timestamp: 12345 } })
    await expect(promise).resolves.toEqual({ timestamp: 12345 })
  })

  it('rejects the pending promise when the worker reports success: false', async () => {
    const { host, worker } = makeHost()
    host.start()
    worker.emit({ type: 'ready', id: 'init', success: true })

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
    const { host, worker } = makeHost()
    host.start()
    worker.emit({ type: 'ready', id: 'init', success: true })

    expect(() => worker.emit({ type: 'ping', id: 'never-registered', success: true })).not.toThrow()
  })

  it('terminate() removes the listener, terminates the worker, and rejects pending requests', async () => {
    const { host, worker } = makeHost()
    host.start()
    worker.emit({ type: 'ready', id: 'init', success: true })

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
    host.start()
    host.terminate()
    host.start()
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('isStarted reflects start()/terminate() lifecycle', () => {
    const { host } = makeHost()
    expect(host.isStarted).toBe(false)
    host.start()
    expect(host.isStarted).toBe(true)
    host.terminate()
    expect(host.isStarted).toBe(false)
  })

  it('getServerVersions() forwards baseUrl/accessToken and resolves with the parsed response', async () => {
    const { host, worker } = makeHost()
    host.start()
    worker.emit({ type: 'ready', id: 'init', success: true })

    const promise = host.getServerVersions('https://matrix.test', 'tok-abc')
    expect(worker.postedMessages).toHaveLength(1)
    const sent = worker.postedMessages[0]
    expect(sent.type).toBe('getServerVersions')
    expect(sent.payload).toEqual({ baseUrl: 'https://matrix.test', accessToken: 'tok-abc' })

    worker.emit({
      type: 'getServerVersions',
      id: sent.id,
      success: true,
      data: { versions: ['v1.6', 'v1.7'], unstable_features: { 'org.matrix.msc3575': true } }
    })
    await expect(promise).resolves.toEqual({
      versions: ['v1.6', 'v1.7'],
      unstable_features: { 'org.matrix.msc3575': true }
    })
  })

  it('getServerVersions() rejects when the worker reports failure', async () => {
    const { host, worker } = makeHost()
    host.start()
    worker.emit({ type: 'ready', id: 'init', success: true })

    const promise = host.getServerVersions('https://matrix.test')
    const sent = worker.postedMessages[0]
    worker.emit({ type: 'getServerVersions', id: sent.id, success: false, error: 'getVersions HTTP 502' })
    await expect(promise).rejects.toThrow('getVersions HTTP 502')
  })

  it('getLoginFlows() forwards baseUrl and resolves with parsed flows', async () => {
    const { host, worker } = makeHost()
    host.start()
    worker.emit({ type: 'ready', id: 'init', success: true })

    const promise = host.getLoginFlows('https://matrix.test')
    const sent = worker.postedMessages[0]
    expect(sent.type).toBe('getLoginFlows')
    expect(sent.payload).toEqual({ baseUrl: 'https://matrix.test' })

    worker.emit({
      type: 'getLoginFlows',
      id: sent.id,
      success: true,
      data: { flows: [{ type: 'm.login.password' }, { type: 'm.login.sso' }] }
    })
    await expect(promise).resolves.toEqual({
      flows: [{ type: 'm.login.password' }, { type: 'm.login.sso' }]
    })
  })

  it('probeSlidingSyncEndpoints() forwards baseUrl + endpoints and resolves with the probe array', async () => {
    const { host, worker } = makeHost()
    host.start()
    worker.emit({ type: 'ready', id: 'init', success: true })

    const endpoints = ['/_matrix/client/v3/sync', '/_matrix/client/unstable/org.matrix.msc3575/sync']
    const promise = host.probeSlidingSyncEndpoints('https://matrix.test', endpoints)
    const sent = worker.postedMessages[0]
    expect(sent.type).toBe('probeSlidingSyncEndpoints')
    expect(sent.payload).toEqual({ baseUrl: 'https://matrix.test', endpoints })

    const probes = [
      { endpoint: endpoints[0], status: 400, available: true },
      { endpoint: endpoints[1], status: 404, available: false }
    ]
    worker.emit({ type: 'probeSlidingSyncEndpoints', id: sent.id, success: true, data: probes })
    await expect(promise).resolves.toEqual(probes)
  })

  it('probeCors() forwards baseUrl and resolves with the three CORS headers', async () => {
    const { host, worker } = makeHost()
    host.start()
    worker.emit({ type: 'ready', id: 'init', success: true })

    const promise = host.probeCors('https://matrix.test')
    const sent = worker.postedMessages[0]
    expect(sent.type).toBe('probeCors')
    expect(sent.payload).toEqual({ baseUrl: 'https://matrix.test' })

    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'Authorization, Content-Type'
    }
    worker.emit({ type: 'probeCors', id: sent.id, success: true, data: headers })
    await expect(promise).resolves.toEqual(headers)
  })

  it('getCapabilities() forwards baseUrl + accessToken and resolves with the capabilities map', async () => {
    const { host, worker } = makeHost()
    host.start()
    worker.emit({ type: 'ready', id: 'init', success: true })

    const promise = host.getCapabilities('https://matrix.test', 'tok-abc')
    const sent = worker.postedMessages[0]
    expect(sent.type).toBe('getCapabilities')
    expect(sent.payload).toEqual({ baseUrl: 'https://matrix.test', accessToken: 'tok-abc' })

    const caps = {
      capabilities: {
        'm.change_password': { enabled: true },
        'm.room_versions': { default: '10', available: { '10': 'stable' } }
      }
    }
    worker.emit({ type: 'getCapabilities', id: sent.id, success: true, data: caps })
    await expect(promise).resolves.toEqual(caps)
  })

  it('querySearchIndex() forwards the search payload and resolves with worker hits', async () => {
    const { host, worker } = makeHost()
    host.start()
    worker.emit({ type: 'ready', id: 'init', success: true })

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
})
