import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixErrorTranslator')

/**
 * @deprecated Use `AppError` from `@/common/errors` instead. This interface will be removed in a future version.
 */
export interface TranslatedError {
  userMessage: string
  level: 'toast' | 'dialog' | 'page'
  recoverable: boolean
  action?: 'retry' | 'relogin' | 'check_network' | 'none'
  retryAfterMs?: number
}

export type MatrixErrorTranslationContext = 'default' | 'login'

const ERROR_MAP: Record<string, TranslatedError> = {
  M_FORBIDDEN: {
    userMessage: 'error.matrix.forbidden',
    level: 'toast',
    recoverable: false,
    action: 'none'
  },
  M_UNKNOWN_TOKEN: {
    userMessage: 'error.matrix.unknown_token',
    level: 'dialog',
    recoverable: true,
    action: 'relogin'
  },
  M_MISSING_TOKEN: {
    userMessage: 'error.matrix.missing_token',
    level: 'dialog',
    recoverable: true,
    action: 'relogin'
  },
  M_LIMIT_EXCEEDED: {
    userMessage: 'error.matrix.rate_limited',
    level: 'toast',
    recoverable: true,
    action: 'retry',
    retryAfterMs: 5000
  },
  M_NOT_FOUND: {
    userMessage: 'error.matrix.not_found',
    level: 'toast',
    recoverable: false,
    action: 'none'
  },
  M_BAD_JSON: {
    userMessage: 'error.matrix.bad_request',
    level: 'toast',
    recoverable: false,
    action: 'none'
  },
  M_NOT_JSON: {
    userMessage: 'error.matrix.bad_request',
    level: 'toast',
    recoverable: false,
    action: 'none'
  },
  M_USER_IN_USE: {
    userMessage: 'error.matrix.user_in_use',
    level: 'toast',
    recoverable: false,
    action: 'none'
  },
  M_INVALID_USERNAME: {
    userMessage: 'error.matrix.invalid_username',
    level: 'toast',
    recoverable: false,
    action: 'none'
  },
  M_WEAK_PASSWORD: {
    userMessage: 'error.matrix.weak_password',
    level: 'toast',
    recoverable: false,
    action: 'none'
  },
  M_EXCLUSIVE: {
    userMessage: 'error.matrix.exclusive',
    level: 'toast',
    recoverable: false,
    action: 'none'
  },
  M_GUEST_ACCESS_FORBIDDEN: {
    userMessage: 'error.matrix.guest_forbidden',
    level: 'dialog',
    recoverable: false,
    action: 'relogin'
  },
  FRIEND_ALREADY_EXISTS: {
    userMessage: 'error.matrix.friend_exists',
    level: 'toast',
    recoverable: false,
    action: 'none'
  },
  FRIEND_REQUEST_PENDING: {
    userMessage: 'error.matrix.friend_pending',
    level: 'toast',
    recoverable: false,
    action: 'none'
  }
}

const NETWORK_ERROR: TranslatedError = {
  userMessage: 'error.matrix.network',
  level: 'toast',
  recoverable: true,
  action: 'check_network'
}

const UNKNOWN_ERROR: TranslatedError = {
  userMessage: 'error.matrix.unknown',
  level: 'toast',
  recoverable: false,
  action: 'none'
}

const LOGIN_FORBIDDEN_ERROR: TranslatedError = {
  userMessage: 'error.matrix.invalid_credentials',
  level: 'toast',
  recoverable: false,
  action: 'none'
}

/**
 * @deprecated Use `toAppError()` from `@/common/errors` instead. This function will be removed in a future version.
 */
export function translateMatrixError(
  err: unknown,
  options: { context?: MatrixErrorTranslationContext } = {}
): TranslatedError {
  if (!err) return UNKNOWN_ERROR

  if (err instanceof TypeError && err.message.includes('fetch')) {
    return NETWORK_ERROR
  }

  if (err instanceof Error && err.message.includes('NetworkError')) {
    return NETWORK_ERROR
  }

  const errObj = err as Record<string, unknown>

  const errcode = (errObj.errcode as string) || (errObj.code as string) || ''
  if (options.context === 'login' && errcode === 'M_FORBIDDEN') {
    return LOGIN_FORBIDDEN_ERROR
  }

  if (errcode && ERROR_MAP[errcode]) {
    const translated = { ...ERROR_MAP[errcode] }
    if (errcode === 'M_LIMIT_EXCEEDED') {
      const retryMs = (errObj.retry_after_ms as number) || (errObj.retry_after as number)
      if (retryMs) {
        translated.retryAfterMs = retryMs
      }
    }
    return translated
  }

  const httpStatus = errObj.httpStatus as number | undefined
  if (httpStatus) {
    switch (httpStatus) {
      case 401:
        return ERROR_MAP.M_UNKNOWN_TOKEN
      case 403:
        if (options.context === 'login') {
          return LOGIN_FORBIDDEN_ERROR
        }
        return ERROR_MAP.M_FORBIDDEN
      case 404:
        return ERROR_MAP.M_NOT_FOUND
      case 429:
        return ERROR_MAP.M_LIMIT_EXCEEDED
      case 502:
      case 503:
      case 504:
        return { ...NETWORK_ERROR, userMessage: 'error.matrix.server_unavailable' }
    }
  }

  logger.warn('未识别的 Matrix 错误:', err)
  return UNKNOWN_ERROR
}

/**
 * @deprecated Use `isRetryable()` from `@/common/errors` instead.
 */
export function isRecoverableError(err: unknown): boolean {
  return translateMatrixError(err).recoverable
}

/**
 * @deprecated Use `toAppError()` and inspect the resulting `AppError` directly.
 */
export function getErrorAction(err: unknown): TranslatedError['action'] {
  return translateMatrixError(err).action
}

/**
 * 将任意错误格式化为简短可读字符串, 主要用于日志输出。
 * 优先使用 errcode + error 字段, 回退到 message / String(err)。
 */
export function formatMatrixError(err: unknown): string {
  if (!err) return 'unknown error'
  if (typeof err === 'string') return err
  if (err instanceof Error) {
    const errObj = err as Error & { errcode?: string; data?: { error?: string } }
    if (errObj.errcode) {
      const detail = errObj.data?.error ?? errObj.message
      return detail ? `${errObj.errcode}: ${detail}` : errObj.errcode
    }
    return err.message
  }
  if (typeof err === 'object') {
    const obj = err as { errcode?: string; error?: string; message?: string }
    if (obj.errcode) return obj.error ? `${obj.errcode}: ${obj.error}` : obj.errcode
    if (obj.message) return obj.message
    if (obj.error) return obj.error
  }
  return String(err)
}
