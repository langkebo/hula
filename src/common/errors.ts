/**
 * §18.8.2 — AppError contract presented to UI.
 *
 * UI components (toast / inline / fullscreen / ErrorBoundary) consume ONLY
 * this discriminated union. Services are responsible for converting SDK /
 * transport / business-layer errors into an `AppError` via `toAppError()`
 * before they reach the UI layer.
 *
 * Telemetry de-dup key per §18.8.1: `(code, fingerprint, route, sdk_commit)`.
 * `fingerprint(err)` returns a stable short hash suitable for that tuple.
 */

import { AppException, ErrorType } from './exception'
import { translateMatrixError } from './matrixErrorTranslator'
import { notImplementedError, resolveUnknownErrcodeSemantics } from './matrixUnknownSemantics'

export type AppErrorAuth = {
  kind: 'auth'
  code: string
  recoverable: boolean
  message: string
  i18nKey?: string | undefined
}

export type AppErrorValidation = {
  kind: 'validation'
  field?: string | undefined
  code: string
  message: string
  i18nKey?: string | undefined
}

export type AppErrorNotFound = {
  kind: 'not_found'
  resource: string
  message: string
  i18nKey?: string | undefined
}

export type AppErrorRetryable = {
  kind: 'retryable'
  retryAfterMs?: number | undefined
  message: string
  /** Source code (M_LIMIT_EXCEEDED, NetworkError, TimeoutError, …) for telemetry. */
  code?: string
  i18nKey?: string | undefined
}

export type AppErrorFatal = {
  kind: 'fatal'
  code: string
  message: string
  correlationId: string
  i18nKey?: string | undefined
}

export type AppError = AppErrorAuth | AppErrorValidation | AppErrorNotFound | AppErrorRetryable | AppErrorFatal

/**
 * 鉴权类 errcode。
 *
 * `M_UNAUTHORIZED` 是 synapse-rust 的**非规范**扩展码（`ApiError::unauthorized`，
 * 实测 `POST /upload/token` 无 token 时返回 `{"errcode":"M_UNAUTHORIZED"}`）。
 * Matrix 规范只有 `M_UNKNOWN_TOKEN` / `M_MISSING_TOKEN`，但后端确实在用它，
 * 若不收录会被归为 fatal（用户看到「未知错误」而非「请重新登录」）。
 */
const AUTH_ERRCODES = new Set([
  'M_UNKNOWN_TOKEN',
  'M_MISSING_TOKEN',
  'M_UNAUTHORIZED',
  'M_FORBIDDEN',
  'M_GUEST_ACCESS_FORBIDDEN'
])
const VALIDATION_ERRCODES = new Set([
  'M_BAD_JSON',
  'M_NOT_JSON',
  // synapse-rust 的所有参数校验（`ApiError::invalid_param` / `validation`）都用这个码，
  // 例如 `GET /friends?limit=0` → 400 M_INVALID_PARAM。此前未收录 ⇒ 参数错误被归为 fatal。
  'M_INVALID_PARAM',
  'M_INVALID_EMAIL',
  'M_MISSING_PARAM',
  'M_INVALID_USERNAME',
  'M_WEAK_PASSWORD',
  'M_USER_IN_USE',
  'M_EXCLUSIVE',
  'M_THREEPID_IN_USE',
  'M_ROOM_IN_USE',
  'M_INVALID_ROOM_STATE',
  'M_UNSUPPORTED_ROOM_VERSION',
  'M_INCOMPATIBLE_ROOM_VERSION',
  'FRIEND_ALREADY_EXISTS',
  'FRIEND_REQUEST_PENDING'
])

const I18N_KEY_MAP: Record<string, string> = {
  M_FORBIDDEN: 'error.matrix.forbidden',
  M_UNKNOWN_TOKEN: 'error.matrix.unknown_token',
  M_MISSING_TOKEN: 'error.matrix.missing_token',
  // 非规范码，语义等同「凭证无效/缺失」⇒ 复用 unknown_token 的「会话已过期，请重新登录」
  M_UNAUTHORIZED: 'error.matrix.unknown_token',
  M_LIMIT_EXCEEDED: 'error.matrix.rate_limited',
  M_NOT_FOUND: 'error.matrix.not_found',
  M_BAD_JSON: 'error.matrix.bad_request',
  M_NOT_JSON: 'error.matrix.bad_request',
  M_INVALID_PARAM: 'error.matrix.bad_request',
  M_MISSING_PARAM: 'error.matrix.bad_request',
  M_INVALID_EMAIL: 'error.matrix.bad_request',
  M_USER_IN_USE: 'error.matrix.user_in_use',
  M_INVALID_USERNAME: 'error.matrix.invalid_username',
  M_WEAK_PASSWORD: 'error.matrix.weak_password',
  M_EXCLUSIVE: 'error.matrix.exclusive',
  M_GUEST_ACCESS_FORBIDDEN: 'error.matrix.guest_forbidden',
  M_THREEPID_IN_USE: 'error.matrix.threepid_in_use',
  M_THREEPID_NOT_FOUND: 'error.matrix.threepid_not_found',
  M_ROOM_IN_USE: 'error.matrix.room_in_use',
  M_INVALID_ROOM_STATE: 'error.matrix.invalid_room_state',
  M_UNSUPPORTED_ROOM_VERSION: 'error.matrix.unsupported_room_version',
  M_INCOMPATIBLE_ROOM_VERSION: 'error.matrix.incompatible_room_version',
  FRIEND_ALREADY_EXISTS: 'error.matrix.friend_exists',
  FRIEND_REQUEST_PENDING: 'error.matrix.friend_pending'
}

/**
 * 兜底路径可接受的 i18n key 白名单。
 *
 * `translateMatrixError`（@deprecated）的 `TranslatedError.userMessage` 字段语义是
 * 「用户文案」，但其当前实现里存的是 `error.matrix.*` key。这里只接受真实存在的 key：
 * 一旦该 deprecated 接口回归「返回已翻译整句」的语义，`i18nKey` 会退化为 undefined，
 * 展示层回落到 `message`，而不是把一整句译文塞进 key 字段（见 `toAppError` 兜底分支）。
 */
const FALLBACK_I18N_KEYS: ReadonlySet<string> = new Set<string>([
  ...Object.values(I18N_KEY_MAP),
  'error.matrix.invalid_credentials',
  'error.matrix.network',
  'error.matrix.server_unavailable',
  'error.matrix.unknown'
])

type AnyErrorLike = Error & {
  errcode?: string
  httpStatus?: number
  data?: { error?: string; errcode?: string; retry_after_ms?: number }
  retry_after_ms?: number
  details?: { category?: string; url?: string }
  field?: string
  resource?: string
}

function isError(x: unknown): x is Error {
  return x instanceof Error || (typeof x === 'object' && x !== null && 'message' in x)
}

function extractErrcode(err: AnyErrorLike): string | undefined {
  return err.errcode || err.data?.errcode
}

function extractRetryAfterMs(err: AnyErrorLike): number | undefined {
  return err.retry_after_ms ?? err.data?.retry_after_ms
}

function newCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `corr-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

/**
 * Compact stable fingerprint per §18.8.1. Uses `(name, code, first line of
 * message)` so that identical SDK errors from different call sites collapse
 * but different error shapes stay distinct. Not cryptographic — fit for
 * de-dup only.
 */
export function fingerprint(err: unknown): string {
  if (!isError(err)) return `raw:${String(err).slice(0, 60)}`
  const e = err as AnyErrorLike
  const name = e.name || 'Error'
  const code = extractErrcode(e) || String(e.httpStatus ?? e.details?.category ?? '')
  const messageHead = (e.message || '').split('\n')[0].slice(0, 80)
  return `${name}:${code}:${messageHead}`
}

export function toAppError(err: unknown, options: { resource?: string; field?: string } = {}): AppError {
  if (err == null) {
    return {
      kind: 'fatal',
      code: 'UNKNOWN',
      message: 'Unknown error',
      correlationId: newCorrelationId(),
      i18nKey: 'error.matrix.unknown'
    }
  }

  // Already an AppError (idempotency).
  if (typeof err === 'object' && err !== null && 'kind' in err) {
    const candidate = err as { kind?: string }
    if (
      candidate.kind === 'auth' ||
      candidate.kind === 'validation' ||
      candidate.kind === 'not_found' ||
      candidate.kind === 'retryable' ||
      candidate.kind === 'fatal'
    ) {
      return err as AppError
    }
  }

  const e = (isError(err) ? err : new Error(String(err))) as AnyErrorLike
  const errcode = extractErrcode(e)
  const httpStatus = e.httpStatus
  const retryAfterMs = extractRetryAfterMs(e)
  const name = e.name
  const category = e.details?.category

  // 1. AppException funnel — map ErrorType → AppError kind.
  if (err instanceof AppException) {
    return appExceptionToAppError(err, options)
  }

  // 2. Transport-level errors from runtimeFetch.
  if (name === 'TlsError' || category === 'tls_error') {
    return { kind: 'fatal', code: 'TLS_ERROR', message: e.message, correlationId: newCorrelationId() }
  }
  if (
    name === 'NetworkError' ||
    category === 'network_error' ||
    e.message.includes('fetch') ||
    e.message.includes('NetworkError')
  ) {
    return { kind: 'retryable', code: 'NETWORK_ERROR', message: e.message, i18nKey: 'error.matrix.network' }
  }
  if (name === 'TimeoutError' || category === 'timeout') {
    return { kind: 'retryable', code: 'TIMEOUT', message: e.message }
  }
  if (name === 'AbortError' || category === 'abort') {
    return { kind: 'retryable', code: 'ABORT', message: e.message }
  }

  // 3. Matrix-level errcode.

  // BE-7：M_UNKNOWN 按 HTTP 状态消歧（与后端 M_UNKNOWN_MEANINGS 同口径）
  const unknown = resolveUnknownErrcodeSemantics(errcode, httpStatus, e.message)
  if (unknown?.kind === 'validation') return unknown
  if (unknown) return notImplementedError(unknown.message, newCorrelationId())

  if (errcode === 'M_LIMIT_EXCEEDED' || httpStatus === 429) {
    return {
      kind: 'retryable',
      code: 'M_LIMIT_EXCEEDED',
      retryAfterMs,
      message: e.message || 'Rate limited',
      i18nKey: I18N_KEY_MAP['M_LIMIT_EXCEEDED']
    }
  }
  if (errcode && AUTH_ERRCODES.has(errcode)) {
    // `recoverable` 决定 UI 是否引导「重新登录」。凭证缺失/失效类都属可恢复；
    // `M_UNAUTHORIZED`（synapse-rust 的非规范 401 码）同样是「没带/带错 token」，
    // 漏掉它会让用户看到「不可恢复的权限错误」而不是登录引导。
    const recoverable = errcode === 'M_UNKNOWN_TOKEN' || errcode === 'M_MISSING_TOKEN' || errcode === 'M_UNAUTHORIZED'
    return { kind: 'auth', code: errcode, recoverable, message: e.message || errcode, i18nKey: I18N_KEY_MAP[errcode] }
  }
  if (errcode === 'M_NOT_FOUND' || errcode === 'M_THREEPID_NOT_FOUND' || httpStatus === 404) {
    return {
      kind: 'not_found',
      resource: options.resource ?? e.resource ?? 'resource',
      message: e.message || 'Not found',
      i18nKey: errcode ? I18N_KEY_MAP[errcode] : I18N_KEY_MAP['M_NOT_FOUND']
    }
  }
  if (errcode && VALIDATION_ERRCODES.has(errcode)) {
    return {
      kind: 'validation',
      field: options.field ?? e.field,
      code: errcode,
      message: e.message || errcode,
      i18nKey: I18N_KEY_MAP[errcode]
    }
  }

  // 4. HTTP status tail.
  if (httpStatus === 401) {
    return {
      kind: 'auth',
      code: 'UNAUTHORIZED',
      recoverable: true,
      message: e.message || 'Unauthorized',
      i18nKey: I18N_KEY_MAP['M_UNKNOWN_TOKEN']
    }
  }
  if (httpStatus === 403) {
    return {
      kind: 'auth',
      code: 'FORBIDDEN',
      recoverable: false,
      message: e.message || 'Forbidden',
      i18nKey: I18N_KEY_MAP['M_FORBIDDEN']
    }
  }
  if (typeof httpStatus === 'number' && httpStatus >= 500 && httpStatus < 600) {
    return {
      kind: 'retryable',
      code: `HTTP_${httpStatus}`,
      message: e.message || 'Server error',
      i18nKey: 'error.matrix.server_unavailable'
    }
  }

  // 5. Fallback — translate via the legacy translator to still get a sensible
  // recoverability signal, then wrap as fatal with a correlation id so UI can
  // reference it in a support ticket.
  const translated = translateMatrixError(err)
  // `translated.userMessage` 名义上是「用户文案」；只接受白名单内的真实 key，
  // 保证 `i18nKey` 字段恒为可解析的 key（否则留空，展示层回落 `message`）。
  const fallbackI18nKey = FALLBACK_I18N_KEYS.has(translated.userMessage) ? translated.userMessage : undefined
  if (translated.recoverable) {
    return {
      kind: 'retryable',
      code: 'UNKNOWN_RETRYABLE',
      message: e.message || translated.userMessage,
      i18nKey: fallbackI18nKey
    }
  }
  return {
    kind: 'fatal',
    code: errcode || name || 'UNKNOWN',
    message: e.message || translated.userMessage,
    correlationId: newCorrelationId(),
    i18nKey: fallbackI18nKey
  }
}

/**
 * 展示用文案：`i18nKey` 能翻译出「非 key 本身」的文案时优先使用，否则回落 `message`。
 *
 * 纯函数，`translate` 由调用方注入（生产走 vue-i18n 全局 composer），无需挂载 UI 即可测试。
 * 回落条件保证既有展示行为不变：无 `i18nKey`、key 未注册（`translate` 原样回吐 key）、
 * 翻译结果为空串时，展示的仍是原始 `message`。
 *
 * @param err 已分类的应用错误
 * @param translate key → 文案 的翻译函数；key 不存在时必须原样返回 key
 */
export function resolveDisplayMessage(err: AppError, translate: (key: string) => string): string {
  if (err.i18nKey) {
    const localized = translate(err.i18nKey)
    if (localized && localized !== err.i18nKey) return localized
  }
  return err.message
}

function appExceptionToAppError(err: AppException, options: { resource?: string; field?: string }): AppError {
  switch (err.type) {
    case ErrorType.Authentication:
    case ErrorType.TokenExpired:
    case ErrorType.TokenInvalid:
      return {
        kind: 'auth',
        code: err.type,
        recoverable: err.type !== ErrorType.TokenInvalid,
        message: err.message
      }
    case ErrorType.Validation:
      return { kind: 'validation', field: options.field, code: err.type, message: err.message }
    case ErrorType.NotFound:
      return {
        kind: 'not_found',
        resource: options.resource ?? 'resource',
        message: err.message
      }
    case ErrorType.RateLimit:
      return {
        kind: 'retryable',
        code: ErrorType.RateLimit,
        retryAfterMs: (err.details?.retryAfterMs as number | undefined) ?? undefined,
        message: err.message
      }
    case ErrorType.Network:
    case ErrorType.Server:
      return { kind: 'retryable', code: err.type, message: err.message }
    case ErrorType.Permission:
      return { kind: 'auth', code: err.type, recoverable: false, message: err.message }
    default:
      return {
        kind: 'fatal',
        code: err.type,
        message: err.message,
        correlationId: newCorrelationId()
      }
  }
}

export function isRetryable(err: AppError): err is AppErrorRetryable {
  return err.kind === 'retryable'
}

export function isAuthError(err: AppError): err is AppErrorAuth {
  return err.kind === 'auth'
}
