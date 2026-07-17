import { useI18nGlobal } from '@/services/i18n'
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

export type WorkerFactory = () => WorkerLike

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
  type: string
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
  private readyResolve: (() => void) | null = null
  private readyReject: ((err: Error) => void) | null = null
  private readonly factory: WorkerFactory
  private readonly onWorkerError = (event: Event) => {
    const message = (event as ErrorEvent)?.message || 'worker error'
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
   * 在 worker 内并行探测一组 Sliding Sync 候选端点（POST 一个空 body，
   * 看 status 是否 404）。比主线程串行 fetch 更省墙钟时间，且不阻塞主线程。
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
  async getCapabilities(baseUrl: string, accessToken: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('getCapabilities', { baseUrl, accessToken })
  }

  async resetSearchIndex(): Promise<void> {
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
      pending.reject(err)
    }
    this.pending.clear()
    this.readyReject?.(err)
    this.readyPromise = null
    this.readyResolve = null
    this.readyReject = null
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
  protected async request<T>(type: string, payload?: unknown): Promise<T> {
    const worker = this.worker
    if (!worker) {
      throw new Error(useI18nGlobal().t('matrix_error.worker.not_started'))
    }

    const id = this.generateId()
    const message: WorkerMessage = { type, id, payload }

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        type
      })
      try {
        worker.postMessage(message)
      } catch (err) {
        this.pending.delete(id)
        reject(err)
      }
    })
  }

  private handleMessage(response: WorkerResponse): void {
    if (response.type === 'ready' && response.id === 'init') {
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
export default matrixWorkerHost
