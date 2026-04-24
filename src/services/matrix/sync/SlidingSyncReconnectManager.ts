import { createLogger } from '@/utils/Logger'

const logger = createLogger('SlidingSyncReconnect')

export interface ReconnectConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  jitter: boolean
  backoffMultiplier: number
}

const DEFAULT_CONFIG: ReconnectConfig = {
  maxRetries: 20,
  baseDelay: 1000,
  maxDelay: 30000,
  jitter: true,
  backoffMultiplier: 2
}

export type ReconnectState = 'idle' | 'reconnecting' | 'connected' | 'failed'

export interface ReconnectCallbacks {
  onStateChange?: (state: ReconnectState, retryCount: number) => void
  onReconnectAttempt?: (attempt: number, delay: number) => void
  onReconnected?: () => void
  onFailed?: (lastError?: Error) => void
}

export class SlidingSyncReconnectManager {
  private config: ReconnectConfig
  private callbacks: ReconnectCallbacks = {}
  private state: ReconnectState = 'idle'
  private retryCount = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private lastError?: Error
  private reconnectFn: (() => Promise<void>) | null = null

  constructor(config: Partial<ReconnectConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  registerCallbacks(callbacks: ReconnectCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  setReconnectFn(fn: () => Promise<void>): void {
    this.reconnectFn = fn
  }

  getState(): ReconnectState {
    return this.state
  }

  getRetryCount(): number {
    return this.retryCount
  }

  onConnected(): void {
    if (this.state === 'reconnecting') {
      logger.info('重连成功')
      this.callbacks.onReconnected?.()
    }
    this.state = 'connected'
    this.retryCount = 0
    this.clearRetryTimer()
    this.callbacks.onStateChange?.('connected', 0)
  }

  onDisconnected(err?: Error): void {
    this.lastError = err
    if (this.state === 'reconnecting') return

    logger.info(`连接断开: ${err?.message || 'unknown'}`)
    this.scheduleReconnect()
  }

  onError(err: Error): void {
    this.lastError = err
    logger.error(`同步错误: ${err.message}`)

    if (this.state !== 'reconnecting') {
      this.scheduleReconnect()
    }
  }

  forceReconnect(): void {
    this.retryCount = 0
    this.clearRetryTimer()
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.retryCount >= this.config.maxRetries) {
      this.state = 'failed'
      this.callbacks.onStateChange?.('failed', this.retryCount)
      this.callbacks.onFailed?.(this.lastError)
      logger.error(`达到最大重试次数 (${this.config.maxRetries})，停止重连`)
      return
    }

    this.state = 'reconnecting'
    const delay = this.calculateDelay()
    this.retryCount++

    this.callbacks.onStateChange?.('reconnecting', this.retryCount)
    this.callbacks.onReconnectAttempt?.(this.retryCount, delay)

    logger.info(`将在 ${delay}ms 后进行第 ${this.retryCount}/${this.config.maxRetries} 次重连`)

    this.retryTimer = setTimeout(() => {
      this.attemptReconnect()
    }, delay)
  }

  private async attemptReconnect(): Promise<void> {
    if (!this.reconnectFn) {
      logger.error('未设置重连函数')
      return
    }

    try {
      await this.reconnectFn()
    } catch (err) {
      logger.error(`重连尝试失败: ${err instanceof Error ? err.message : err}`)
      this.scheduleReconnect()
    }
  }

  private calculateDelay(): number {
    const { baseDelay, maxDelay, backoffMultiplier, jitter } = this.config
    let delay = Math.min(baseDelay * backoffMultiplier ** this.retryCount, maxDelay)

    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5)
    }

    return Math.round(delay)
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  reset(): void {
    this.clearRetryTimer()
    this.state = 'idle'
    this.retryCount = 0
    this.lastError = undefined
    this.callbacks.onStateChange?.('idle', 0)
  }

  destroy(): void {
    this.clearRetryTimer()
    this.reconnectFn = null
    this.callbacks = {}
    this.state = 'idle'
  }
}
