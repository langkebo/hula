/**
 * Matrix SDK 错误处理工具
 *
 * 统一处理 matrix-js-sdk 抛出的各种错误
 */

import { MatrixError } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixErrors')

/**
 * 错误代码映射
 */
export const ErrorCodeMap: Record<string, { message: string; status: number }> = {
  // 认证错误 (4xx)
  M_UNKNOWN_TOKEN: { message: '登录已过期，请重新登录', status: 401 },
  M_MISSING_TOKEN: { message: '缺少访问令牌', status: 401 },
  M_INVALID_TOKEN: { message: '无效的访问令牌', status: 401 },
  M_TOKEN_NOT_YET_VALID: { message: '令牌尚未生效', status: 401 },
  M_TOKEN_EXPIRED: { message: '令牌已过期', status: 401 },

  // 权限错误
  M_FORBIDDEN: { message: '无权限访问', status: 403 },
  M_NEED_UI_AUTH: { message: '需要额外验证', status: 401 },

  // 资源不存在
  M_NOT_FOUND: { message: '内容不存在', status: 404 },
  M_NO_ROOM_KNOWN: { message: '房间不存在', status: 404 },

  // 冲突
  M_ROOM_IN_USE: { message: '房间名称已被使用', status: 409 },
  M_USER_IN_USE: { message: '用户名已被使用', status: 409 },
  M_ROOM_NO_EXITS: { message: '房间已删除', status: 404 },

  // 速率限制
  M_LIMIT_EXCEEDED: { message: '请求过于频繁，请稍后重试', status: 429 },

  // 服务端错误 (5xx)
  M_INTERNAL_SERVER_ERROR: { message: '服务端错误，请稍后重试', status: 500 },
  M_SERVER_NOT_TRUSTED: { message: '服务器不可信', status: 400 },

  // 自定义错误
  NETWORK_ERROR: { message: '网络连接失败', status: 0 },
  TIMEOUT: { message: '请求超时', status: 0 },
  UNKNOWN: { message: '未知错误', status: 0 }
}

/**
 * 应用错误类
 */
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string = 'UNKNOWN',
    public readonly status: number = 0,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }

  static fromMatrixError(error: unknown): AppError {
    if (error instanceof MatrixError) {
      const mapped =
        (error.errcode ? ErrorCodeMap[error.errcode as keyof typeof ErrorCodeMap] : undefined) || ErrorCodeMap.UNKNOWN
      return new AppError(mapped.message, error.errcode, mapped.status, error)
    }

    if (error instanceof TypeError && error.message.includes('network')) {
      return new AppError(ErrorCodeMap.NETWORK_ERROR.message, 'NETWORK_ERROR', ErrorCodeMap.NETWORK_ERROR.status, error)
    }

    return new AppError(ErrorCodeMap.UNKNOWN.message, 'UNKNOWN', ErrorCodeMap.UNKNOWN.status, error)
  }

  static fromFetchError(error: unknown): AppError {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return new AppError(ErrorCodeMap.TIMEOUT.message, 'TIMEOUT', ErrorCodeMap.TIMEOUT.status, error)
      }

      if (error.message.includes('network') || error.message.includes('fetch')) {
        return new AppError(
          ErrorCodeMap.NETWORK_ERROR.message,
          'NETWORK_ERROR',
          ErrorCodeMap.NETWORK_ERROR.status,
          error
        )
      }
    }

    return new AppError(ErrorCodeMap.UNKNOWN.message, 'UNKNOWN', ErrorCodeMap.UNKNOWN.status, error)
  }
}

/**
 * 错误处理 Hook
 */
export function useMatrixErrorHandler() {
  /**
   * 处理错误并返回用户友好的消息
   */
  function handleError(error: unknown): AppError {
    logger.error('Matrix Error', error)

    if (error instanceof AppError) {
      return error
    }

    if (error instanceof MatrixError) {
      return AppError.fromMatrixError(error)
    }

    if (error instanceof Error) {
      return AppError.fromFetchError(error)
    }

    return new AppError(ErrorCodeMap.UNKNOWN.message, 'UNKNOWN', ErrorCodeMap.UNKNOWN.status, error)
  }

  /**
   * 判断是否为认证错误
   */
  function isAuthError(error: unknown): boolean {
    const appError = handleError(error)
    return appError.status === 401
  }

  /**
   * 判断是否为网络错误
   */
  function isNetworkError(error: unknown): boolean {
    const appError = handleError(error)
    return appError.code === 'NETWORK_ERROR' || appError.code === 'TIMEOUT'
  }

  /**
   * 判断是否为速率限制
   */
  function isRateLimitError(error: unknown): boolean {
    const appError = handleError(error)
    return appError.code === 'M_LIMIT_EXCEEDED'
  }

  return {
    handleError,
    isAuthError,
    isNetworkError,
    isRateLimitError
  }
}

/**
 * 全局错误处理器
 */
export const globalErrorHandlers: ((error: AppError) => void)[] = []

/**
 * 注册全局错误处理器
 */
export function registerGlobalErrorHandler(handler: (error: AppError) => void) {
  globalErrorHandlers.push(handler)
}

/**
 * 触发全局错误处理
 */
export function notifyGlobalError(error: AppError) {
  globalErrorHandlers.forEach((handler) => {
    try {
      handler(error)
    } catch (e) {
      logger.error('Global Error Handler Error', e)
    }
  })
}
