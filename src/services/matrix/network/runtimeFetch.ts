import { type ClientOptions, fetch as nativeFetch } from '@tauri-apps/plugin-http'
import { createRateLimitedFetch } from '@/services/matrix/MatrixRateLimitInterceptor'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RuntimeFetch')
const RELAXED_TLS_HOST_SUFFIXES = ['.test', '.localhost', '.local']
const FETCH_RETRY_COUNT = 2
const FETCH_RETRY_BASE_DELAY_MS = 200
let hasWarnedNativeFetchFallback = false

function withOmittedCredentials(init?: RequestInit): RequestInit {
  return {
    ...init,
    credentials: init?.credentials ?? 'omit'
  }
}

function resolveRequestUrl(input: URL | RequestInfo): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
}

function shouldAllowInvalidCerts(input: URL | RequestInfo): boolean {
  if (!(import.meta.env.DEV || import.meta.env.MODE === 'test')) {
    return false
  }

  try {
    const url = new URL(resolveRequestUrl(input))
    if (url.protocol !== 'https:') {
      return false
    }

    return RELAXED_TLS_HOST_SUFFIXES.some((suffix) => url.hostname === suffix.slice(1) || url.hostname.endsWith(suffix))
  } catch {
    return false
  }
}

function withTauriClientOptions(input: URL | RequestInfo, init?: RequestInit): RequestInit & ClientOptions {
  const requestInit: RequestInit & ClientOptions = withOmittedCredentials(init)

  if (shouldAllowInvalidCerts(input)) {
    requestInit.danger = {
      ...requestInit.danger,
      acceptInvalidCerts: true,
      acceptInvalidHostnames: true
    }
  }

  return requestInit
}

function shouldUseBrowserFallback(input: URL | RequestInfo): boolean {
  const url = resolveRequestUrl(input)
  return /^https?:\/\//i.test(url) && typeof globalThis.fetch === 'function'
}

function rewriteToDevProxyUrl(url: string): string {
  // Tauri 桌面端 dev 模式下 nativeFetch 偶发失败（resource id invalid），
  // 回退到浏览器 fetch 时需要走 Vite proxy 避免 CORS/自签名证书问题
  if (!import.meta.env.DEV) return url
  try {
    const parsed = new URL(url)
    // 只重写 matrix.test 等 dev 域名的 _matrix 请求
    if (parsed.pathname.startsWith('/_matrix/') && RELAXED_TLS_HOST_SUFFIXES.some((s) => parsed.hostname.endsWith(s))) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}`
    }
  } catch {
    // ignore
  }
  return url
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
    message.includes('resource id invalid') ||
    message.includes('timeout') ||
    message.includes('aborted')
  )
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
    try {
      const response = await fetchFn(input, init)
      return response
    } catch (error) {
      lastError = error
      if (attempt < retries && isRetryableNetworkError(error)) {
        const delay = FETCH_RETRY_BASE_DELAY_MS * 2 ** attempt
        logger.warn(`fetch 失败，${delay}ms 后重试 (${attempt + 1}/${retries}): ${resolveRequestUrl(input)}`)
        await sleep(delay)
        continue
      }
      throw error
    }
  }
  throw lastError
}

function createTauriFetchWithBrowserFallback(): typeof globalThis.fetch {
  return (async (input: URL | RequestInfo, init?: RequestInit) => {
    const normalizedInit = withTauriClientOptions(input, init)
    const url = resolveRequestUrl(input)

    try {
      const response = await nativeFetch(input as URL | Request | string, normalizedInit)
      if (!response.ok && response.status !== 404) {
        const method = normalizedInit?.method || 'GET'
        logger.warn(`nativeFetch ${method} ${url} -> ${response.status}`)
      }
      return response
    } catch (error) {
      logger.warn(`nativeFetch 抛出异常 for ${url}: ${error}`)
      if (!shouldUseBrowserFallback(input)) {
        throw error
      }

      if (!hasWarnedNativeFetchFallback) {
        hasWarnedNativeFetchFallback = true
        logger.warn('Tauri native fetch failed, falling back to browser fetch', error)
      }

      // 回退到浏览器 fetch 时重写 dev 域名 URL 为 Vite proxy URL，避免 CORS/SSL 问题
      const fallbackInput = import.meta.env.DEV ? rewriteToDevProxyUrl(url) : input
      const fallbackInit = withOmittedCredentials(init)

      // 对网络级错误（如 ERR_CONNECTION_REFUSED）进行有限重试
      return await fetchWithRetry(globalThis.fetch, fallbackInput, fallbackInit)
    }
  }) as typeof globalThis.fetch
}

export function getRuntimeAwareFetch(): typeof globalThis.fetch {
  let baseFetch: typeof globalThis.fetch

  if (hasTauriRuntime()) {
    baseFetch = createTauriFetchWithBrowserFallback()
  } else {
    baseFetch = ((input: URL | RequestInfo, init?: RequestInit) =>
      globalThis.fetch(input, withOmittedCredentials(init))) as typeof globalThis.fetch
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
}
