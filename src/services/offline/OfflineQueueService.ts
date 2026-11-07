import { computeBackoffDelay, sleep } from '@/utils/backoff'
import { createLogger } from '@/utils/Logger'
import { OFFLINE_QUEUE_STORAGE_KEY } from '@/utils/storageKeys'

const logger = createLogger('OfflineQueue')

type OperationType =
  | 'message'
  | 'receipt'
  | 'reaction'
  | 'reaction_remove'
  | 'typing'
  | 'state'
  | 'redact'
  | 'push_rule'
  | 'membership'
  | 'creation'
  | 'dm_creation'
  | 'tag'
  | 'pin'
  | 'friend_accept'
  | 'friend_reject'
  | 'friend_cancel'
  | 'burn_enable'
  | 'burn_disable'
  | 'widget_create'
  | 'widget_delete'

interface QueuedOperation {
  id: string
  type: OperationType
  roomId: string
  payload: Record<string, unknown>
  createdAt: number
  retryCount: number
  maxRetries: number
  status: 'pending' | 'processing' | 'failed'
  /**
   * payload 已因持久化脱敏而丢失内容，进程重启后无法再 replay。
   * 这类 failed 操作保留在队列里只为让 UI 提示「需要重新输入」，`retryFailed()` 会跳过它们。
   */
  payloadRedacted?: boolean
}

/**
 * F-13 修复：哪些 payload 字段在 persistence 时需要脱敏（不能明文落盘 localStorage）
 * key 为 OperationType，value 为需要从 payload 中剥离的字段名列表。
 * 被脱敏的字段在 restoreQueue() 时会标记为已失效（无法 replay），
 * 因此离线消息在 App 重启后不会丢失队列结构，但内容必须用户重新输入。
 *
 * 注意：真实调用方的消息内容**嵌套**在 payload 内层，例如
 * `{ roomId, eventType, content: { body } }` 与 `{ tempMsgId, payload: { body } }`，
 * 因此脱敏必须按字段名递归进行，只匹配顶层字段会完全失效。
 */
const SENSITIVE_PAYLOAD_FIELDS: Readonly<Partial<Record<OperationType, string[]>>> = {
  message: ['text', 'body']
}

/** 脱敏占位符 */
const REDACTED = '[redacted]'

/**
 * 递归按字段名脱敏。
 *
 * @param value 任意 payload 片段
 * @param sensitiveFields 当前 operation 需要脱敏的字段名
 */
function redactDeep(value: unknown, sensitiveFields: readonly string[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, sensitiveFields))
  }
  if (typeof value !== 'object' || value === null) {
    return value
  }

  const result: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    result[key] = sensitiveFields.includes(key) ? REDACTED : redactDeep(child, sensitiveFields)
  }
  return result
}

/**
 * 判断 payload 中是否已存在脱敏标记（任意层级）。
 *
 * 与 redactDeep 使用同一套字段名，保证"写了脱敏"与"识别脱敏"口径一致——
 * 否则嵌套脱敏后的操作会在 restore 时被误判为可 replay。
 */
function hasRedactedField(value: unknown, sensitiveFields: readonly string[]): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasRedactedField(item, sensitiveFields))
  }
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
    sensitiveFields.includes(key) ? child === REDACTED : hasRedactedField(child, sensitiveFields)
  )
}

const STORAGE_KEY = OFFLINE_QUEUE_STORAGE_KEY
const MAX_RETRIES = 3
const BASE_DELAY = 1000
const MAX_DELAY = 30000
/**
 * 队列容量上限（H-8）：长离线或对端长期不可用时队列会无界增长，
 * 既撑爆 localStorage 又让重放循环越拖越久。超出后按「最旧优先」淘汰。
 */
const MAX_QUEUE_SIZE = 200

/**
 * 连接状态来源（`MatrixClientService` 事件订阅能力的最小子集）。
 *
 * 只依赖 `on/off/getConnectionState`，不 import matrix 服务，
 * 避免离线队列反向耦合传输层。
 */
export interface ConnectionStateSource {
  on(event: 'connectionState', handler: (data: unknown) => void): void
  off(event: 'connectionState', handler: (data: unknown) => void): void
  getConnectionState?(): string
}

/** 可以立刻投递写操作的连接状态（`CATCHUP` 仅补齐历史，发送不受阻）。 */
const READY_STATES: ReadonlySet<string> = new Set(['CONNECTED', 'CATCHUP'])

export class OfflineQueueService {
  private queue: QueuedOperation[] = []
  private processing = false
  private onlineHandler: (() => void) | null = null
  private connectionHandler: ((data: unknown) => void) | null = null
  private connectionSource: ConnectionStateSource | null = null
  private replayFn: ((op: QueuedOperation) => Promise<void>) | null = null

  constructor() {
    this.restoreQueue()
  }

  setReplayFn(fn: (op: QueuedOperation) => Promise<void>): void {
    this.replayFn = fn
  }

  enqueue(type: OperationType, roomId: string, payload: Record<string, unknown>): string {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const op: QueuedOperation = {
      id,
      type,
      roomId,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: MAX_RETRIES,
      status: 'pending'
    }
    this.queue.push(op)
    this.enforceCapacity()
    this.persistQueue()
    logger.info(`操作入队: ${type} for ${roomId} (id: ${id})`)
    return id
  }

  getQueue(): readonly QueuedOperation[] {
    return this.queue
  }

  getPendingCount(): number {
    return this.queue.filter((op) => op.status === 'pending').length
  }

  /** 失败操作数（含重启后因脱敏而不可重试的记录） */
  getFailedCount(): number {
    return this.queue.filter((op) => op.status === 'failed').length
  }

  /**
   * 手动重发失败操作：failed → pending 并重置重试计数，交由 `replayAll()` 重新投递。
   *
   * 因持久化脱敏而丢失内容（`payloadRedacted`）的操作会被跳过——重放它们只会把
   * `[redacted]` 当成正文发出去。
   *
   * @returns 被重置为 pending 的操作数
   */
  retryFailed(): number {
    let reset = 0
    for (const op of this.queue) {
      if (op.status !== 'failed' || op.payloadRedacted) continue
      op.status = 'pending'
      op.retryCount = 0
      reset++
    }
    if (reset > 0) {
      this.persistQueue()
      logger.info(`重置 ${reset} 个失败操作为待重放`)
    }
    return reset
  }

  /**
   * 容量控制（H-8）：超出上限时淘汰最旧的 pending，其次淘汰最旧的 failed。
   * processing 中的操作正在投递，不参与淘汰。
   */
  private enforceCapacity(): void {
    if (this.queue.length <= MAX_QUEUE_SIZE) return

    const overflow = this.queue.length - MAX_QUEUE_SIZE
    const victims = new Set<string>()
    for (const status of ['pending', 'failed'] as const) {
      for (const op of this.queue) {
        if (victims.size >= overflow) break
        if (op.status === status) victims.add(op.id)
      }
      if (victims.size >= overflow) break
    }
    if (victims.size === 0) return

    this.queue = this.queue.filter((op) => !victims.has(op.id))
    logger.warn(`离线队列超过上限 ${MAX_QUEUE_SIZE}，淘汰 ${victims.size} 个最旧操作`)
  }

  async replayAll(): Promise<{ succeeded: number; failed: number }> {
    if (this.processing || !this.replayFn) {
      return { succeeded: 0, failed: 0 }
    }

    this.processing = true
    let succeeded = 0
    let failed = 0

    const pending = this.queue.filter((op) => op.status === 'pending')
    logger.info(`开始重放 ${pending.length} 个离线操作`)

    for (const op of pending) {
      op.status = 'processing'
      let success = false

      for (let attempt = 0; attempt < op.maxRetries && !success; attempt++) {
        if (attempt > 0) {
          const delay = computeBackoffDelay({ baseDelayMs: BASE_DELAY, maxDelayMs: MAX_DELAY, attempt: attempt - 1 })
          logger.info(`操作 ${op.id} 等待 ${delay}ms 后重试 (第 ${attempt} 次)`)
          await sleep(delay)
        }

        try {
          await this.replayFn(op)
          succeeded++
          this.removeOperation(op.id)
          success = true
        } catch (err) {
          op.retryCount = attempt + 1
          if (op.retryCount >= op.maxRetries) {
            op.status = 'failed'
            failed++
            logger.error(`操作 ${op.id} 达到最大重试次数，标记为失败`)
          } else {
            logger.warn(`操作 ${op.id} 重放失败 (${op.retryCount}/${op.maxRetries}): ${err}`)
          }
        }
      }
    }

    this.persistQueue()
    this.processing = false
    logger.info(`重放完成: 成功 ${succeeded}, 失败 ${failed}`)
    return { succeeded, failed }
  }

  removeOperation(id: string): void {
    this.queue = this.queue.filter((op) => op.id !== id)
    this.persistQueue()
  }

  clearFailed(): void {
    this.queue = this.queue.filter((op) => op.status !== 'failed')
    this.persistQueue()
  }

  clearAll(): void {
    this.queue = []
    this.persistQueue()
  }

  startNetworkListener(): void {
    if (this.onlineHandler) return

    this.onlineHandler = () => {
      logger.info('网络恢复，开始重放离线操作队列')
      this.replayAll()
    }
    window.addEventListener('online', this.onlineHandler)
  }

  stopNetworkListener(): void {
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler)
      this.onlineHandler = null
    }
  }

  /**
   * 连接就绪即重放队列。
   *
   * `window 'online'` 只覆盖「物理断网恢复」，覆盖不到同步层状态迁移
   * （CONNECTING / RECONNECTING / CATCHUP → CONNECTED）——而后者正是
   * 「网络在线但传输未就绪」时消息被入队的场景。只监听 online 会让这些
   * 消息永久停在 pending（气泡一直 SENDING，服务端 0 事件）。
   */
  startConnectionListener(source: ConnectionStateSource): void {
    if (this.connectionHandler) return

    this.connectionHandler = (data) => {
      const state = (data as { state?: string } | null)?.state
      if (!state || !READY_STATES.has(state)) return
      logger.info(`连接就绪 (${state})，开始重放离线操作队列`)
      void this.replayAll()
    }
    this.connectionSource = source
    source.on('connectionState', this.connectionHandler)

    // 启动时连接可能已经就绪，不会再产生一次状态迁移事件
    const current = source.getConnectionState?.()
    if (current && READY_STATES.has(current)) {
      logger.info(`启动时连接已就绪 (${current})，开始重放离线操作队列`)
      void this.replayAll()
    }
  }

  /**
   * 解除连接状态订阅（登出 / destroy 时调用）。
   *
   * 必须与 {@link startConnectionListener} 成对清理，否则重连后会残留旧闭包，
   * 同一个状态迁移触发多次重放。
   */
  stopConnectionListener(): void {
    if (this.connectionHandler && this.connectionSource) {
      this.connectionSource.off('connectionState', this.connectionHandler)
    }
    this.connectionHandler = null
    this.connectionSource = null
  }

  private persistQueue(): void {
    try {
      const serializable = this.queue
        .filter((op) => op.status !== 'processing')
        .map((op) => {
          // F-13 修复：对 message 类型操作递归脱敏（真实内容嵌套在内层），
          // 再写入 localStorage，防止明文消息体落盘。
          const sensitiveFields = SENSITIVE_PAYLOAD_FIELDS[op.type]
          if (sensitiveFields && sensitiveFields.length > 0) {
            return {
              ...op,
              payload: redactDeep(op.payload, sensitiveFields) as Record<string, unknown>
            }
          }
          return op
        })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
    } catch (err) {
      logger.warn('持久化离线队列失败:', err)
    }
  }

  private restoreQueue(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as QueuedOperation[]
        // H-8：failed 不再丢弃——静默消失会让用户误以为消息已发出。
        // 保留在队列里，由 UI 通过 getFailedCount()/retryFailed()/clearFailed() 处理。
        // 因脱敏而无法 replay 的记录额外打上 payloadRedacted，避免重发时把占位符当正文。
        this.queue = parsed.map((op) => {
          const sensitiveFields = SENSITIVE_PAYLOAD_FIELDS[op.type]
          if (sensitiveFields?.length && hasRedactedField(op.payload, sensitiveFields)) {
            logger.warn(`操作 ${op.id} (type=${op.type}) payload 已脱敏，无法 replay，标记为失败`)
            return { ...op, status: 'failed' as const, payloadRedacted: true }
          }
          return {
            ...op,
            status: op.status === 'processing' ? 'pending' : op.status
          }
        })
        this.enforceCapacity()
        if (this.queue.length > 0) {
          logger.info(`恢复 ${this.queue.length} 个离线操作（失败 ${this.getFailedCount()} 个）`)
        }
      }
    } catch (err) {
      logger.warn('恢复离线队列失败:', err)
      this.queue = []
    }
  }

  destroy(): void {
    this.stopNetworkListener()
    this.stopConnectionListener()
    this.replayFn = null
  }
}

export const offlineQueueService = new OfflineQueueService()
