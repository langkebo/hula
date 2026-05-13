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

export type AppErrorAuth = {
  kind: 'auth'
  code: string
  recoverable: boolean
  message: string
  i18nKey?: string
}

export type AppErrorValidation = {
  kind: 'validation'
  field?: string
  code: string
  message: string
  i18nKey?: string
}

export type AppErrorNotFound = {
  kind: 'not_found'
  resource: string
  message: string
  i18nKey?: string
}

export type AppErrorRetryable = {
  kind: 'retryable'
  retryAfterMs?: number
  message: string
  /** Source code (M_LIMIT_EXCEEDED, NetworkError, TimeoutError, …) for telemetry. */
  code?: string
  i18nKey?: string
}

export type AppErrorFatal = {
  kind: 'fatal'
  code: string
  message: string
  correlationId: string
  i18nKey?: string
}

export type AppError = AppErrorAuth | AppErrorValidation | AppErrorNotFound | AppErrorRetryable | AppErrorFatal

const AUTH_ERRCODES = new Set(['M_UNKNOWN_TOKEN', 'M_MISSING_TOKEN', 'M_FORBIDDEN', 'M_GUEST_ACCESS_FORBIDDEN'])
const VALIDATION_ERRCODES = new Set([
  'M_BAD_JSON',
  'M_NOT_JSON',
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
  M_LIMIT_EXCEEDED: 'error.matrix.rate_limited',
  M_NOT_FOUND: 'error.matrix.not_found',
  M_BAD_JSON: 'error.matrix.bad_request',
  M_NOT_JSON: 'error.matrix.bad_request',
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
    const recoverable = errcode === 'M_UNKNOWN_TOKEN' || errcode === 'M_MISSING_TOKEN'
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
  if (translated.recoverable) {
    return {
      kind: 'retryable',
      code: 'UNKNOWN_RETRYABLE',
      message: e.message || translated.userMessage,
      i18nKey: translated.userMessage
    }
  }
  return {
    kind: 'fatal',
    code: errcode || name || 'UNKNOWN',
    message: e.message || translated.userMessage,
    correlationId: newCorrelationId(),
    i18nKey: translated.userMessage
  }
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
