import type { AppError } from '@/common/errors'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('sdk-errors')

type MatrixSdkError = Error & {
  errcode?: string
  httpStatus?: number
  data?: { errcode?: string; retry_after_ms?: number }
  name?: string
}

function newCorrelationId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch (err) {
    logger.warn('SDK error classification failed:', err)
  }
  return `corr-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

/**
 * @deprecated Use `toAppError()` from `@/common/errors` instead. This function will be removed in a future version.
 */
export function normalizeSdkError(err: unknown): AppError {
  if (!err || typeof err !== 'object') {
    return { kind: 'fatal', code: 'UNKNOWN', message: String(err), correlationId: newCorrelationId() }
  }

  const sdkErr = err as MatrixSdkError
  const errcode = getSdkErrorCode(err)
  const httpStatus = sdkErr.httpStatus
  const message = sdkErr.message || String(err)

  if (sdkErr.name === 'NetworkError' || message.includes('fetch')) {
    return { kind: 'retryable', code: 'NETWORK_ERROR', message }
  }

  if (errcode === 'M_LIMIT_EXCEEDED' || httpStatus === 429) {
    return {
      kind: 'retryable',
      code: 'RATE_LIMITED',
      message,
      retryAfterMs: sdkErr.data?.retry_after_ms
    }
  }

  if (httpStatus && httpStatus >= 500) {
    return { kind: 'retryable', code: 'SERVER_ERROR', message }
  }

  if (errcode === 'M_UNKNOWN_TOKEN' || errcode === 'M_MISSING_TOKEN' || httpStatus === 401) {
    return { kind: 'auth', code: 'TOKEN_EXPIRED', message, recoverable: false }
  }

  if (errcode === 'M_FORBIDDEN' || httpStatus === 403) {
    return { kind: 'auth', code: 'FORBIDDEN', message, recoverable: false }
  }

  if (errcode === 'M_NOT_FOUND' || httpStatus === 404) {
    return { kind: 'fatal', code: 'NOT_FOUND', message, correlationId: newCorrelationId() }
  }

  return { kind: 'fatal', code: errcode || 'UNKNOWN', message, correlationId: newCorrelationId() }
}

export function getSdkErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined
  const sdkErr = err as MatrixSdkError
  return sdkErr.errcode || sdkErr.data?.errcode
}

export function attachAppError(err: Error): Error {
  if (!err || typeof err !== 'object') return err

  const existing = Object.getOwnPropertyDescriptor(err, 'appError')
  if (existing && existing.value !== undefined) return err

  const appError = normalizeSdkError(err)
  Object.defineProperty(err, 'appError', {
    value: appError,
    enumerable: false,
    writable: false,
    configurable: true
  })

  return err
}

export function isRetryableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const appError = (err as Record<string, unknown>).appError as AppError | undefined
  if (appError) {
    if (appError.kind === 'retryable') return true
    if (appError.kind === 'auth') return appError.recoverable
    return false
  }
  const normalized = normalizeSdkError(err)
  if (normalized.kind === 'retryable') return true
  if (normalized.kind === 'auth') return normalized.recoverable
  return false
}
