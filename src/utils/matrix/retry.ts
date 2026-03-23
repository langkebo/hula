/**
 * Matrix SDK 请求重试工具
 */

import { MatrixError } from 'matrix-js-sdk'
import { AppError } from './errors'

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number
  /** 基础延迟 (毫秒) */
  baseDelay: number
  /** 最大延迟 (毫秒) */
  maxDelay: number
  /** 退避策略 */
  backoff: 'exponential' | 'linear' | 'constant'
  /** 可重试的状态码 */
  retryableStatusCodes: number[]
  /** 可重试的错误码 */
  retryableErrorCodes: string[]
  /** 是否应该重试函数 */
  shouldRetry?: (error: unknown, attempt: number) => boolean
}

/**
 * 默认重试配置
 */
export const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoff: 'exponential',
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrorCodes: ['M_LIMIT_EXCEEDED', 'M_RESOURCE_LIMIT_EXCEEDED', 'NETWORK_ERROR', 'TIMEOUT']
}

/**
 * 计算延迟
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  let delay: number

  switch (config.backoff) {
    case 'exponential':
      delay = config.baseDelay * 2 ** attempt
      break
    case 'linear':
      delay = config.baseDelay * attempt
      break
    default:
      delay = config.baseDelay
      break
  }

  // 添加随机抖动 (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1)
  delay = delay + jitter

  // 不超过最大延迟
  return Math.min(delay, config.maxDelay)
}

/**
 * 判断是否应该重试
 */
function shouldRetry(error: unknown, attempt: number, config: RetryConfig): boolean {
  // 超过最大重试次数
  if (attempt >= config.maxRetries) {
    return false
  }

  // 如果有自定义判断函数
  if (config.shouldRetry) {
    return config.shouldRetry(error, attempt)
  }

  // 检查 MatrixError
  if (error instanceof MatrixError) {
    // 检查状态码
    const status = (error as any).status
    if (status && config.retryableStatusCodes.includes(status)) {
      return true
    }
    // 检查错误码
    const errcode = (error as any).errcode
    if (errcode && config.retryableErrorCodes.includes(errcode)) {
      return true
    }
  }

  // 检查 AppError
  if (error instanceof AppError) {
    if (config.retryableErrorCodes.includes(error.code)) {
      return true
    }
  }

  // 检查网络错误
  if (error instanceof TypeError && error.message.includes('network')) {
    return true
  }

  return false
}

/**
 * 等待指定时间
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 带重试的异步函数包装器
 */
export function withRetry<T>(fn: () => Promise<T>, config: Partial<RetryConfig> = {}): Promise<T> {
  const finalConfig = { ...defaultRetryConfig, ...config }

  return (async function retry(attempt: number): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      if (shouldRetry(error, attempt, finalConfig)) {
        const delay = calculateDelay(attempt, finalConfig)
        console.log(`[Retry] 等待 ${Math.round(delay)}ms 后重试 (尝试 ${attempt + 1}/${finalConfig.maxRetries})`)

        await sleep(delay)
        return retry(attempt + 1)
      }

      throw error
    }
  })(0)
}

/**
 * 带重试的 Promise 包装器
 */
export class RetryablePromise<T> {
  private config: RetryConfig
  private attempt = 0
  private abortController: AbortController | null = null

  constructor(
    private fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ) {
    this.config = { ...defaultRetryConfig, ...config }
  }

  /**
   * 执行并自动重试
   */
  async execute(): Promise<T> {
    this.attempt = 0
    return this.executeWithRetry()
  }

  private async executeWithRetry(): Promise<T> {
    try {
      return await this.fn()
    } catch (error) {
      if (shouldRetry(error, this.attempt, this.config)) {
        const delay = calculateDelay(this.attempt, this.config)
        console.log(`[RetryablePromise] 等待 ${Math.round(delay)}ms 后重试`)

        this.attempt++
        await sleep(delay)
        return this.executeWithRetry()
      }

      throw error
    }
  }

  /**
   * 中止当前操作
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort()
    }
  }
}

/**
 * 创建可取消的重试请求
 */
export function createRetryableRequest<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  config?: Partial<RetryConfig>
): { execute: () => Promise<T>; abort: () => void } {
  const controller = new AbortController()

  const wrappedFn = async (): Promise<T> => {
    return fn(controller.signal)
  }

  return {
    execute: () => withRetry(wrappedFn, config),
    abort: () => controller.abort()
  }
}

/**
 * 重试装饰器
 */
export function retryable(config?: Partial<RetryConfig>) {
  return <T extends (...args: any[]) => Promise<any>>(
    _target: any,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) => {
    const originalMethod = descriptor.value!

    descriptor.value = async function (this: any, ...args: any[]) {
      const self = this
      return withRetry(() => originalMethod.apply(self, args), config)
    } as T

    return descriptor
  }
}

export default {
  defaultRetryConfig,
  withRetry,
  RetryablePromise,
  createRetryableRequest,
  retryable
}
