/**
 * 全局错误处理工具
 * 提供统一的错误处理和上报机制
 */

import { AppException, ErrorType } from './exception'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('GlobalErrorHandler')

// 错误回调类型
type ErrorCallback = (error: Error, context?: Record<string, unknown>) => void

// 全局错误处理器
class GlobalErrorHandler {
  private static instance: GlobalErrorHandler
  private errorCallbacks: ErrorCallback[] = []
  private isHandling = false

  private constructor() {
    this.init()
  }

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler()
    }
    return GlobalErrorHandler.instance
  }

  private init() {
    // 监听未处理的 Promise 拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, { type: 'unhandledrejection' })
    })

    // 监听全局错误
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message), {
        type: 'global',
        filename: event.filename,
        lineno: event.lineno
      })
    })
  }

  /**
   * 注册错误回调
   */
  public onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback)
    // 返回取消注册的函数
    return () => {
      const index = this.errorCallbacks.indexOf(callback)
      if (index > -1) {
        this.errorCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * 处理错误
   */
  public handleError(error: unknown, context?: Record<string, unknown>): void {
    // 防止重复处理
    if (this.isHandling) return
    this.isHandling = true

    try {
      // 转换为标准错误对象
      let standardError: Error
      if (error instanceof Error) {
        standardError = error
      } else if (error instanceof AppException) {
        standardError = error
      } else {
        standardError = new Error(String(error))
      }

      logger.error(standardError.message, context)

      this.errorCallbacks.forEach((callback) => {
        try {
          callback(standardError, context)
        } catch (callbackError) {
          logger.error('回调执行失败:', callbackError)
        }
      })
    } finally {
      this.isHandling = false
    }
  }

  /**
   * 创建业务错误
   */
  public createError(
    message: string,
    type: ErrorType,
    options?: {
      code?: number
      details?: Record<string, unknown>
      showError?: boolean
    }
  ): AppException {
    return new AppException(message, {
      type,
      code: options?.code,
      details: options?.details,
      showError: options?.showError ?? false
    })
  }
}

// 导出单例
export const globalErrorHandler = GlobalErrorHandler.getInstance()

// 便捷函数：创建各类错误
export const createValidationError = (message: string, details?: Record<string, unknown>) =>
  globalErrorHandler.createError(message, ErrorType.Validation, { details, showError: true })

export const createNetworkError = (message: string, details?: Record<string, unknown>) =>
  globalErrorHandler.createError(message, ErrorType.Network, { details })

export const createAuthError = (message: string, details?: Record<string, unknown>) =>
  globalErrorHandler.createError(message, ErrorType.Authentication, { details, showError: true })

export const createServerError = (message: string, code?: number, details?: Record<string, unknown>) =>
  globalErrorHandler.createError(message, ErrorType.Server, { code, details })

export const createRateLimitError = (message: string, details?: Record<string, unknown>) =>
  globalErrorHandler.createError(message, ErrorType.RateLimit, { details, showError: true })
