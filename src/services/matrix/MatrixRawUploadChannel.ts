/**
 * Matrix HTTP 客户端的「原始 body」上传通道。
 *
 * 从 `MatrixHttpClient.ts` 抽出：媒体上传要把文件字节原样发出（`Blob`/`File`/`ArrayBuffer`），
 * 与 `request()` 的 JSON body 语义不同；而 `MatrixHttpClient.ts` 又受 `check:file-size`
 * 的新文件 400 行上限约束，故把这条通道单列成模块，客户端只保留一个薄委托。
 *
 * 它替代了原先 `mediaUploadHelpers.uploadViaDirectFetch` 里手写的 `XMLHttpRequest`：
 * 那条路径绕过了 `MatrixRateLimitInterceptor` 的限流/熔断与网络级重试，也绕过了
 * 统一的错误归一化（见 docs/Tjg-SDK-集成架构与能力图谱-2026-10-08.md §8.5 C5）。
 */

import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend'
import { createLogger } from '@/utils/Logger'
import { createMatrixTransportError } from './MatrixRequestHelper'
import { getMatrixAccessToken, getMatrixHomeserverUrl } from './matrixClientAccessor'
import { getRuntimeAwareFetch, rewriteToDevProxyUrl } from './network/runtimeFetch'

const logger = createLogger('MatrixRawUpload')

/**
 * 原始 body 上传的默认超时。
 *
 * 与原 XHR 实现的硬超时一致（30s），迁移不改变可观测行为。
 * 大文件的正路是「413 → 分片上传」，不依赖本通道。
 */
export const RAW_UPLOAD_TIMEOUT_MS = 30_000

/** 原始 body 请求选项。 */
export interface MatrixRawRequestOptions {
  /** HTTP 方法，默认 POST。 */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
  /** body 的 `Content-Type`（媒体上传必须显式给出，服务端据此判定）。 */
  contentType?: string
  /** 追加的请求头；`Authorization` 由本通道统一注入，勿在此重复设置。 */
  headers?: Record<string, string>
  /** 查询参数（如 `filename` / `content_type`）。 */
  queryParams?: Record<string, string>
  /** 超时（毫秒）；`<= 0` 表示不设超时。默认 {@link RAW_UPLOAD_TIMEOUT_MS}。 */
  timeoutMs?: number
  /** 外部取消信号（与超时信号合并）。 */
  signal?: AbortSignal
}

/**
 * 构造绝对请求 URL（homeserver + path + query）。
 *
 * 不含 dev 同源改写 —— 需要走 Vite proxy 的场景由调用方套 {@link rewriteToDevProxyUrl}。
 * 同时被 `MatrixHttpClient.request()` 的未鉴权回退路径复用。
 */
export function buildAbsoluteEndpointUrl(path: string, queryParams?: Record<string, string>): string {
  const homeserverUrl = getMatrixHomeserverUrl() || resolveMatrixRuntimeEndpointConfig().homeserverUrl
  const baseUrl = homeserverUrl.replace(/\/$/, '')
  let url = path.startsWith('http') ? path : `${baseUrl}/${path.replace(/^\//, '')}`
  if (queryParams) {
    const searchParams = new URLSearchParams(queryParams)
    url = `${url}${url.includes('?') ? '&' : '?'}${searchParams.toString()}`
  }
  return url
}

/**
 * 合并「超时信号」与「外部取消信号」。
 *
 * 不用 `AbortSignal.any`：目标 WebView（WKWebView 旧版）不保证支持。
 */
function linkAbortSignals(external: AbortSignal | undefined, timeoutSignal: AbortSignal): AbortSignal {
  if (!external) return timeoutSignal
  if (external.aborted) return external
  const controller = new AbortController()
  const abort = () => controller.abort()
  timeoutSignal.addEventListener('abort', abort, { once: true })
  external.addEventListener('abort', abort, { once: true })
  return controller.signal
}

/**
 * 发送原始 body 请求（经限流包装的运行时 fetch）。
 *
 * @throws {MatrixError} 非 2xx 时抛出（经 `createMatrixTransportError` 归一化，带 `httpStatus`）。
 */
export async function performRawUpload<T>(
  path: string,
  body: BodyInit,
  options: MatrixRawRequestOptions = {}
): Promise<T> {
  const method = options.method ?? 'POST'
  const url = rewriteToDevProxyUrl(buildAbsoluteEndpointUrl(path, options.queryParams))
  const headers: Record<string, string> = { ...options.headers }
  if (options.contentType) headers['Content-Type'] = options.contentType
  const accessToken = getMatrixAccessToken()
  if (accessToken && !headers.Authorization) headers.Authorization = `Bearer ${accessToken}`

  const timeoutMs = options.timeoutMs ?? RAW_UPLOAD_TIMEOUT_MS
  const timeoutController = new AbortController()
  const timer = timeoutMs > 0 ? setTimeout(() => timeoutController.abort(), timeoutMs) : undefined

  try {
    const runtimeFetch = getRuntimeAwareFetch()
    const response = await runtimeFetch(url, {
      method,
      headers,
      body,
      signal: linkAbortSignals(options.signal, timeoutController.signal)
    })

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '')
      throw createMatrixTransportError({
        status: response.status,
        statusText: response.statusText,
        bodyText,
        headers: response.headers,
        method,
        url
      })
    }

    const responseText = await response.text()
    return (responseText ? JSON.parse(responseText) : {}) as T
  } catch (err) {
    logger.error(`原始 body 请求失败: ${method} ${path}`, err)
    throw err
  } finally {
    if (timer) clearTimeout(timer)
  }
}
