import { useI18nGlobal } from '@/services/i18n'
import type { Capabilities } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import type {
  SearchEventDoc,
  SearchIndexStats,
  SearchQueryPayload,
  SearchQueryResult,
  SearchRoomDoc,
  WorkerMessage,
  WorkerResponse
} from '@/workers/matrixWorkerTypes'

/** 字节 → base64（跨 worker 传输密钥用） */
function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const logger = createLogger('MatrixWorkerHost')

/**
 * 一个最小可用的工作线程宿主（P4 骨架）。
 *
 * 目标：把 `src/workers/matrixSdk.worker.ts` 真正实例化、并提供
 *   - `ready()` 等待 worker 内 SDK / 周期任务初始化完成，
 *   - 通用 `request(type, payload)` 做按 id 关联的请求/响应映射，
 *   - 几个最薄的转发方法（`ping`、`terminate`），方便后续把 SDK
 *     调用一段段从主线程迁移到 worker。
 *
 * 这一层故意 **不** 复刻 `MatrixClient` 的全表面 — 那是另一个独立大重构。
 * 现在的目的是为后续渐进式接入留好骨架，并保证可测。
 */

type WorkerLike = Pick<Worker, 'postMessage' | 'terminate' | 'addEventListener' | 'removeEventListener'>

type WorkerFactory = () => WorkerLike

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
  type: string
  /** 单请求超时定时器，响应/超时/销毁时统一清理（H-13）。 */
  timer: ReturnType<typeof setTimeout>
}

/** 单个 worker 请求的默认超时（ms）：worker 卡死时调用方 Promise 不会永挂。 */
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000

/** worker 首次 ready 信号的等待上限（ms）。 */
const DEFAULT_READY_TIMEOUT_MS = 30_000

/** 创建不阻止进程退出的定时器（Node 测试环境支持 unref）。 */
function createUnrefTimer(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
  const timer = setTimeout(fn, ms)
  ;(timer as { unref?: () => void }).unref?.()
  return timer
}

const defaultFactory: WorkerFactory = () =>
  new Worker(new URL('../../workers/matrixSdk.worker.ts', import.meta.url), {
    type: 'module',
    name: 'matrix-sdk-worker'
  })

export class MatrixWorkerHost {
  private worker: WorkerLike | null = null
  private readonly pending = new Map<string, PendingRequest>()
  private nextId = 1
  private readyPromise: Promise<void> | null = null
  /** 是否已收到 worker 的 ready 信号（`start()` 之后、ready 之前为 false）。 */
  private readyResolved = false
  private readyResolve: (() => void) | null = null
  private readyReject: ((err: Error) => void) | null = null
  /** ready 超时兜底定时器（H-13）：worker 加载卡死时避免 start() 永挂。 */
  private readyTimer: ReturnType<typeof setTimeout> | null = null
  /**
   * worker 是否已降级（启动失败、ready 超时或运行期崩溃）。
   * 降级后调用方应回退主线程实现，状态横幅据此提示"搜索结果可能不完整"。
   */
  private degraded = false
  private readonly factory: WorkerFactory
  private readonly onWorkerError = (event: Event) => {
    const message = (event as ErrorEvent)?.message || 'worker error'
    this.degraded = true
    this.disposeWorker(new Error(`[MatrixWorkerHost] worker failed: ${message}`))
  }
  private readonly onMessage = (event: MessageEvent<WorkerResponse>) => {
    this.handleMessage(event.data)
  }

  constructor(factory: WorkerFactory = defaultFactory) {
    this.factory = factory
  }

  /**
   * 当 `start()` 已被调用且尚未 `terminate()` 时为 true。
   * 调用方可以据此决定走 worker 还是退回主线程实现。
   */
  get isStarted(): boolean {
    return this.worker !== null
  }

  /**
   * worker 是否处于降级状态。
   * 启动失败、ready 超时或运行期崩溃后为 true，调用方应回退主线程实现。
   */
  get isDegraded(): boolean {
    return this.degraded
  }

  /**
   * 启动 worker 并等待第一条 `ready` 信号。
   * 多次调用会复用同一个 worker / Promise。
   */
  start(): Promise<void> {
    if (this.readyPromise) return this.readyPromise

    const worker = this.factory()
    worker.addEventListener('message', this.onMessage as EventListener)
    worker.addEventListener('error', this.onWorkerError)
    worker.addEventListener('messageerror', this.onWorkerError)
    this.worker = worker

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
    })
    this.readyTimer = createUnrefTimer(() => {
      this.degraded = true
      this.disposeWorker(new Error(`[MatrixWorkerHost] worker ready timeout after ${DEFAULT_READY_TIMEOUT_MS}ms`))
    }, DEFAULT_READY_TIMEOUT_MS)
    return this.readyPromise
  }

  /**
   * 在 worker 内 ping，返回携带 `timestamp` 的响应。
   * 用作冒烟测试 / 心跳。
   */
  async ping(): Promise<{ timestamp: number }> {
    return this.request<{ timestamp: number }>('ping')
  }

  /**
   * 在 worker 内查询 homeserver 支持的 Matrix 协议版本。
   * 等价于 `MatrixClient.getVersions()`，但在独立线程中发起 fetch，
   * 避免主线程在登录前/重连时被阻塞。
   */
  async getServerVersions(
    baseUrl: string,
    accessToken?: string
  ): Promise<{ versions: string[]; unstable_features?: Record<string, boolean> }> {
    return this.request<{ versions: string[]; unstable_features?: Record<string, boolean> }>('getServerVersions', {
      baseUrl,
      accessToken
    })
  }

  /**
   * 在 worker 内查询 homeserver 支持的登录流程。
   * 等价于 `MatrixClient.loginFlows()`，走独立线程，预登录场景安全。
   */
  async getLoginFlows(baseUrl: string): Promise<{ flows: Array<{ type: string; [key: string]: unknown }> }> {
    return this.request<{ flows: Array<{ type: string; [key: string]: unknown }> }>('getLoginFlows', {
      baseUrl
    })
  }

  /**
   * 在 worker 内并行探测一组 Sliding Sync 候选端点（POST 一个空 body）。
   * 只有 404/501 才算未实现；400/401/403/405/429 表示端点已路由。
   * 比主线程串行 fetch 更省墙钟时间，且不阻塞主线程。
   */
  async probeSlidingSyncEndpoints(
    baseUrl: string,
    endpoints: string[]
  ): Promise<Array<{ endpoint: string; status: number | 'error'; available: boolean; error?: string }>> {
    return this.request<Array<{ endpoint: string; status: number | 'error'; available: boolean; error?: string }>>(
      'probeSlidingSyncEndpoints',
      { baseUrl, endpoints }
    )
  }

  /**
   * 在 worker 内对 `/_matrix/client/versions` 发 OPTIONS 探测 CORS 响应头。
   * 返回三个相关头的字符串值（缺失为 null）。
   */
  async probeCors(baseUrl: string): Promise<{
    'access-control-allow-origin': string | null
    'access-control-allow-methods': string | null
    'access-control-allow-headers': string | null
  }> {
    return this.request<{
      'access-control-allow-origin': string | null
      'access-control-allow-methods': string | null
      'access-control-allow-headers': string | null
    }>('probeCors', { baseUrl })
  }

  /**
   * 在 worker 内查询 homeserver 当前会话的能力声明。
   * 等价于 `MatrixClient.getCapabilities()` /  `GET /_matrix/client/v3/capabilities`，
   * 需要 access token；可与 `getServerVersions` 并发，登录后能力探测批次中常用。
   */
  async getCapabilities(baseUrl: string, accessToken: string): Promise<Capabilities> {
    return this.request<Capabilities>('getCapabilities', { baseUrl, accessToken })
  }

  /**
   * 设置搜索索引的加密密钥（F-4 / D3）。
   *
   * `key = null` 会清空索引库（旧明文记录不能留在磁盘上）。
   */
  async setSearchIndexKey(key: Uint8Array | null): Promise<void> {
    return this.request<void>('search.setKey', { key: key ? toBase64(key) : null })
  }

  async resetSearchIndex(): Promise<void> {
    // P-12：登出与 terminate 存在竞态，worker 已不在时重置索引属于无条件成功的 no-op，
    // 不应抛出「worker 未启动」把正常的登出清理变成失败。
    if (this.skipWhenNotStarted('resetSearchIndex')) return
    return this.request<void>('search.reset')
  }

  async bootstrapSearchRooms(rooms: SearchRoomDoc[]): Promise<void> {
    return this.request<void>('search.bootstrapRooms', { rooms })
  }

  async upsertSearchRooms(rooms: SearchRoomDoc[]): Promise<void> {
    return this.request<void>('search.upsertRooms', { rooms })
  }

  async bootstrapSearchEvents(events: SearchEventDoc[]): Promise<void> {
    return this.request<void>('search.bootstrapEvents', { events })
  }

  async upsertSearchEvents(events: SearchEventDoc[]): Promise<void> {
    // P-12：flush 可能在登出 terminate 之后才落地，此时索引已随 worker 消失，
    // 静默跳过而不是抛错（真正的写入错误仍由 request 正常抛出）。
    if (this.skipWhenNotStarted('upsertSearchEvents')) return
    return this.request<void>('search.upsertEvents', { events })
  }

  async redactSearchEvent(eventId: string): Promise<void> {
    return this.request<void>('search.redactEvent', { eventId })
  }

  async removeSearchRoom(roomId: string): Promise<void> {
    return this.request<void>('search.removeRoom', { roomId })
  }

  async querySearchIndex(payload: SearchQueryPayload): Promise<SearchQueryResult> {
    return this.request<SearchQueryResult>('search.query', payload)
  }

  async getSearchIndexStats(): Promise<SearchIndexStats> {
    return this.request<SearchIndexStats>('search.stats')
  }

  /**
   * 清理 worker 残留（remove listeners + terminate + reject pending + reject ready）。
   */
  private disposeWorker(err: Error): void {
    if (this.worker) {
      this.worker.removeEventListener('message', this.onMessage as EventListener)
      this.worker.removeEventListener('error', this.onWorkerError)
      this.worker.removeEventListener('messageerror', this.onWorkerError)
      this.worker.terminate()
      this.worker = null
    }
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(err)
    }
    this.pending.clear()
    if (this.readyTimer) {
      clearTimeout(this.readyTimer)
      this.readyTimer = null
    }
    this.readyReject?.(err)
    this.readyPromise = null
    this.readyResolve = null
    this.readyReject = null
    this.readyResolved = false
  }

  /**
   * worker 未启动时返回 true 并记 debug 日志，供可安全跳过的索引写入调用方使用。
   * 只在 worker 不存在时生效；请求过程中的真实异常照常向上抛。
   */
  private skipWhenNotStarted(action: string): boolean {
    if (this.isStarted) return false
    logger.debug(`worker 未启动，跳过 ${action}`)
    return true
  }

  /**
   * 终止 worker、reject 所有未决请求、清理状态。
   */
  terminate(reason: string = 'host terminated'): void {
    if (!this.worker) return
    this.disposeWorker(new Error(reason))
  }

  /**
   * 通用消息转发。给 `type` 生成自增 id，登记 pending，把消息 postMessage
   * 进 worker，等同 id 的响应回来再 resolve / reject。
   */
  protected async request<T>(type: string, payload?: unknown, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<T> {
    const worker = this.worker
    if (!worker) {
      throw new Error(useI18nGlobal().t('matrix_error.worker.not_started'))
    }

    // worker 已创建但模块尚未求值完成时先等 ready：否则 postMessage 虽会排队，
    // 但模块求值慢于请求超时时，调用方会先收到 15s 超时误判成写入失败。
    if (!this.readyResolved && this.readyPromise) {
      await this.readyPromise
    }
    if (this.worker !== worker) {
      throw new Error(useI18nGlobal().t('matrix_error.worker.not_started'))
    }

    const id = this.generateId()
    const message: WorkerMessage = { type, id, payload }

    return new Promise<T>((resolve, reject) => {
      // 超时兜底：worker 卡死（未回消息）时拒绝请求并清理 pending，
      // 避免调用方的 Promise 永挂与 Map 条目泄漏（H-13）。
      const timer = createUnrefTimer(() => {
        if (!this.pending.delete(id)) return
        reject(new Error(`worker request '${type}' timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        type,
        timer
      })
      try {
        worker.postMessage(message)
      } catch (err) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(err)
      }
    })
  }

  private handleMessage(response: WorkerResponse): void {
    if (response.type === 'ready' && response.id === 'init') {
      if (this.readyTimer) {
        clearTimeout(this.readyTimer)
        this.readyTimer = null
      }
      // 重新启动成功后清除降级标记，横幅随之撤回。
      this.degraded = false
      this.readyResolved = true
      this.readyResolve?.()
      this.readyResolve = null
      this.readyReject = null
      return
    }

    const pending = this.pending.get(response.id)
    if (!pending) {
      logger.warn(`收到未登记的 worker 响应: ${response.type}#${response.id}`)
      return
    }
    clearTimeout(pending.timer)
    this.pending.delete(response.id)

    if (response.success) {
      pending.resolve(response.data)
    } else {
      pending.reject(new Error(response.error || `worker request '${pending.type}' failed`))
    }
  }

  private generateId(): string {
    return `${this.nextId++}`
  }
}

export const matrixWorkerHost = new MatrixWorkerHost()
