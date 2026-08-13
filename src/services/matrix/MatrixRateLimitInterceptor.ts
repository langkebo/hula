import { createLogger } from '@/utils/Logger'

const logger = createLogger('RateLimitInterceptor')

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 30000

/** 连续 429 达到该次数后打开熔断器 */
const CIRCUIT_THRESHOLD = 3
/** 熔断基础冷却时长（指数增长：5s → 10s → 20s → …） */
const CIRCUIT_BASE_COOLDOWN_MS = 5000
const CIRCUIT_MAX_COOLDOWN_MS = 120000

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

/**
 * 幂等的 POST 端点白名单：429 意味着服务端拒绝处理，重试不会产生副作用。
 * /keys/query 是 E2EE 设备列表查询（只读语义），rust-crypto 出站请求泵会持续重发，
 * 若客户端直接放行 429，SDK 重试 4 次失败后请求重新入队，下个 sync 周期再打一次，
 * 形成"每 3-6 秒一次"的 429 重试风暴。客户端在此消化退避可打断风暴。
 */
const IDEMPOTENT_POST_PATH_PATTERNS: readonly RegExp[] = [
  /\/_matrix\/client\/(v3|r0)\/keys\/query/,
  /\/_matrix\/client\/(v3|r0)\/keys\/changes/
]

function resolveUrl(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
}

/** 判断是否应对客户端应用速率限制
 */
export function shouldApplyClientRateLimit(input: RequestInfo | URL): boolean {
  const url = resolveUrl(input)
  return !SYNC_PATH_PATTERNS.some((pattern) => pattern.test(url))
}

function isRetryableOn429(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = init?.method?.toUpperCase() ?? 'GET'
  if (method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') {
    return true
  }
  const url = resolveUrl(input)
  return IDEMPOTENT_POST_PATH_PATTERNS.some((pattern) => pattern.test(url))
}

// ==================== 熔断器 ====================
// 目的：服务端持续 429（限流器故障 fail-closed / nginx 桶被打爆）时，
// 拦截器重试耗尽后 SDK 仍会按 sync 周期重发，形成无限风暴。
// 熔断器在连续 N 次 429 后开路，冷却期内直接返回合成 429（带 retry_after_ms），
// 让 SDK 的 safeGetRetryAfterMs 按我们的冷却时长退避，网络流量降为 0。

interface CircuitState {
  consecutiveFailures: number
  openUntil: number
}

const circuitByEndpoint = new Map<string, CircuitState>()

function endpointKey(input: RequestInfo | URL, init?: RequestInit): string {
  const method = init?.method?.toUpperCase() ?? 'GET'
  try {
    const pathname = new URL(resolveUrl(input)).pathname
    return `${method} ${pathname}`
  } catch {
    return `${method} ${resolveUrl(input)}`
  }
}

/** 返回剩余冷却毫秒数；未开路返回 0 */
function circuitCooldownRemainingMs(key: string, now: number): number {
  const state = circuitByEndpoint.get(key)
  if (!state || state.openUntil <= now) return 0
  return state.openUntil - now
}

function recordCircuitResult(key: string, status: number, now: number): void {
  const state = circuitByEndpoint.get(key)
  if (status !== 429) {
    if (state) circuitByEndpoint.delete(key)
    return
  }
  const consecutiveFailures = (state?.consecutiveFailures ?? 0) + 1
  if (consecutiveFailures >= CIRCUIT_THRESHOLD) {
    const exponent = consecutiveFailures - CIRCUIT_THRESHOLD
    const cooldown = Math.min(CIRCUIT_BASE_COOLDOWN_MS * 2 ** exponent, CIRCUIT_MAX_COOLDOWN_MS)
    circuitByEndpoint.set(key, { consecutiveFailures, openUntil: now + cooldown })
    logger.warn(
      `端点连续 429 x${consecutiveFailures}，熔断 ${Math.round(cooldown / 1000)}s: ${key}（请检查服务端限流配置/限流器健康）`
    )
  } else {
    circuitByEndpoint.set(key, { consecutiveFailures, openUntil: 0 })
  }
}

function createSynthetic429(retryAfterMs: number): Response {
  return new Response(
    JSON.stringify({
      errcode: 'M_LIMIT_EXCEEDED',
      error: 'Client circuit breaker open (server keeps returning 429)',
      retry_after_ms: retryAfterMs
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'retry-after': String(Math.ceil(retryAfterMs / 1000))
      }
    }
  )
}

export function createRateLimitedFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!shouldApplyClientRateLimit(input)) {
      return baseFetch(input, init)
    }

    const key = endpointKey(input, init)
    const cooldownMs = circuitCooldownRemainingMs(key, Date.now())
    if (cooldownMs > 0) {
      logger.warn(`熔断中，跳过真实请求，${Math.round(cooldownMs / 1000)}s 后恢复: ${key}`)
      return createSynthetic429(cooldownMs)
    }

    const response = await fetchWithRetry(baseFetch, input, init, 0)
    recordCircuitResult(key, response.status, Date.now())
    return response
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

  if (!isRetryableOn429(input, init)) {
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

/** 仅供测试：清空熔断器状态 */
export function __resetRateLimitCircuitForTests(): void {
  circuitByEndpoint.clear()
}
