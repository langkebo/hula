import { fetch as nativeFetch } from '@tauri-apps/plugin-http'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { createRateLimitedFetch } from '@/services/matrix/MatrixRateLimitInterceptor'
import { MATRIX_ROOT, PREFIX_VENDOR_V1 } from '@/services/matrix/paths/prefixes'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { computeBackoffDelay, sleep } from '@/utils/backoff'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RuntimeFetch')
const RELAXED_TLS_HOST_SUFFIXES = ['.test', '.localhost', '.local']
const FETCH_RETRY_COUNT = 2
const FETCH_RETRY_BASE_DELAY_MS = 200

/**
 * 原生通道异常按 host 聚合。
 *
 * 背景（2026-10-13 实测日志）：capability `http:default.allow` 缺 homeserver host 时，
 * `tauri-plugin-http` 会**对每一个请求**抛出同一条
 * `url not allowed on the configured scope`。homeserver 上跑着 /sync 长轮询与
 * presence 心跳 ⇒ 该 WARN 每几十秒刷一条，把 `logToTauriPlugin` 通道淹掉，
 * 真正的关键行反而看不见。scope 类错误是**配置性**的（同一 host 恒真），
 * 按 host 聚合一次即可定位；重复出现只留 debug + 计数。
 *
 * 用 host（含端口）而不是 URL 作为键：同一 host 上不同路径的失败属同一根因。
 */
const nativeFetchFailureCounts = new Map<string, number>()
const warnedNativeFetchHosts = new Set<string>()
let hasWarnedNativeFetchFallback = false

function nativeFetchHostKey(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function warnNativeFetchFailure(url: string, error: unknown): void {
  const host = nativeFetchHostKey(url)
  const count = (nativeFetchFailureCounts.get(host) ?? 0) + 1
  nativeFetchFailureCounts.set(host, count)

  if (warnedNativeFetchHosts.has(host)) {
    logger.debug(`nativeFetch 抛出异常 for ${url} (host=${host} 累计 ${count} 次，已降为 debug): ${error}`)
    return
  }

  warnedNativeFetchHosts.add(host)
  logger.warn(`nativeFetch 抛出异常 for ${url}（同一 host 后续异常降为 debug）: ${error}`)
}

function withOmittedCredentials(init?: RequestInit): RequestInit {
  return {
    ...init,
    credentials: init?.credentials ?? 'omit'
  }
}

/** 信令事件 JSON 包：字段随 SDK `m.call.*` 事件内容变化，这里只声明需要归一化的 `version` */
interface VoipSignalPayload {
  version?: unknown
  [key: string]: unknown
}

/**
 * synapse-rust 的 rtc 路由用 serde 把 `version` 严格反序列化为 `i32`，
 * 而 matrix-js-sdk 的信令事件（invite/answer/candidates/hangup）按
 * `VOIP_PROTO_VERSION` 发送字符串 `"1"`，服务端会一律返回 400 `M_BAD_JSON`。
 * SDK 以 tarball 固定、不允许就地修改，因此在 HTTP 边界把该字段归一化为数字。
 */
function normalizeVoipSignalBody(url: string, init: RequestInit): RequestInit {
  if (!url.includes('/send/m.call.') || typeof init.body !== 'string') return init

  try {
    const payload = JSON.parse(init.body) as VoipSignalPayload
    if (typeof payload.version !== 'string') return init
    const version = Number(payload.version)
    if (!Number.isInteger(version)) return init
    return { ...init, body: JSON.stringify({ ...payload, version }) }
  } catch {
    return init
  }
}

function resolveRequestUrl(input: URL | RequestInfo): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
}

function shouldUseBrowserFallback(input: URL | RequestInfo): boolean {
  const url = resolveRequestUrl(input)
  return /^https?:\/\//i.test(url) && typeof globalThis.fetch === 'function'
}

/**
 * 把 dev 域名的 `/_matrix/**` 绝对 URL 改写到同源 Vite proxy。
 *
 * 导出给 `MatrixHttpClient` 的原始 body 上传通道复用（浏览器 dev 下必须走 proxy，
 * 否则跨域直接失败）；单一实现，避免各调用点再抄一份。
 */
export function rewriteToDevProxyUrl(url: string): string {
  // Tauri 桌面端 dev 模式下 nativeFetch 偶发失败（resource id invalid），
  // 回退到浏览器 fetch 时需要走 Vite proxy 避免 CORS/自签名证书问题
  if (!import.meta.env.DEV) return url
  try {
    const parsed = new URL(url)
    // 只重写 matrix.test 等 dev 域名的 _matrix 请求
    if (
      parsed.pathname.startsWith(`${MATRIX_ROOT}/`) &&
      RELAXED_TLS_HOST_SUFFIXES.some((s) => parsed.hostname.endsWith(s))
    ) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}`
    }
  } catch {
    // ignore
  }
  return url
}

/**
 * Tauri plugin-http 通过 Rust 资源表（resource id）管理在途请求：
 * `fetch` 返回 rid → signal abort 触发 `fetch_cancel(rid)` 丢弃资源 →
 * 随后的 `fetch_send(rid)` / `fetch_read_body(rid)` 会抛出 "resource id invalid"。
 * 插件自身在若干分支直接抛出普通 Error("Request cancelled")。
 *
 * 这两类错误本质是"请求已被主动取消"，不是网络故障：
 * - 不能回退到浏览器 fetch（会把 SDK 已放弃的请求重新发出去，产生幽灵重复请求）
 * - 必须归一化为 AbortError，否则 matrix-js-sdk 的 sync 循环会误判为网络异常并进入错误退避
 */
function isSignalAborted(init?: RequestInit): boolean {
  return init?.signal?.aborted === true
}

/**
 * 判断错误是否来自 Tauri plugin-http 的"请求已被放弃"语义。
 * 两类典型报错：
 * - "The resource id <rid> is invalid."（abort 触发 fetch_cancel 丢弃资源后，
 *   插件在 fetch_send/fetch_read_body 阶段拿到失效 rid 抛出；注意中间夹着真实数字，
 *   不能简单用 includes('resource id invalid') 匹配）
 * - "Request cancelled"（插件在若干分支直接抛出的普通 Error）
 * 这类错误本质是请求已被主动取消（或插件自身资源表竞态），不是网络故障：
 * 应归一化为 AbortError，不回退浏览器 fetch、不重试。
 */
function isTauriCancelError(error: unknown): boolean {
  const errorObj = error as { message?: unknown }
  const message = String(errorObj?.message ?? error).toLowerCase()
  return (message.includes('resource id') && message.includes('invalid')) || message.includes('request cancelled')
}

function createAbortError(url: string): Error {
  if (typeof DOMException === 'function') {
    return new DOMException(`Request aborted: ${url}`, 'AbortError') as Error
  }
  const error = new Error(`Request aborted: ${url}`)
  error.name = 'AbortError'
  return error
}

/**
 * 判断错误是否为可重试的网络错误（连接拒绝、超时、网络中断等）
 * HTTP 状态码错误（4xx/5xx）不属于此类，不应重试
 */
function isRetryableNetworkError(error: unknown): boolean {
  if (!error) return false
  const errorObj = error as { message?: unknown }
  const message = String(errorObj?.message ?? error).toLowerCase()
  return (
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('err_connection_refused') ||
    message.includes('err_connection_reset') ||
    message.includes('err_internet_disconnected') ||
    message.includes('timeout') ||
    message.includes('aborted')
  )
}

/**
 * 带重试的 fetch 包装器：仅对网络级错误重试，HTTP 4xx/5xx 不重试
 */
async function fetchWithRetry(
  fetchFn: typeof globalThis.fetch,
  input: URL | RequestInfo,
  init: RequestInit | undefined,
  retries: number = FETCH_RETRY_COUNT
): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (isSignalAborted(init)) {
      throw createAbortError(resolveRequestUrl(input))
    }
    try {
      const response = await fetchFn(input, init)
      return response
    } catch (error) {
      lastError = error
      // 请求已被主动取消：立即归一化为 AbortError，不再退避重试
      if (isSignalAborted(init)) {
        throw createAbortError(resolveRequestUrl(input))
      }
      if (attempt < retries && isRetryableNetworkError(error)) {
        const delay = computeBackoffDelay({ baseDelayMs: FETCH_RETRY_BASE_DELAY_MS, attempt })
        logger.warn(`fetch 失败，${delay}ms 后重试 (${attempt + 1}/${retries}): ${resolveRequestUrl(input)}`)
        await sleep(delay)
        continue
      }
      throw error
    }
  }
  throw lastError
}

/**
 * 判断非 2xx 响应是否属于「预期结果」，从而不按异常告警记录。
 *
 * 这些状态码都是调用方已按正常分支处理的探测/权限结论，记 WARN 只会掩盖真正的问题：
 * - 404：Matrix 端点或资源不存在（含能力探测），调用方按缺失处理；
 * - presence 403：未与目标用户共享房间，MatrixPresenceService 已返回 offline；
 * - /account/guest 401/403：访客能力探测，登录页挂载即触发一次；
 * - admin whoami 403：非管理员用户的常态（普通用户都会访问一次）；
 * - vendor 扩展 + limit=0 的 400/404：EndpointCapabilityService 的能力探测结论。
 */
export function isExpectedNonSuccess(url: string, status: number): boolean {
  if (status === 404) return true
  if (status === 403 && url.includes('/presence/')) return true
  if ((status === 401 || status === 403) && url.includes('/account/guest')) return true
  if (status === 403 && url.includes('/admin/v1/whoami')) return true
  if (status === 400 && url.includes(PREFIX_VENDOR_V1) && url.includes('limit=0')) return true
  return false
}

/** 401 会话失效广播的最小间隔：一次 401 风暴（多端点同时失败）只登出一次。 */
const SESSION_INVALID_NOTIFY_COOLDOWN_MS = 30_000
let sessionInvalidNotifiedAt = 0

/** 读取 HeadersInit（Headers / 数组 / 普通对象）中的指定头。 */
function readHeaderValue(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) return null
  const target = name.toLowerCase()
  if (headers instanceof Headers) return headers.get(name)
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      if (String(key).toLowerCase() === target) return String(value)
    }
    return null
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value ?? null
  }
  return null
}

/**
 * 从请求中提取 access token，随会话失效事件一起广播。
 *
 * 切换账号时旧会话的在途请求可能晚于新登录返回 401；只凭 URL 无法区分，
 * home 窗口需要用它和当前 token 比对，避免旧 token 的 401 把新会话登出。
 */
function extractAccessToken(url: string, input: URL | RequestInfo, init?: RequestInit): string | null {
  const authorization =
    readHeaderValue(init?.headers, 'authorization') ??
    (typeof Request !== 'undefined' && input instanceof Request
      ? readHeaderValue(input.headers, 'authorization')
      : null)
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())
    if (match) return match[1].trim() || null
  }

  const fromQuery = /[?&]access_token=([^&]+)/.exec(url)
  if (fromQuery) {
    try {
      return decodeURIComponent(fromQuery[1]) || null
    } catch {
      return fromQuery[1] || null
    }
  }
  return null
}

/**
 * `401 M_UNKNOWN_TOKEN` 表示服务端已吊销 access token（改密、被踢下线、token 重置等）。
 *
 * 重启应用时若 sync 未启动或未收到 WS 的 `TOKEN_EXPIRED`，应用会永久停留在 401 故障态
 * （报告 P-01）。因此在 HTTP 边界兜底：命中即广播 `SESSION_AUTH_INVALID`，由 home 窗口
 * 统一清理会话并打开登录窗口。
 *
 * 广播携带发起请求的 access token，供接收方区分「当前会话失效」与「旧会话残留 401」。
 */
function notifySessionInvalid(url: string, response: Response, accessToken: string | null = null): void {
  if (response.status !== 401) return
  if (!url.includes(`${MATRIX_ROOT}/`)) return
  // 登录/注册/访客探测的 401 是业务结论，不是会话失效
  if (/\/(login|register|account\/guest)(\/|\?|$)/.test(url)) return
  if (Date.now() - sessionInvalidNotifiedAt < SESSION_INVALID_NOTIFY_COOLDOWN_MS) return

  let cloned: Response
  try {
    cloned = response.clone()
  } catch {
    // 响应不可克隆（测试桩 / body 已消费）时跳过探测，不能影响正常返回
    return
  }

  void cloned
    .json()
    .then((payload: unknown) => {
      const errcode = (payload as { errcode?: unknown } | null)?.errcode
      if (errcode !== 'M_UNKNOWN_TOKEN') return
      sessionInvalidNotifiedAt = Date.now()
      logger.warn('access token 已失效（401 M_UNKNOWN_TOKEN），触发统一登出回到登录页')
      useMitt.emit(MittEnum.SESSION_AUTH_INVALID, { accessToken })
    })
    .catch(() => {
      // 响应体不是 JSON（代理/网关错误页）时无需处理
    })
}

function createTauriFetchWithBrowserFallback(): typeof globalThis.fetch {
  return (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = resolveRequestUrl(input)
    const normalizedInit = normalizeVoipSignalBody(url, withOmittedCredentials(init))

    if (isSignalAborted(init)) {
      throw createAbortError(url)
    }

    try {
      const response = await nativeFetch(input as URL | Request | string, normalizedInit)
      // 访客能力探测：未鉴权 GET /account/guest 期望 401/403 —— 能回这两个状态恰说明
      // 端点存在，MatrixAuthService.getGuestSupport() 已按「支持访客」处理。
      // 登录页挂载即触发一次，不应记成异常告警。
      const isGuestCapabilityProbe =
        (response.status === 401 || response.status === 403) && url.includes('/account/guest')
      if (isGuestCapabilityProbe) {
        logger.debug(`nativeFetch GET ${url} -> ${response.status} (guest capability probe, expected)`)
      } else if (!response.ok && !isExpectedNonSuccess(url, response.status)) {
        const method = normalizedInit?.method || 'GET'
        // 429 需要区分来源以便排查：Rust 限流中间件会带 x-ratelimit-remaining 头，
        // nginx limit_req 的 429 没有该头；retry-after 反映服务端建议的退避时长
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after')
          const remaining = response.headers.get('x-ratelimit-remaining')
          logger.warn(
            `nativeFetch ${method} ${url} -> 429 (retry-after: ${retryAfter ?? 'n/a'}s, x-ratelimit-remaining: ${remaining ?? 'n/a'})`
          )
        } else {
          logger.warn(`nativeFetch ${method} ${url} -> ${response.status}`)
        }
      }
      notifySessionInvalid(url, response, extractAccessToken(url, input, normalizedInit))
      return response
    } catch (error) {
      // Tauri plugin-http 在请求被主动取消（SDK 显式 abort 或插件自身资源表竞态）时，
      // 会抛出 "resource id invalid" / "Request cancelled"。这类错误的本质是请求已被放弃，
      // 不是网络故障：归一化为 AbortError，且不回退浏览器 fetch、不重试
      // （否则会重放 SDK 已放弃的 /sync 长轮询，产生幽灵重复请求）。
      // 注意：不能仅依赖 init.signal.aborted —— 当取消由插件资源表竞态引发、或 /sync 长轮询
      // 在自激循环里被挤掉时，JS 信号未必被置位，必须按错误内容识别。
      if (isSignalAborted(init) || isTauriCancelError(error)) {
        throw createAbortError(url)
      }

      warnNativeFetchFailure(url, error)
      if (!shouldUseBrowserFallback(input)) {
        throw error
      }
      if (!hasWarnedNativeFetchFallback) {
        hasWarnedNativeFetchFallback = true
        logger.warn('Tauri native fetch failed, falling back to browser fetch', error)
      }

      // 回退到浏览器 fetch 时重写 dev 域名 URL 为 Vite proxy URL，避免 CORS/SSL 问题
      const fallbackInput = import.meta.env.DEV ? rewriteToDevProxyUrl(url) : input
      const fallbackInit = normalizeVoipSignalBody(url, withOmittedCredentials(init))

      // 对网络级错误（如 ERR_CONNECTION_REFUSED）进行有限重试
      const fallbackResponse = await fetchWithRetry(globalThis.fetch, fallbackInput, fallbackInit)
      notifySessionInvalid(url, fallbackResponse, extractAccessToken(url, fallbackInput, fallbackInit))
      return fallbackResponse
    }
  }) as typeof globalThis.fetch
}

export function getRuntimeAwareFetch(): typeof globalThis.fetch {
  let baseFetch: typeof globalThis.fetch

  if (hasTauriRuntime()) {
    baseFetch = createTauriFetchWithBrowserFallback()
  } else {
    baseFetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
      const response = await globalThis.fetch(input, withOmittedCredentials(init))
      notifySessionInvalid(
        resolveRequestUrl(input),
        response,
        extractAccessToken(resolveRequestUrl(input), input, init)
      )
      return response
    }) as typeof globalThis.fetch
  }

  return createRateLimitedFetch(baseFetch)
}

export function getRuntimeAwareFetchFn(): typeof globalThis.fetch | undefined {
  if (!hasTauriRuntime()) {
    // 非 Tauri 环境也返回带限流的 browser fetch，避免 SDK 使用可能超时/中止的默认实现
    return getRuntimeAwareFetch()
  }

  return getRuntimeAwareFetch()
}

export function __resetRuntimeFetchWarningForTests(): void {
  hasWarnedNativeFetchFallback = false
  nativeFetchFailureCounts.clear()
  warnedNativeFetchHosts.clear()
  sessionInvalidNotifiedAt = 0
}
