import { createLogger } from '@/utils/Logger'

const logger = createLogger('OfflineQueue')

export type OperationType =
  | 'message'
  | 'receipt'
  | 'reaction'
  | 'typing'
  | 'state'
  | 'redact'
  | 'push_rule'
  | 'membership'
  | 'creation'
  | 'dm_creation'
  | 'tag'
  | 'pin'

export interface QueuedOperation {
  id: string
  type: OperationType
  roomId: string
  payload: Record<string, unknown>
  createdAt: number
  retryCount: number
  maxRetries: number
  status: 'pending' | 'processing' | 'failed'
}

const STORAGE_KEY = 'hula-offline-queue'
const MAX_RETRIES = 3

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
      try {
        await this.replayFn(op)
        succeeded++
        this.removeOperation(op.id)
      } catch (err) {
        op.retryCount++
        if (op.retryCount >= op.maxRetries) {
          op.status = 'failed'
          failed++
          logger.error(`操作 ${op.id} 达到最大重试次数，标记为失败`)
        } else {
          op.status = 'pending'
          logger.warn(`操作 ${op.id} 重放失败 (${op.retryCount}/${op.maxRetries}): ${err}`)
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
      const serializable = this.queue.filter((op) => op.status !== 'processing')
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
        this.queue = parsed.map((op) => ({
          ...op,
          status: op.status === 'processing' ? 'pending' : op.status
        }))
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
