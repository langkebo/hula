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

export function createRateLimitedFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
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
