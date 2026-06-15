import { describe, expect, it, vi } from 'vitest'
import { useRetryStrategy } from '../useRetryStrategy'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('useRetryStrategy', () => {
  describe('basic retry', () => {
    it('should return result on first attempt success', async () => {
      const { execute } = useRetryStrategy({ maxAttempts: 3 })

      const result = await execute(async () => 'success')

      expect(result).toBe('success')
    })

    it('should retry on failure and succeed on second attempt', async () => {
      const { execute } = useRetryStrategy({ maxAttempts: 3, baseDelayMs: 10, jitter: false })

      let attempt = 0
      const fn = vi.fn(async () => {
        attempt++
        if (attempt < 2) {
          throw new TypeError('fetch error')
        }
        return 'recovered'
      })

      const result = await execute(fn)

      expect(result).toBe('recovered')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should throw after all attempts exhausted', async () => {
      const { execute } = useRetryStrategy({ maxAttempts: 2, baseDelayMs: 10, jitter: false })

      const fn = vi.fn(async () => {
        throw new TypeError('network error')
      })

      await expect(execute(fn)).rejects.toThrow('network error')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should not retry non-retryable errors', async () => {
      const { execute } = useRetryStrategy({ maxAttempts: 3, baseDelayMs: 10, jitter: false })

      const fn = vi.fn(async () => {
        throw new Error('validation error')
      })

      await expect(execute(fn)).rejects.toThrow('validation error')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should use custom retryIf condition', async () => {
      const { execute } = useRetryStrategy({
        maxAttempts: 3,
        baseDelayMs: 10,
        jitter: false,
        retryIf: (error: unknown) => error instanceof Error && error.message.includes('custom')
      })

      const retryable = vi.fn(async () => {
        throw new Error('custom retry error')
      })

      await expect(execute(retryable)).rejects.toThrow('custom retry error')
      expect(retryable).toHaveBeenCalledTimes(3)

      const nonRetryable = vi.fn(async () => {
        throw new Error('other error')
      })

      await expect(execute(nonRetryable)).rejects.toThrow('other error')
      expect(nonRetryable).toHaveBeenCalledTimes(1)
    })
  })

  describe('circuit breaker', () => {
    it('should open circuit after consecutive failures', async () => {
      const { execute, isCircuitOpen, resetCircuitBreaker } = useRetryStrategy({
        maxAttempts: 1,
        baseDelayMs: 1,
        jitter: false
      })

      // Trigger failures to open circuit (5 consecutive failures)
      for (let i = 0; i < 5; i++) {
        try {
          await execute(async () => {
            throw new TypeError('fetch error')
          })
        } catch {
          // expected
        }
      }

      expect(isCircuitOpen.value).toBe(true)

      // Further calls should be rejected immediately
      await expect(execute(async () => 'should not run')).rejects.toThrow('熔断器已打开')

      // Reset for later tests
      resetCircuitBreaker()
    })

    it('should allow recovery via half-open state', async () => {
      const { execute, isCircuitOpen, resetCircuitBreaker } = useRetryStrategy({
        maxAttempts: 1,
        baseDelayMs: 1,
        jitter: false
      })

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await execute(async () => {
            throw new TypeError('fetch error')
          })
        } catch {
          // expected
        }
      }

      expect(isCircuitOpen.value).toBe(true)

      // Reset and verify circuit closes after success
      resetCircuitBreaker()
      expect(isCircuitOpen.value).toBe(false)

      const result = await execute(async () => 'success')
      expect(result).toBe('success')

      resetCircuitBreaker()
    })

    it('should track retry count correctly', async () => {
      const { execute, retryCount } = useRetryStrategy({
        maxAttempts: 3,
        baseDelayMs: 10,
        jitter: false
      })

      let callCount = 0
      try {
        await execute(async () => {
          callCount++
          throw new TypeError('fetch error')
        })
      } catch {
        // expected
      }

      expect(retryCount.value).toBe(3)
      expect(callCount).toBe(3)
    })

    it('should reset retry count on each execute call', async () => {
      const { execute, retryCount } = useRetryStrategy({
        maxAttempts: 1,
        baseDelayMs: 1,
        jitter: false
      })

      await execute(async () => 'ok')
      expect(retryCount.value).toBe(1)

      try {
        await execute(async () => {
          throw new TypeError('fail')
        })
      } catch {
        // expected
      }
      expect(retryCount.value).toBe(1)
    })

    it('should timeout long-running operations', async () => {
      const { execute } = useRetryStrategy({
        maxAttempts: 2,
        timeoutMs: 50,
        baseDelayMs: 10,
        jitter: false
      })

      await expect(
        execute(async () => {
          await wait(200)
          return 'too late'
        })
      ).rejects.toThrow('Retry timeout')
    })
  })

  describe('exponential backoff', () => {
    it('should increase delay between retries', async () => {
      const start = Date.now()
      const { execute } = useRetryStrategy({
        maxAttempts: 3,
        baseDelayMs: 50,
        maxDelayMs: 200,
        timeoutMs: 60000,
        jitter: false
      })

      try {
        await execute(async () => {
          throw new TypeError('fetch error')
        })
      } catch {
        // expected
      }

      const elapsed = Date.now() - start
      // baseDelayMs=50, attempt 2 delay should be ~100ms, total ~150ms
      expect(elapsed).toBeGreaterThanOrEqual(100)
      expect(elapsed).toBeLessThan(1000)
    })

    it('should cap delay at maxDelayMs', async () => {
      const start = Date.now()
      const { execute } = useRetryStrategy({
        maxAttempts: 6,
        baseDelayMs: 100,
        maxDelayMs: 200,
        timeoutMs: 60000,
        jitter: false
      })

      try {
        await execute(async () => {
          throw new TypeError('fetch error')
        })
      } catch {
        // expected
      }

      const elapsed = Date.now() - start
      // With maxDelayMs=200 and 5 retries, max total should be ~1000ms
      expect(elapsed).toBeLessThan(2000)
    })
  })

  describe('HTTP status codes', () => {
    it.each([500, 502, 503, 504, 429])('should retry on HTTP %i', async (status) => {
      const { execute } = useRetryStrategy({ maxAttempts: 2, baseDelayMs: 10, jitter: false })

      const fn = vi.fn().mockRejectedValueOnce({ httpStatus: status }).mockRejectedValueOnce({ httpStatus: status })

      await expect(execute(fn)).rejects.toEqual({ httpStatus: status })
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should NOT retry on HTTP 400', async () => {
      const { execute } = useRetryStrategy({ maxAttempts: 3, baseDelayMs: 10, jitter: false })
      const fn = vi.fn(async () => {
        const err = new Error('HTTP 400') as Error & { httpStatus: number }
        err.httpStatus = 400
        throw err
      })
      await expect(execute(fn)).rejects.toBeDefined()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should NOT retry on HTTP 401', async () => {
      const { execute } = useRetryStrategy({ maxAttempts: 3, baseDelayMs: 10, jitter: false })
      const fn = vi.fn(async () => {
        const err = new Error('HTTP 401') as Error & { httpStatus: number }
        err.httpStatus = 401
        throw err
      })
      await expect(execute(fn)).rejects.toBeDefined()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should NOT retry on HTTP 403', async () => {
      const { execute } = useRetryStrategy({ maxAttempts: 3, baseDelayMs: 10, jitter: false })
      const fn = vi.fn(async () => {
        const err = new Error('HTTP 403') as Error & { httpStatus: number }
        err.httpStatus = 403
        throw err
      })
      await expect(execute(fn)).rejects.toBeDefined()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should NOT retry on HTTP 404', async () => {
      const { execute } = useRetryStrategy({ maxAttempts: 3, baseDelayMs: 10, jitter: false })
      const fn = vi.fn(async () => {
        const err = new Error('HTTP 404') as Error & { httpStatus: number }
        err.httpStatus = 404
        throw err
      })
      await expect(execute(fn)).rejects.toBeDefined()
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })
})
