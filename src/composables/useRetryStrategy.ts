/**
 * 重试策略 Composable
 * 提供指数退避重试 + 熔断器模式，用于 API 调用和服务恢复
 *
 * 特性：
 * - 指数退避 (exponential backoff) 带随机抖动 (jitter)
 * - 熔断器 (circuit breaker) 半开状态自动恢复
 * - 可配置重试条件 (retryIf)
 * - 最大重试次数 + 超时控制
 */

import { computed, reactive, readonly, ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useRetryStrategy')

export interface RetryConfig {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  timeoutMs?: number
  jitter?: boolean
  retryIf?: (error: unknown) => boolean
}

interface CircuitBreakerState {
  failureCount: number
  lastFailureTime: number
  state: 'closed' | 'open' | 'half-open'
}

const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'retryIf'>> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  timeoutMs: 15000,
  jitter: true
}

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof TypeError && error.message.includes('fetch')) return true
  if (error instanceof Error && error.message.includes('network')) return true
  if (error instanceof Error && error.message.includes('timeout')) return true
  if (
    typeof error === 'object' &&
    error !== null &&
    'httpStatus' in error &&
    typeof (error as { httpStatus: number }).httpStatus === 'number'
  ) {
    const status = (error as { httpStatus: number }).httpStatus
    return status >= 500 || status === 429
  }
  return false
}

const getJitter = (delay: number): number => delay * (0.5 + Math.random() * 0.5)

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const timeoutPromise = (ms: number) =>
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Retry timeout after ${ms}ms`)), ms))

export function useRetryStrategy(config: RetryConfig = {}) {
  const resolvedConfig = { ...DEFAULT_CONFIG, ...config }

  const circuitBreaker = reactive<CircuitBreakerState>({
    failureCount: 0,
    lastFailureTime: 0,
    state: 'closed'
  })

  const isCircuitOpen = ref(false)
  const retryCount = ref(0)

  // 熔断器阈值：5 次连续失败后打开
  const CIRCUIT_BREAKER_THRESHOLD = 5
  // 熔断器打开后等待 30 秒进入半开状态
  const CIRCUIT_BREAKER_RESET_MS = 30000

  const resetCircuitBreaker = () => {
    circuitBreaker.failureCount = 0
    circuitBreaker.state = 'closed'
    isCircuitOpen.value = false
  }

  const recordFailure = () => {
    circuitBreaker.failureCount++
    circuitBreaker.lastFailureTime = Date.now()

    if (circuitBreaker.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
      circuitBreaker.state = 'open'
      isCircuitOpen.value = true
      logger.warn(`[RetryStrategy] 熔断器打开：连续 ${circuitBreaker.failureCount} 次失败`)
    }
  }

  const recordSuccess = () => {
    if (circuitBreaker.state === 'half-open') {
      resetCircuitBreaker()
      logger.info('[RetryStrategy] 熔断器已恢复（半开→关闭）')
    } else if (circuitBreaker.state === 'closed') {
      circuitBreaker.failureCount = 0
    }
  }

  const tryHalfOpen = (): boolean => {
    if (circuitBreaker.state !== 'open') return true

    const elapsed = Date.now() - circuitBreaker.lastFailureTime
    if (elapsed >= CIRCUIT_BREAKER_RESET_MS) {
      circuitBreaker.state = 'half-open'
      logger.info('[RetryStrategy] 熔断器进入半开状态，允许探测请求')
      return true
    }

    return false
  }

  /**
   * 使用重试策略执行异步操作
   * @param fn 要执行的异步函数
   * @returns 成功结果或抛出最后一次错误
   */
  const execute = async <T>(fn: () => Promise<T>): Promise<T> => {
    // 检查熔断器
    if (!tryHalfOpen()) {
      throw new Error('熔断器已打开，请求被拒绝')
    }

    retryCount.value = 0
    let lastError: unknown

    for (let attempt = 0; attempt < resolvedConfig.maxAttempts; attempt++) {
      try {
        retryCount.value = attempt + 1

        const result = await Promise.race([fn(), timeoutPromise(resolvedConfig.timeoutMs)])

        recordSuccess()

        if (attempt > 0) {
          logger.info(`[RetryStrategy] 第 ${attempt} 次重试成功`)
        }

        return result
      } catch (error) {
        lastError = error

        const isLastAttempt = attempt === resolvedConfig.maxAttempts - 1
        const shouldRetry = resolvedConfig.retryIf ? resolvedConfig.retryIf(error) : isRetryableError(error)

        if (isLastAttempt || !shouldRetry) {
          recordFailure()
          logger.error(`[RetryStrategy] 所有 ${resolvedConfig.maxAttempts} 次尝试均失败`, error)
          throw error
        }

        // 指数退避
        let delay = Math.min(resolvedConfig.baseDelayMs * 2 ** attempt, resolvedConfig.maxDelayMs)
        if (resolvedConfig.jitter) {
          delay = getJitter(delay)
        }

        logger.warn(
          `[RetryStrategy] 第 ${attempt + 1}/${resolvedConfig.maxAttempts} 次尝试失败，${Math.round(delay)}ms 后重试`,
          {
            error: error instanceof Error ? error.message : String(error)
          }
        )

        await sleep(delay)
      }
    }

    throw lastError
  }

  const circuitBreakerStatus = computed(() => ({
    state: circuitBreaker.state,
    failureCount: circuitBreaker.failureCount,
    isOpen: isCircuitOpen.value
  }))

  return {
    execute,
    retryCount: readonly(retryCount),
    circuitBreakerStatus,
    isCircuitOpen: readonly(isCircuitOpen),
    resetCircuitBreaker
  }
}
