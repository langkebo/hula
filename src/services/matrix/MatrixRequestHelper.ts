/**
 * 裸通道错误语义归一（审计 §7 批次 B-2 / §8 B-2）。
 *
 * 本模块是 `client.http.authedRequest()` 的**唯一**生产适配器（见
 * `scripts/check-sdk-boundary.mjs` 的 `ALLOWED_AUTHED_REQUEST_FILES`）：所有
 * 需要直接走 SDK 认证请求的代码都应经 `safeGet`/`safePost`/`safePut`/`safeDelete`。
 *
 * 同时提供把「任意传输层失败」归一成携带 `errcode` / `httpStatus` / `retryAfterMs`
 * 的 `MatrixTransportError` 的工厂，供仍在使用裸 `fetch` 的通道复用，禁止再自造
 * `throw new Error(\`HTTP ${status}: …\`)` 这类不含结构化字段的字符串错误。
 */

import { getMatrixClient } from './matrixClientAccessor'

/**
 * 归一化后的传输层错误。
 *
 * `errcode` 恒为非空串；`retryAfterMs` 同时以 camelCase 与 snake_case 暴露，
 * 因为 `src/common/errors.ts` 的 `extractRetryAfterMs` 只读取 `retry_after_ms`
 * 与 `data.retry_after_ms`。
 */
export interface MatrixTransportError extends Error {
  name: 'MatrixTransportError'
  /** Matrix errcode（保证非空；无法判定时为 `M_UNKNOWN`）。 */
  errcode: string
  /** HTTP 状态码；非 HTTP 失败（如网络错误、client 未初始化）为 0。 */
  httpStatus: number
  /** 服务端建议的重试等待毫秒数。 */
  retryAfterMs?: number
  /** snake_case 别名，供 `toAppError` 读取。 */
  retry_after_ms?: number
  /** 归一后的响应体（对象形式，无体时为空对象）。 */
  data: Record<string, unknown>
  method?: string
  url?: string
}

/** `createMatrixTransportError` 的输入。 */
export interface MatrixTransportErrorInput {
  /** HTTP 状态码；非 HTTP 失败传 0。 */
  status: number
  statusText?: string | undefined
  /** 已解析的响应体（若调用方已经解析过）。 */
  body?: unknown
  /** 原始响应体文本（未解析时由此解析 JSON）。 */
  bodyText?: string
  /** 响应头（真实 `Headers` 或带 `get()` 的形状）。 */
  headers?: unknown
  /** 显式覆盖最终 `message`（如本地化文案）。 */
  message?: string | undefined
  /** 兜底文案：仅在响应体与原文都给不出 message 时使用（优先级低于 `message`）。 */
  fallbackMessage?: string | undefined
  /** 响应体与状态码都无法给出 errcode 时的兜底 errcode。 */
  fallbackErrcode?: string | undefined
  method?: string
  url?: string
}

/** 本地结构类型：SDK `Method` 是字符串枚举，前端以字符串字面量调用。 */
interface MatrixAuthedRequestInvoker {
  authedRequest<T>(method: string, path: string, queryParams?: Record<string, string>, body?: unknown): Promise<T>
}

const STATUS_ERRCODE: Record<number, string> = {
  400: 'M_BAD_JSON',
  401: 'M_UNKNOWN_TOKEN',
  403: 'M_FORBIDDEN',
  404: 'M_NOT_FOUND',
  405: 'M_UNRECOGNIZED',
  409: 'M_UNKNOWN',
  429: 'M_LIMIT_EXCEEDED'
}

const DEFAULT_ERRCODE = 'M_UNKNOWN'
const BODY_TEXT_MESSAGE_LIMIT = 300

function pickNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return undefined
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function tryParseJsonRecord(text: string | undefined): Record<string, unknown> | null {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
  } catch {
    return null
  }
  return null
}

function resolveBodyRecord(body: unknown, bodyText: string | undefined): Record<string, unknown> {
  if (body && typeof body === 'object') return body as Record<string, unknown>
  if (typeof body === 'string') return tryParseJsonRecord(body) ?? {}
  return tryParseJsonRecord(bodyText) ?? {}
}

function readHeaderValue(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== 'object') return null
  const maybeGet = (headers as { get?: unknown }).get
  if (typeof maybeGet === 'function') {
    const value = (maybeGet as (n: string) => unknown).call(headers, name)
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  const record = headers as Record<string, unknown>
  const direct = record[name] ?? record[name.toLowerCase()]
  if (typeof direct === 'string' && direct.trim() !== '') return direct
  return null
}

function resolveRetryAfterMs(data: Record<string, unknown>, headers: unknown): number | undefined {
  const fromBody = toFiniteNumber(data.retry_after_ms) ?? toFiniteNumber(data.retryAfterMs)
  if (fromBody !== undefined) return fromBody
  const header = readHeaderValue(headers, 'Retry-After')
  if (header !== null) {
    const seconds = toFiniteNumber(header)
    if (seconds !== undefined) return Math.round(seconds * 1000)
  }
  return undefined
}

function resolveErrcode(status: number, data: Record<string, unknown>, fallbackErrcode?: string): string {
  const fromBody = pickNonEmptyString(data.errcode)
  if (fromBody !== undefined) return fromBody
  const fromFallback = pickNonEmptyString(fallbackErrcode)
  if (fromFallback !== undefined) return fromFallback
  const fromStatus = STATUS_ERRCODE[status]
  if (fromStatus !== undefined) return fromStatus
  return DEFAULT_ERRCODE
}

/**
 * 把一次失败的传输响应归一成携带结构化字段的 `MatrixTransportError`。
 *
 * - `errcode` 恒为非空串（优先级：响应体 `errcode` → `fallbackErrcode` → 状态码映射 → `M_UNKNOWN`）；
 * - `message` 优先级：显式 `message` → 响应体 `error` → 响应体 `message` → 非 JSON 原文（截断）
 *   → `fallbackMessage` → `${errcode} (HTTP ${status})`；
 * - `retryAfterMs` 从响应体 `retry_after_ms`/`retryAfterMs` 或 `Retry-After` 头（秒 → 毫秒）解析，
 *   并同时写入 `retryAfterMs` 与 `retry_after_ms`。
 *
 * @param input 失败响应信息（状态码必填）
 * @returns 归一化错误（同时满足 `instanceof Error`）
 */
export function createMatrixTransportError(input: MatrixTransportErrorInput): MatrixTransportError {
  const { status, statusText, body, bodyText, headers, message, fallbackMessage, fallbackErrcode, method, url } = input
  const data = resolveBodyRecord(body, bodyText)
  const errcode = resolveErrcode(status, data, fallbackErrcode)
  const retryAfterMs = resolveRetryAfterMs(data, headers)

  const rawTextMessage = tryParseJsonRecord(bodyText) ? undefined : pickNonEmptyString(bodyText)
  const fallbackText = `${errcode}${status ? ` (HTTP ${status}${statusText ? ` ${statusText}` : ''})` : ''}`
  const resolvedMessage =
    pickNonEmptyString(
      message,
      data.error,
      data.message,
      rawTextMessage?.slice(0, BODY_TEXT_MESSAGE_LIMIT),
      fallbackMessage
    ) ?? fallbackText

  const error = new Error(resolvedMessage) as MatrixTransportError
  error.name = 'MatrixTransportError'
  error.errcode = errcode
  error.httpStatus = status
  error.data = data
  if (method !== undefined) error.method = method
  if (url !== undefined) error.url = url
  if (retryAfterMs !== undefined) {
    error.retryAfterMs = retryAfterMs
    error.retry_after_ms = retryAfterMs
  }
  return error
}

function isMatrixTransportError(err: unknown): err is MatrixTransportError {
  return err instanceof Error && err.name === 'MatrixTransportError'
}

/**
 * 把任意失败值（SDK `MatrixError`、`TypeError`、普通 `Error` 等）归一成 `MatrixTransportError`。
 *
 * 已经是 `MatrixTransportError` 的原值返回；否则尽力从 `httpStatus`/`errcode`/`data`/
 * `retry_after_ms` 等既有字段提取，缺失部分回落默认值。
 *
 * @param err 原始失败值
 * @returns 归一化错误
 */
export function normalizeMatrixError(err: unknown): MatrixTransportError {
  if (isMatrixTransportError(err)) return err

  const record = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>
  const data = (record.data && typeof record.data === 'object' ? record.data : {}) as Record<string, unknown>
  const mergedData: Record<string, unknown> = { ...data }
  if (mergedData.retry_after_ms === undefined && record.retry_after_ms !== undefined) {
    mergedData.retry_after_ms = record.retry_after_ms
  }
  if (mergedData.retryAfterMs === undefined && record.retryAfterMs !== undefined) {
    mergedData.retryAfterMs = record.retryAfterMs
  }

  return createMatrixTransportError({
    status: toFiniteNumber(record.httpStatus) ?? 0,
    statusText: typeof record.statusText === 'string' ? record.statusText : undefined,
    body: mergedData,
    headers: record.headers,
    message: pickNonEmptyString(record.message),
    fallbackErrcode: pickNonEmptyString(record.errcode, data.errcode)
  })
}

/**
 * 连接类错误的 `name` 白名单（审计 §7 批次 B-4）。
 *
 * - `ConnectionError`：matrix-js-sdk 在 fetch 层失败时抛出（`errors.js`）；
 * - `NetworkError`：部分运行时的网络失败命名；
 * - `TypeError`：浏览器/undici 的 `fetch` 网络失败（`Failed to fetch` / `fetch failed`）。
 */
const CONNECTION_ERROR_NAMES: ReadonlySet<string> = new Set(['ConnectionError', 'NetworkError', 'TypeError'])

/** 语义不确证「请求是否到达服务端」的模式：超时/中止可能已成功提交，须保守不降级。 */
const NON_CONFIRMING_PATTERNS = ['timeout', 'timed out', 'abort']

/** 连接失败的消息模式（小写匹配）。 */
const CONNECTION_ERROR_MESSAGE_PATTERNS = [
  'fetch failed',
  'failed to fetch',
  'network error',
  'networkerror',
  'err_connection',
  'econnrefused',
  'econnreset',
  'enotfound',
  'connection refused',
  'connection reset',
  'load failed'
]

/**
 * 连接类错误判定：仅当**确证请求未到达服务端**（fetch 层失败、未拿到任何 HTTP 响应）时返回 `true`。
 *
 * 这是「仅在确证请求未到达服务端时降级重发」的**唯一**判据（审计 §7 批次 B-4 / §8 B-4）：
 * - 服务端已给出响应（`httpStatus > 0`）⇒ `false`（业务错误，重发可能重复提交）；
 * - 超时/中止语义不明（可能已提交）⇒ 保守 `false`；
 * - SDK `ConnectionError`、`TypeError`（`Failed to fetch` / `fetch failed`）⇒ `true`。
 *
 * 注意：必须在 `normalizeMatrixError` **之前**对原始 `err` 调用，因为归一化会把 `name`
 * 改写为 `MatrixTransportError`。
 *
 * @param err 原始失败值
 * @returns 是否属于连接类错误
 */
export function isConnectionClassError(err: unknown): boolean {
  if (!(err instanceof Error)) return false

  const record = err as Error & Record<string, unknown>
  const data = (record.data && typeof record.data === 'object' ? record.data : {}) as Record<string, unknown>
  const httpStatus = toFiniteNumber(record.httpStatus) ?? toFiniteNumber(data.httpStatus)
  if (httpStatus !== undefined && httpStatus > 0) return false

  const name = err.name
  const lowerName = name.toLowerCase()
  const message = err.message.toLowerCase()

  if (NON_CONFIRMING_PATTERNS.some((pattern) => lowerName.includes(pattern) || message.includes(pattern))) {
    return false
  }

  if (CONNECTION_ERROR_NAMES.has(name)) return true

  return CONNECTION_ERROR_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern))
}

function resolveAuthedRequest(client: unknown): MatrixAuthedRequestInvoker | null {
  if (!client || typeof client !== 'object') return null
  const http = (client as { http?: unknown }).http
  if (!http || typeof http !== 'object') return null
  const authedRequest = (http as { authedRequest?: unknown }).authedRequest
  if (typeof authedRequest !== 'function') return null
  return http as MatrixAuthedRequestInvoker
}

function requireAuthedRequest(client: unknown): MatrixAuthedRequestInvoker {
  const invoker = resolveAuthedRequest(client)
  if (!invoker) {
    throw createMatrixTransportError({
      status: 0,
      fallbackErrcode: DEFAULT_ERRCODE,
      message: 'Matrix client is not initialized'
    })
  }
  return invoker
}

/**
 * 经 SDK 认证通道发送 GET 请求；失败时抛出 `MatrixTransportError`。
 *
 * @param path 相对路径（SDK 自动补默认 v3 前缀）
 * @param queryParams 查询参数
 * @returns 响应体
 */
export async function safeGet<T>(path: string, queryParams?: Record<string, string>): Promise<T> {
  const client = getMatrixClient()
  try {
    return await requireAuthedRequest(client).authedRequest<T>('GET', path, queryParams)
  } catch (err) {
    throw normalizeMatrixError(err)
  }
}

/**
 * 经 SDK 认证通道发送 POST 请求；失败时抛出 `MatrixTransportError`。
 *
 * @param path 相对路径（SDK 自动补默认 v3 前缀）
 * @param body 请求体
 * @param queryParams 查询参数
 * @returns 响应体
 */
export async function safePost<T>(path: string, body?: unknown, queryParams?: Record<string, string>): Promise<T> {
  const client = getMatrixClient()
  try {
    return await requireAuthedRequest(client).authedRequest<T>('POST', path, queryParams, body)
  } catch (err) {
    throw normalizeMatrixError(err)
  }
}

/**
 * 经 SDK 认证通道发送 PUT 请求；失败时抛出 `MatrixTransportError`。
 *
 * @param path 相对路径（SDK 自动补默认 v3 前缀）
 * @param body 请求体
 * @param queryParams 查询参数
 * @returns 响应体
 */
export async function safePut<T>(path: string, body?: unknown, queryParams?: Record<string, string>): Promise<T> {
  const client = getMatrixClient()
  try {
    return await requireAuthedRequest(client).authedRequest<T>('PUT', path, queryParams, body)
  } catch (err) {
    throw normalizeMatrixError(err)
  }
}

/**
 * 经 SDK 认证通道发送 DELETE 请求；失败时抛出 `MatrixTransportError`。
 *
 * @param path 相对路径（SDK 自动补默认 v3 前缀）
 * @param queryParams 查询参数
 * @returns 响应体
 */
export async function safeDelete<T>(path: string, queryParams?: Record<string, string>): Promise<T> {
  const client = getMatrixClient()
  try {
    return await requireAuthedRequest(client).authedRequest<T>('DELETE', path, queryParams)
  } catch (err) {
    throw normalizeMatrixError(err)
  }
}
