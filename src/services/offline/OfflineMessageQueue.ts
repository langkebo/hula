/**
 * 离线消息队列
 *
 * 离线时缓存消息，网络恢复后自动重发
 */

import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/utils/Logger'
import type { IMessageContent } from '@/types/message'
import type { ISendEventResponse } from 'matrix-js-sdk'
import matrixClientService from '@/services/matrix/MatrixClientService'

const logger = createLogger('OfflineMessageQueue')

export interface PendingMessage {
  id: string
  roomId: string
  content: IMessageContent
  status: 'pending' | 'sending' | 'sent' | 'failed'
  createdAt: number
  retryCount: number
  eventId?: string
  error?: string
}

export interface OfflineMessageQueueEvents {
  send_failed: (message: PendingMessage) => void
  send_success: (message: PendingMessage) => void
  queue_processed: () => void
}

class OfflineMessageQueue {
  private queue: PendingMessage[] = []
  private isProcessing = false
  private maxRetries = 3
  private retryDelay = 2000
  private eventListeners: Map<keyof OfflineMessageQueueEvents, Set<(...args: any[]) => void>> = new Map()
  private persistenceKey = 'hula_offline_queue'

  constructor() {
    this.loadQueue()
    this.setupNetworkListeners()
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      logger.info('网络恢复，开始处理离线队列')
      this.process()
    })
  }

  private async loadQueue(): Promise<void> {
    try {
      const stored = localStorage.getItem(this.persistenceKey)
      if (stored) {
        this.queue = JSON.parse(stored)
        logger.info(`加载了 ${this.queue.length} 条待发送消息`)
        // 重置状态为 pending
        this.queue.forEach((msg) => {
          if (msg.status !== 'sent') {
            msg.status = 'pending'
          }
        })
        this.persistQueue()
        // 自动开始处理
        this.process()
      }
    } catch (err) {
      logger.error('加载离线队列失败:', err)
    }
  }

  private persistQueue(): void {
    try {
      localStorage.setItem(this.persistenceKey, JSON.stringify(this.queue))
    } catch (err) {
      logger.error('保存离线队列失败:', err)
    }
  }

  async add(roomId: string, content: IMessageContent): Promise<string> {
    const pendingId = uuidv4()
    const message: PendingMessage = {
      id: pendingId,
      roomId,
      content,
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0
    }
    this.queue.push(message)
    this.persistQueue()
    logger.info(`消息已加入离线队列: ${pendingId}`)

    // 如果在线，立即处理
    if (navigator.onLine) {
      this.process()
    }

    return pendingId
  }

  async process(): Promise<void> {
    if (this.isProcessing) {
      logger.debug('队列处理中，跳过')
      return
    }

    if (!navigator.onLine) {
      logger.debug('离线状态，等待网络恢复')
      return
    }

    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('客户端未初始化，无法发送消息')
      return
    }

    this.isProcessing = true

    try {
      while (this.queue.length > 0) {
        const msg = this.queue[0]

        // 跳过已发送的消息
        if (msg.status === 'sent') {
          this.queue.shift()
          this.persistQueue()
          continue
        }

        // 检查重试次数
        if (msg.retryCount >= this.maxRetries) {
          msg.status = 'failed'
          msg.error = `超过最大重试次数 (${this.maxRetries})`
          this.emit('send_failed', msg)
          this.queue.shift()
          this.persistQueue()
          continue
        }

        // 检查是否离线
        if (!navigator.onLine) {
          logger.info('发送过程中网络断开，暂停队列')
          break
        }

        msg.status = 'sending'
        this.persistQueue()

        try {
          const response: ISendEventResponse = await client.sendEvent(msg.roomId, 'm.room.message', msg.content as any)
          msg.status = 'sent'
          msg.eventId = response.event_id
          this.emit('send_success', msg)
          this.queue.shift()
          this.persistQueue()
          logger.info(`消息发送成功: ${msg.id}`)
        } catch (err) {
          msg.retryCount++
          msg.status = 'pending'
          msg.error = err instanceof Error ? err.message : String(err)
          logger.warn(`消息发送失败 (${msg.retryCount}/${this.maxRetries}): ${msg.id}`, err)
          this.persistQueue()

          // 等待后重试
          await this.sleep(this.retryDelay)
        }
      }
    } finally {
      this.isProcessing = false
    }

    if (this.queue.length === 0) {
      this.emit('queue_processed')
      logger.info('离线队列已清空')
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  getPendingCount(): number {
    return this.queue.filter((msg) => msg.status !== 'sent').length
  }

  getFailedMessages(): PendingMessage[] {
    return this.queue.filter((msg) => msg.status === 'failed')
  }

  retryFailed(): void {
    this.queue.forEach((msg) => {
      if (msg.status === 'failed') {
        msg.status = 'pending'
        msg.retryCount = 0
      }
    })
    this.persistQueue()
    this.process()
  }

  clearFailed(): void {
    this.queue = this.queue.filter((msg) => msg.status !== 'failed')
    this.persistQueue()
  }

  clearAll(): void {
    this.queue = []
    this.persistQueue()
  }

  on<K extends keyof OfflineMessageQueueEvents>(event: K, callback: OfflineMessageQueueEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback as any)
  }

  off<K extends keyof OfflineMessageQueueEvents>(event: K, callback: OfflineMessageQueueEvents[K]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(callback as any)
    }
  }

  private emit<K extends keyof OfflineMessageQueueEvents>(
    event: K,
    ...args: Parameters<OfflineMessageQueueEvents[K]>
  ): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => (callback as any)(...args))
    }
  }
}

export const offlineMessageQueue = new OfflineMessageQueue()
export default offlineMessageQueue
