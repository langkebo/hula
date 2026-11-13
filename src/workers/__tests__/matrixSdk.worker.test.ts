import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `matrixSdk.worker.ts` 分发契约（S6）。
 *
 * 主线程 `MatrixWorkerHost` 按 `{ type, id }` 匹配 pending Promise；只要 worker
 * 在任一分支「不回包」，调用方的请求就会挂到超时为止。因此这里逐条钉住：
 *   - ready 广播、正常回包；
 *   - 信封/payload 非法、未知类型、handler 抛错，都必须回一条带 id 的失败响应；
 *   - 搜索引擎初始化失败不得产生未处理的 Promise rejection。
 */

const probeMocks = vi.hoisted(() => ({
  handleGetServerVersions: vi.fn(),
  handleGetLoginFlows: vi.fn(),
  handleProbeCors: vi.fn(),
  handleProbeSlidingSyncEndpoints: vi.fn(),
  handleGetCapabilities: vi.fn()
}))

const searchMocks = vi.hoisted(() => ({
  initSearchEngine: vi.fn(),
  handleSearchReset: vi.fn(),
  handleSearchSetKey: vi.fn(),
  handleSearchBootstrapRooms: vi.fn(),
  handleSearchUpsertRooms: vi.fn(),
  handleSearchBootstrapEvents: vi.fn(),
  handleSearchUpsertEvents: vi.fn(),
  handleSearchRedactEvent: vi.fn(),
  handleSearchRemoveRoom: vi.fn(),
  handleSearchQuery: vi.fn(),
  handleSearchStats: vi.fn()
}))

vi.mock('../workerProbeHandlers', () => probeMocks)
vi.mock('../workerSearchHandlers', () => searchMocks)

interface FakeWorkerScope {
  postMessage: ReturnType<typeof vi.fn>
  onmessage: ((event: MessageEvent<unknown>) => Promise<void>) | null
}

const createFakeScope = (): FakeWorkerScope => ({ postMessage: vi.fn(), onmessage: null })

/** worker 模块在 import 期即注册 onmessage 并广播 ready，故必须先 stub self 再动态载入。 */
async function loadWorker(): Promise<FakeWorkerScope> {
  const scope = createFakeScope()
  vi.stubGlobal('self', scope)
  await import('../matrixSdk.worker')
  return scope
}

async function dispatch(scope: FakeWorkerScope, data: unknown): Promise<void> {
  expect(scope.onmessage).not.toBeNull()
  await scope.onmessage?.({ data } as MessageEvent<unknown>)
}

const lastResponse = (scope: FakeWorkerScope) => scope.postMessage.mock.calls.at(-1)?.[0]

describe('matrixSdk.worker 消息分发', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
    searchMocks.initSearchEngine.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('载入后广播 ready，主线程 start() 才能解除等待', async () => {
    const scope = await loadWorker()

    expect(scope.postMessage).toHaveBeenCalledWith({ type: 'ready', id: 'init', success: true })
  })

  it('ping 回 success:true 且 data.timestamp 为数字', async () => {
    const scope = await loadWorker()

    await dispatch(scope, { type: 'ping', id: 'req-1' })

    const response = lastResponse(scope) as { type: string; id: string; success: boolean; data: unknown }
    expect(response.type).toBe('ping')
    expect(response.id).toBe('req-1')
    expect(response.success).toBe(true)
    expect(typeof (response.data as { timestamp: unknown }).timestamp).toBe('number')
  })

  it('信封非法时仍回失败响应（type/id 尽力提取），避免主线程 pending 悬挂', async () => {
    const scope = await loadWorker()

    await dispatch(scope, null)

    expect(lastResponse(scope)).toEqual({
      type: '',
      id: '',
      success: false,
      data: undefined,
      error: 'Invalid worker message: worker message must be an object'
    })
  })

  it('id 缺失时回包保留 type，error 指明 id 不合法', async () => {
    const scope = await loadWorker()

    await dispatch(scope, { type: 'ping' })

    const response = lastResponse(scope) as { type: string; id: string; success: boolean; error: string }
    expect(response.type).toBe('ping')
    expect(response.id).toBe('')
    expect(response.success).toBe(false)
    expect(response.error).toContain('worker message "id" must be a non-empty string')
  })

  it('payload 非法时回包保留 type/id，并指出具体字段', async () => {
    const scope = await loadWorker()

    await dispatch(scope, { type: 'getLoginFlows', id: 'req-2', payload: { baseUrl: '' } })
    await dispatch(scope, { type: 'search.query', id: 'req-3', payload: { term: 'x', scope: 'files' } })

    expect(lastResponse(scope)).toEqual({
      type: 'search.query',
      id: 'req-3',
      success: false,
      data: undefined,
      error: `Invalid worker message: invalid payload for "search.query": scope must be 'messages' or 'rooms'`
    })
    expect(probeMocks.handleGetLoginFlows).not.toHaveBeenCalled()
    expect(searchMocks.handleSearchQuery).not.toHaveBeenCalled()
  })

  it('未知消息类型回 Unknown message type 而不是静默丢弃', async () => {
    const scope = await loadWorker()

    await dispatch(scope, { type: 'not.a.real.type', id: 'req-4' })

    expect(lastResponse(scope)).toEqual({
      type: 'not.a.real.type',
      id: 'req-4',
      success: false,
      data: undefined,
      error: 'Unknown message type: not.a.real.type'
    })
  })

  it('handler 抛 Error 时回其 message', async () => {
    probeMocks.handleGetLoginFlows.mockRejectedValue(new Error('login flows HTTP 502'))
    const scope = await loadWorker()

    await dispatch(scope, { type: 'getLoginFlows', id: 'req-5', payload: { baseUrl: 'https://matrix.test' } })

    expect(lastResponse(scope)).toEqual({
      type: 'getLoginFlows',
      id: 'req-5',
      success: false,
      data: undefined,
      error: 'login flows HTTP 502'
    })
  })

  it('handler 抛出非 Error 时回 Unknown error，仍带原 id', async () => {
    searchMocks.handleSearchStats.mockRejectedValue('plain string failure')
    const scope = await loadWorker()

    await dispatch(scope, { type: 'search.stats', id: 'req-6' })

    expect(lastResponse(scope)).toEqual({
      type: 'search.stats',
      id: 'req-6',
      success: false,
      data: undefined,
      error: 'Unknown error'
    })
  })

  it('handler 成功时原样回传 data，payload 透传给 handler', async () => {
    probeMocks.handleGetCapabilities.mockResolvedValue({ capabilities: { 'm.change_password': { enabled: true } } })
    const scope = await loadWorker()

    await dispatch(scope, {
      type: 'getCapabilities',
      id: 'req-7',
      payload: { baseUrl: 'https://m', accessToken: 'tok' }
    })

    expect(probeMocks.handleGetCapabilities).toHaveBeenCalledWith({ baseUrl: 'https://m', accessToken: 'tok' })
    expect(lastResponse(scope)).toEqual({
      type: 'getCapabilities',
      id: 'req-7',
      success: true,
      data: { capabilities: { 'm.change_password': { enabled: true } } },
      error: undefined
    })
  })

  it('搜索引擎初始化失败只记录日志，不产生未处理的 rejection', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const initError = new Error('IndexedDB unavailable')
    searchMocks.initSearchEngine.mockRejectedValue(initError)

    const scope = await loadWorker()
    await Promise.resolve()
    await Promise.resolve()

    expect(consoleError).toHaveBeenCalledWith('[matrixSdk.worker] 搜索引擎初始化失败:', initError)
    // worker 仍然就绪，主线程不会因索引初始化失败而卡住
    expect(scope.postMessage).toHaveBeenCalledWith({ type: 'ready', id: 'init', success: true })
  })

  it('搜索类消息等索引载入完成后再执行，避免启动瞬间查到空索引（G4）', async () => {
    let resolveInit: () => void = () => {}
    searchMocks.initSearchEngine.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveInit = resolve
      })
    )
    searchMocks.handleSearchQuery.mockResolvedValue({ results: [] })

    const scope = await loadWorker()
    const pending = dispatch(scope, {
      type: 'search.query',
      id: 'req-g4',
      payload: { term: '历史', scope: 'messages' }
    })

    await Promise.resolve()
    expect(searchMocks.handleSearchQuery).not.toHaveBeenCalled()

    resolveInit()
    await pending

    expect(searchMocks.handleSearchQuery).toHaveBeenCalledTimes(1)
    expect(lastResponse(scope)).toMatchObject({ type: 'search.query', id: 'req-g4', success: true })
  })

  it('索引载入卡住时最多等待 3s 后照常执行，不让搜索请求永久挂起（G4 兜底）', async () => {
    searchMocks.initSearchEngine.mockReturnValue(new Promise<void>(() => {}))
    searchMocks.handleSearchStats.mockResolvedValue({ rooms: 0 })

    const scope = await loadWorker()
    vi.useFakeTimers()

    const pending = dispatch(scope, { type: 'search.stats', id: 'req-g4b' })
    await vi.advanceTimersByTimeAsync(3000)
    await pending

    expect(searchMocks.handleSearchStats).toHaveBeenCalledTimes(1)
    expect(lastResponse(scope)).toMatchObject({ type: 'search.stats', id: 'req-g4b', success: true })
  })
})
