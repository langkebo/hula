import { createLogger } from '@/utils/Logger'

/**
 * MatrixAuth 模块共享 logger。所有 auth 子模块通过此 logger 输出日志，
 * 便于测试统一断言（vi.mock('@/utils/Logger') 后所有调用都落到同一 loggerSpy）。
 */
export const logger = createLogger('MatrixAuth')

/**
 * 将 Matrix errcode 翻译为可读的中文提示。未知 errcode 返回空字符串。
 */
export function getMatrixErrorHint(errcode: string): string {
  switch (errcode) {
    case 'M_FORBIDDEN':
      return '认证信息无效或当前操作无权限'
    case 'M_USER_IN_USE':
      return '用户名已被占用'
    case 'M_INVALID_USERNAME':
      return '用户名格式无效'
    case 'M_THREEPID_IN_USE':
      return '邮箱已被使用'
    case 'M_THREEPID_NOT_FOUND':
      return '邮箱未绑定账号'
    case 'M_MISSING_PARAM':
      return '请求缺少必要参数'
    case 'M_INVALID_PARAM':
      return '请求参数无效'
    case 'M_INVALID_EMAIL':
      return '邮箱格式无效'
    case 'M_BAD_JSON':
      return '请求体格式无效'
    case 'M_LIMIT_EXCEEDED':
      return '请求过于频繁，请稍后重试'
    case 'M_SESSION_NOT_FOUND':
      return '验证会话不存在或已失效'
    case 'M_TOKEN_EXPIRED':
      return '验证码已过期'
    case 'M_TOKEN_ALREADY_USED':
      return '验证码已被使用'
    default:
      return ''
  }
}

/**
 * 将 homeserver 返回的原始响应体文本格式化为可读错误描述。
 * 优先解析 JSON 中的 error/errcode 字段，无法解析时回退为原始文本。
 */
export function formatMatrixErrorDetail(text: string): string {
  if (!text) {
    return ''
  }

  try {
    const parsed = JSON.parse(text) as {
      error?: unknown
      errcode?: unknown
    }
    const errorMessage = typeof parsed.error === 'string' ? parsed.error : ''
    const errorCode = typeof parsed.errcode === 'string' ? parsed.errcode : ''
    const errorHint = errorCode ? getMatrixErrorHint(errorCode) : ''

    if (errorMessage && errorCode && errorHint) {
      return `${errorMessage} [${errorCode}] (${errorHint})`
    }
    if (errorMessage && errorCode) {
      return `${errorMessage} [${errorCode}]`
    }
    if (errorMessage) {
      return errorMessage
    }
    if (errorCode && errorHint) {
      return `[${errorCode}] (${errorHint})`
    }
    if (errorCode) {
      return `[${errorCode}]`
    }
  } catch {
    // Fall back to the raw response body when the homeserver does not return Matrix JSON.
  }

  return text
}

/**
 * 将 SDK/HTTP 抛出的任意错误归一化为带 failureLabel 前缀的 Error。
 * 提取 Matrix 错误的 errcode/error/httpStatus 字段并翻译为可读描述。
 */
export function normalizeSdkMatrixError(error: unknown, failureLabel: string): Error {
  if (!(error instanceof Error)) {
    return new Error(failureLabel)
  }

  const matrixError = error as Error & {
    errcode?: unknown
    error?: unknown
    httpStatus?: unknown
  }

  const errorCode = typeof matrixError.errcode === 'string' ? matrixError.errcode : ''
  const errorMessage = typeof matrixError.error === 'string' ? matrixError.error : error.message
  const status = typeof matrixError.httpStatus === 'number' ? matrixError.httpStatus : undefined
  const detail = formatMatrixErrorDetail(
    JSON.stringify({
      errcode: errorCode || undefined,
      error: errorMessage || undefined
    })
  )

  if (status) {
    return new Error(`${failureLabel} (${status}): ${detail}`)
  }

  return new Error(`${failureLabel}: ${detail}`)
}
