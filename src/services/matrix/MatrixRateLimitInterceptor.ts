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

/** 全局熔断：滑动窗口内 429 总数达到该次数后开路（感知 nginx 跨端点全局限流风暴） */
const GLOBAL_CIRCUIT_THRESHOLD = 6
/** 全局熔断滑动窗口（ms） */
const GLOBAL_CIRCUIT_WINDOW_MS = 10_000
/** 全局熔断基础冷却时长（指数增长：10s → 20s → 40s → …） */
const GLOBAL_CIRCUIT_BASE_COOLDOWN_MS = 10_000
const GLOBAL_CIRCUIT_MAX_COOLDOWN_MS = 120_000

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

/**
 * 归一化 pathname 中的动态段（房间 ID / 用户 ID / 事件 ID），
 * 让同类端点（如所有房间的 /tags、/friends/{uid}）共享同一个熔断 key。
 *
 * 否则 key 含房间 ID，每个房间的 tags 请求各自独立计数，
 * 单个房间达不到「连续 N 次 429」的熔断阈值，熔断器在 nginx 全局限流下形同虚设。
 *
 * 注：URL 中 `@` 编码为 %40、`:` 编码为 %3A、`$` 编码为 %24，`!` 保持原样。
 */
function normalizePathname(pathname: string): string {
  return pathname
    .replace(/%40[^/]+/g, '{userId}')
    .replace(/![^/]+/g, '{roomId}')
    .replace(/%24[^/]+/g, '{eventId}')
}

function endpointKey(input: RequestInfo | URL, init?: RequestInit): string {
  const method = init?.method?.toUpperCase() ?? 'GET'
  try {
    const pathname = new URL(resolveUrl(input)).pathname
    return `${method} ${normalizePathname(pathname)}`
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

// ==================== 全局熔断器 ====================
// 端点级熔断器按 `${method} ${pathname}` 计数，只对「单个端点连续 429」敏感。
// 但 nginx limit_req 是跨端点的全局限流：客户端在房间列表刷新/建房间时集中爆发
// tags/friends/presence/whoami 等请求，每个端点各自只 429 一两次，端点级熔断器
// 永不触发，风暴持续。全局熔断器按「滑动窗口内 429 总数」计数，感知整体风暴，
// 达到阈值后开路，冷却期内所有非 /sync 请求直接返回合成 429，让流量降为 0。

interface GlobalCircuitState {
  /** 滑动窗口内的 429 时间戳 */
  recent429Timestamps: number[]
  /** 开路截止时间（0 表示未开路） */
  openUntil: number
  /** 连续开路次数（驱动冷却时长指数增长） */
  consecutiveOpenCount: number
}

let globalCircuit: GlobalCircuitState = {
  recent429Timestamps: [],
  openUntil: 0,
  consecutiveOpenCount: 0
}

function globalCircuitCooldownRemainingMs(now: number): number {
  return globalCircuit.openUntil > now ? globalCircuit.openUntil - now : 0
}

function recordGlobal429(now: number): void {
  globalCircuit.recent429Timestamps = globalCircuit.recent429Timestamps.filter(
    (t) => now - t < GLOBAL_CIRCUIT_WINDOW_MS
  )
  globalCircuit.recent429Timestamps.push(now)
  if (globalCircuit.recent429Timestamps.length >= GLOBAL_CIRCUIT_THRESHOLD) {
    const exponent = globalCircuit.consecutiveOpenCount
    const cooldown = Math.min(GLOBAL_CIRCUIT_BASE_COOLDOWN_MS * 2 ** exponent, GLOBAL_CIRCUIT_MAX_COOLDOWN_MS)
    globalCircuit.openUntil = now + cooldown
    globalCircuit.consecutiveOpenCount++
    globalCircuit.recent429Timestamps = []
    logger.warn(
      `全局 429 风暴：${GLOBAL_CIRCUIT_WINDOW_MS / 1000}s 内 ${GLOBAL_CIRCUIT_THRESHOLD}+ 次，全局熔断 ${Math.round(cooldown / 1000)}s（请检查 nginx limit_req 配置）`
    )
  }
}

function recordGlobalSuccess(now: number): void {
  globalCircuit.recent429Timestamps = []
  if (globalCircuit.openUntil <= now) {
    globalCircuit.consecutiveOpenCount = 0
  }
}

export function createRateLimitedFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!shouldApplyClientRateLimit(input)) {
      return baseFetch(input, init)
    }

    const now = Date.now()

    // 全局熔断优先：感知跨端点全局限流风暴
    const globalCooldown = globalCircuitCooldownRemainingMs(now)
    if (globalCooldown > 0) {
      logger.warn(`全局熔断中，跳过真实请求，${Math.round(globalCooldown / 1000)}s 后恢复`)
      return createSynthetic429(globalCooldown)
    }

    // 端点级熔断
    const key = endpointKey(input, init)
    const cooldownMs = circuitCooldownRemainingMs(key, now)
    if (cooldownMs > 0) {
      logger.warn(`熔断中，跳过真实请求，${Math.round(cooldownMs / 1000)}s 后恢复: ${key}`)
      return createSynthetic429(cooldownMs)
    }

    const response = await fetchWithRetry(baseFetch, input, init, 0)
    recordCircuitResult(key, response.status, now)
    if (response.status === 429) {
      recordGlobal429(now)
    } else {
      recordGlobalSuccess(now)
    }
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
  globalCircuit = { recent429Timestamps: [], openUntil: 0, consecutiveOpenCount: 0 }
}
