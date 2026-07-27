import { createLogger } from '@/utils/Logger'

const logger = createLogger('RateLimitInterceptor')

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 30000

interface RateLimitResponse {
  retry_after_ms?: number
  errcode?: string
  error?: string
}

function calculateDelay(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs && retryAfterMs > 0) {
    return Math.min(retryAfterMs, MAX_DELAY_MS)
  }
  const delay = BASE_DELAY_MS * 2 ** attempt
  const jitter = delay * 0.1 * Math.random()
  return Math.min(delay + jitter, MAX_DELAY_MS)
}

/**
 * Sync 路径后端已有 token bucket 限流（sync.rs: rate_limit_token_bucket_take），
 * 且 SDK SlidingSync 自带 429 退避（safeGetRetryAfterMs + 指数退避）。
 * 客户端拦截器对 /sync 重试会导致双重限流，因此对这些路径直接放行。
 */
const SYNC_PATH_PATTERNS: readonly RegExp[] = [
  /\/_matrix\/client\/unstable\/org\.matrix\.simplified_msc3575\/sync/,
  /\/_matrix\/client\/r0\/sync/,
  /\/_matrix\/client\/v3\/sync/
]

export function shouldApplyClientRateLimit(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  return !SYNC_PATH_PATTERNS.some((pattern) => pattern.test(url))
}

export function createRateLimitedFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!shouldApplyClientRateLimit(input)) {
      return baseFetch(input, init)
    }
    return fetchWithRetry(baseFetch, input, init, 0)
  }
}

async function fetchWithRetry(
  baseFetch: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  retryCount: number
): Promise<Response> {
  const response = await baseFetch(input, init)

  if (response.status !== 429 || retryCount >= MAX_RETRIES) {
    return response
  }

  const method = init?.method?.toUpperCase() ?? 'GET'
  if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
    return response
  }

  let retryAfterMs: number | undefined
  try {
    const cloned = response.clone()
    const body: RateLimitResponse = await cloned.json()
    retryAfterMs = body.retry_after_ms
  } catch {
    // ignore parse errors
  }

  const delay = calculateDelay(retryCount, retryAfterMs)
  logger.warn(`Rate limited (429), retrying in ${Math.round(delay)}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)

  await new Promise((resolve) => setTimeout(resolve, delay))
  return fetchWithRetry(baseFetch, input, init, retryCount + 1)
}
