import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
import { isUrlAllowed } from '@/utils/hostAllowlist'
import { currentEnv, getAllowlistConfig } from '@/utils/httpAllowlistConfig'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('HttpClient')
const warnedAllowlistHosts = new Set<string>()
const dynamicExemptHosts = new Set<string>()

export class HttpClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string
  ) {
    super(message)
    this.name = 'HttpClientError'
  }
}

export class HttpClientBlockedError extends Error {
  constructor(
    public readonly host: string | null,
    public readonly reason: string,
    public readonly blockedUrl: string
  ) {
    super(`Request blocked by host allowlist (${reason}): ${host ?? 'unknown'}`)
    this.name = 'HttpClientBlockedError'
  }
}

interface HttpClientConfig {
  timeoutMs?: number
  signal?: AbortSignal
  headers?: Record<string, string>
  keepalive?: boolean
  /**
   * 显式动态豁免：放行白名单外的「用户/数据驱动 URL」（如 homeserver、emoji/media/widget、自定义模型端点）。
   * 仅在 allowlist 未命中时生效；仍会记录 host（绝不记录 query/token）。
   */
  allowDynamicHost?: boolean
}

const DEFAULT_TIMEOUT_MS = 30_000

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
  allowDynamicHost = false
): Promise<Response> {
  if (externalSignal?.aborted) {
    throw new DOMException('The operation was aborted', 'AbortError')
  }

  const env = currentEnv()
  const allowlist = getAllowlistConfig(env)
  const decision = isUrlAllowed(url, allowlist.rules, env)
  if (!decision.allowed) {
    // 只记录 host 与 reason，绝不记录完整 URL（可能含 query/token）
    const host = decision.host ?? 'unknown'
    if (allowDynamicHost) {
      // 显式动态豁免：放行用户/数据驱动 URL，仅记录 host 供审计
      if (!dynamicExemptHosts.has(host)) {
        dynamicExemptHosts.add(host)
        logger.info(`host allowlist dynamic-exempt: host=${host} reason=${decision.reason}`)
      }
    } else {
      if (!warnedAllowlistHosts.has(host)) {
        warnedAllowlistHosts.add(host)
        logger.warn(
          `host allowlist ${allowlist.mode === 'enforce' ? 'blocked' : 'observed'}: host=${host} reason=${decision.reason}`
        )
      }
      if (allowlist.mode === 'enforce') {
        throw new HttpClientBlockedError(decision.host, decision.reason, url)
      }
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const abortFromExternal = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      // 必须显式移除：长生命周期的 signal（如页面级 controller）会持续
      // 累积监听器，Chrome 超过 10 个还会打印泄漏告警。
      externalSignal.addEventListener('abort', abortFromExternal, { once: true })
    }
  }

  const combinedInit: RequestInit = {
    ...init,
    signal: controller.signal
  }

  try {
    const runtimeFetch = getRuntimeAwareFetch()
    return await runtimeFetch(url, combinedInit)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (externalSignal?.aborted) {
        throw new DOMException('The operation was aborted', 'AbortError')
      }
      throw new Error(`Request to ${url} timeout after ${timeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', abortFromExternal)
  }
}

async function toHttpClientError(response: Response, method: string, url: string): Promise<HttpClientError> {
  let body = ''
  try {
    body = await response.text()
  } catch {
    // ignore body read failures
  }
  return new HttpClientError(
    `${method} ${url} failed with ${response.status} ${response.statusText}`,
    response.status,
    response.statusText,
    body
  )
}

/**
 * 通用 HTTP 客户端（host allowlist + 超时 + 限流包装的 `runtimeFetch`）。
 *
 * 使用边界（S11 传输层收敛）：
 * - **Matrix 协议域禁止使用**。`src/services/matrix/**` 内的请求必须走
 *   `matrixHttpClient`（`request` / `uploadRaw` / `downloadRaw`），以便复用 SDK 的
 *   前缀解析、鉴权与错误归一化；该类只保留给**非 Matrix 的第三方端点**
 *   （更新检查、AI provider、翻译兜底、图片/音频直链等）。
 * - 新增第三方调用也应优先直接使用 `getRuntimeAwareFetch()`；本类是为这些存量
 *   调用点保留的 allowlist 层，后续逐步下线。
 */
export class HttpClient {
  static async get<T = unknown>(url: string, config?: HttpClientConfig): Promise<T> {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        ...(config?.headers !== undefined ? { headers: config.headers } : {}),
        ...(config?.keepalive !== undefined ? { keepalive: config.keepalive } : {})
      },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal,
      config?.allowDynamicHost
    )
    if (!response.ok) {
      throw await toHttpClientError(response, 'GET', url)
    }
    return response.json() as Promise<T>
  }

  private static isRawBody(
    body: unknown
  ): body is Blob | File | ArrayBuffer | ArrayBufferView | FormData | ReadableStream {
    return (
      body instanceof Blob ||
      body instanceof File ||
      body instanceof ArrayBuffer ||
      ArrayBuffer.isView(body) ||
      (typeof FormData !== 'undefined' && body instanceof FormData) ||
      (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
    )
  }

  static async post<T = unknown>(url: string, body?: unknown, config?: HttpClientConfig): Promise<T> {
    const rawBody = body !== undefined && body !== null && HttpClient.isRawBody(body)
    const headers: Record<string, string> = {
      'Content-Type': rawBody ? (config?.headers?.['Content-Type'] ?? 'application/octet-stream') : 'application/json',
      ...config?.headers
    }
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers,
        ...(rawBody || body !== undefined ? { body: rawBody ? (body as BodyInit) : JSON.stringify(body) } : {}),
        ...(config?.keepalive !== undefined ? { keepalive: config.keepalive } : {})
      },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal,
      config?.allowDynamicHost
    )
    if (!response.ok) {
      throw await toHttpClientError(response, 'POST', url)
    }
    return response.json() as Promise<T>
  }

  static async head(url: string, config?: HttpClientConfig): Promise<Response> {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'HEAD',
        ...(config?.headers !== undefined ? { headers: config.headers } : {}),
        ...(config?.keepalive !== undefined ? { keepalive: config.keepalive } : {})
      },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal,
      config?.allowDynamicHost
    )
    if (!response.ok) {
      throw await toHttpClientError(response, 'HEAD', url)
    }
    return response
  }

  static async downloadBytes(url: string, config?: HttpClientConfig): Promise<ArrayBuffer> {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        ...(config?.headers !== undefined ? { headers: config.headers } : {}),
        ...(config?.keepalive !== undefined ? { keepalive: config.keepalive } : {})
      },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal,
      config?.allowDynamicHost
    )
    if (!response.ok) {
      throw await toHttpClientError(response, 'GET', url)
    }
    return response.arrayBuffer()
  }

  static async streamResponse(url: string, body: unknown, config?: HttpClientConfig): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config?.headers
    }
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        ...(config?.keepalive !== undefined ? { keepalive: config.keepalive } : {})
      },
      config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      config?.signal,
      config?.allowDynamicHost
    )
    if (!response.ok) {
      throw await toHttpClientError(response, 'POST', url)
    }
    return response
  }
}
