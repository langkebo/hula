import { beforeEach, describe, expect, it, vi } from 'vitest'

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000
const NON_IDEMPOTENT_METHODS = ['POST', 'DELETE']

interface RateLimitResponse {
  status: number
  json: () => Promise<{ retry_after_ms?: number }>
  headers: { get: (name: string) => string | null }
}

interface RateLimitOptions {
  method?: string
  maxRetries?: number
  baseDelayMs?: number
}

async function executeWithRateLimitRetry(
  requestFn: () => Promise<RateLimitResponse>,
  options: RateLimitOptions = {}
): Promise<RateLimitResponse> {
  const { method = 'GET', maxRetries = MAX_RETRIES, baseDelayMs = BASE_DELAY_MS } = options

  let lastResponse: RateLimitResponse | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await requestFn()

    if (response.status !== 429) {
      return response
    }

    if (NON_IDEMPOTENT_METHODS.includes(method.toUpperCase())) {
      return response
    }

    if (attempt >= maxRetries) {
      return response
    }

    let retryAfterMs = baseDelayMs * 2 ** attempt

    try {
      const body = await response.json()
      if (body?.retry_after_ms && typeof body.retry_after_ms === 'number' && body.retry_after_ms > 0) {
        retryAfterMs = body.retry_after_ms
      }
    } catch {
      // Invalid JSON in 429 response body - fall back to exponential backoff
    }

    await new Promise((resolve) => setTimeout(resolve, retryAfterMs))
    lastResponse = response
  }

  return lastResponse!
}

describe('MatrixRateLimitInterceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return response immediately for non-429 status', async () => {
    const response: RateLimitResponse = {
      status: 200,
      json: vi.fn().mockResolvedValue({}),
      headers: { get: vi.fn().mockReturnValue(null) }
    }
    const requestFn = vi.fn().mockResolvedValue(response)

    const result = await executeWithRateLimitRetry(requestFn)

    expect(result.status).toBe(200)
    expect(requestFn).toHaveBeenCalledTimes(1)
  })

  it('should retry on 429 with exponential backoff', async () => {
    const successResponse: RateLimitResponse = {
      status: 200,
      json: vi.fn().mockResolvedValue({}),
      headers: { get: vi.fn().mockReturnValue(null) }
    }
    const rateLimitResponse: RateLimitResponse = {
      status: 429,
      json: vi.fn().mockResolvedValue({}),
      headers: { get: vi.fn().mockReturnValue(null) }
    }

    const requestFn = vi.fn().mockResolvedValueOnce(rateLimitResponse).mockResolvedValueOnce(successResponse)

    const pending = executeWithRateLimitRetry(requestFn, { baseDelayMs: 1000 })

    // Advance past the first backoff delay (1000ms)
    await vi.advanceTimersByTimeAsync(1000)

    const result = await pending
    expect(result.status).toBe(200)
    expect(requestFn).toHaveBeenCalledTimes(2)
  })

  it('should respect retry_after_ms from response body', async () => {
    const successResponse: RateLimitResponse = {
      status: 200,
      json: vi.fn().mockResolvedValue({}),
      headers: { get: vi.fn().mockReturnValue(null) }
    }
    const rateLimitResponse: RateLimitResponse = {
      status: 429,
      json: vi.fn().mockResolvedValue({ retry_after_ms: 5000 }),
      headers: { get: vi.fn().mockReturnValue(null) }
    }

    const requestFn = vi.fn().mockResolvedValueOnce(rateLimitResponse).mockResolvedValueOnce(successResponse)

    const pending = executeWithRateLimitRetry(requestFn, { baseDelayMs: 1000 })

    // The retry_after_ms value (5000ms) should be used instead of exponential backoff
    await vi.advanceTimersByTimeAsync(5000)

    const result = await pending
    expect(result.status).toBe(200)
    expect(requestFn).toHaveBeenCalledTimes(2)
  })

  it('should not retry for non-idempotent methods (POST)', async () => {
    const rateLimitResponse: RateLimitResponse = {
      status: 429,
      json: vi.fn().mockResolvedValue({ retry_after_ms: 1000 }),
      headers: { get: vi.fn().mockReturnValue(null) }
    }

    const requestFn = vi.fn().mockResolvedValue(rateLimitResponse)

    const result = await executeWithRateLimitRetry(requestFn, { method: 'POST' })

    expect(result.status).toBe(429)
    expect(requestFn).toHaveBeenCalledTimes(1)
  })

  it('should not retry for non-idempotent methods (DELETE)', async () => {
    const rateLimitResponse: RateLimitResponse = {
      status: 429,
      json: vi.fn().mockResolvedValue({ retry_after_ms: 1000 }),
      headers: { get: vi.fn().mockReturnValue(null) }
    }

    const requestFn = vi.fn().mockResolvedValue(rateLimitResponse)

    const result = await executeWithRateLimitRetry(requestFn, { method: 'DELETE' })

    expect(result.status).toBe(429)
    expect(requestFn).toHaveBeenCalledTimes(1)
  })

  it('should give up after MAX_RETRIES attempts', async () => {
    const rateLimitResponse: RateLimitResponse = {
      status: 429,
      json: vi.fn().mockResolvedValue({}),
      headers: { get: vi.fn().mockReturnValue(null) }
    }

    const requestFn = vi.fn().mockResolvedValue(rateLimitResponse)

    const pending = executeWithRateLimitRetry(requestFn, { maxRetries: 3, baseDelayMs: 100 })

    // Advance through all backoff delays
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(100 * 2 ** i)
    }

    const result = await pending
    expect(result.status).toBe(429)
    // Initial call + 3 retries = 4 total calls
    expect(requestFn).toHaveBeenCalledTimes(4)
  })

  it('should handle invalid JSON in 429 response body', async () => {
    const successResponse: RateLimitResponse = {
      status: 200,
      json: vi.fn().mockResolvedValue({}),
      headers: { get: vi.fn().mockReturnValue(null) }
    }
    const rateLimitResponse: RateLimitResponse = {
      status: 429,
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      headers: { get: vi.fn().mockReturnValue(null) }
    }

    const requestFn = vi.fn().mockResolvedValueOnce(rateLimitResponse).mockResolvedValueOnce(successResponse)

    const pending = executeWithRateLimitRetry(requestFn, { baseDelayMs: 1000 })

    // Should fall back to exponential backoff (1000ms for first attempt)
    await vi.advanceTimersByTimeAsync(1000)

    const result = await pending
    expect(result.status).toBe(200)
    expect(requestFn).toHaveBeenCalledTimes(2)
  })
})
