import { createLogger } from '@/utils/Logger'

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

const STORAGE_KEY = 'tjg-offline-queue'
const MAX_RETRIES = 3
const BASE_DELAY = 1000
const MAX_DELAY = 30000

export class OfflineQueueService {
  private queue: QueuedOperation[] = []
  private processing = false
  private onlineHandler: (() => void) | null = null
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
          const delay = Math.min(BASE_DELAY * 2 ** (attempt - 1), MAX_DELAY)
          logger.info(`操作 ${op.id} 等待 ${delay}ms 后重试 (第 ${attempt} 次)`)
          await new Promise((resolve) => setTimeout(resolve, delay))
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
        this.queue = parsed
          .map((op) => {
            // F-13 修复：脱敏的操作无法 replay（内容已丢失），标记为 failed
            // 并记录 warn；其余操作恢复原状。
            const sensitiveFields = SENSITIVE_PAYLOAD_FIELDS[op.type]
            if (sensitiveFields?.length && hasRedactedField(op.payload, sensitiveFields)) {
              logger.warn(`操作 ${op.id} (type=${op.type}) payload 已脱敏，无法 replay，标记为失败`)
              return { ...op, status: 'failed' as const }
            }
            return {
              ...op,
              status: op.status === 'processing' ? 'pending' : op.status
            }
          })
          .filter((op) => op.status !== 'failed')
        if (this.queue.length > 0) {
          logger.info(`恢复 ${this.queue.length} 个离线操作`)
        }
      }
    } catch (err) {
      logger.warn('恢复离线队列失败:', err)
      this.queue = []
    }
  }

  destroy(): void {
    this.stopNetworkListener()
    this.replayFn = null
  }
}

export const offlineQueueService = new OfflineQueueService()
