/**
 * 统一错误处理 Composable
 * 提供统一的错误处理、日志记录和用户提示
 */
import { logger } from '@/utils/Logger'

export interface ErrorHandlerOptions {
  /** 是否显示用户提示 */
  showMessage?: boolean
  /** 是否记录日志 */
  logError?: boolean
  /** 是否上报错误 */
  reportError?: boolean
  /** 自定义错误消息前缀 */
  prefix?: string
}

const DEFAULT_OPTIONS: Required<ErrorHandlerOptions> = {
  showMessage: true,
  logError: true,
  reportError: false,
  prefix: ''
}

/**
 * 获取错误消息文本
 */
function getErrorText(error: unknown, prefix: string): string {
  let errorMessage: string
  if (error instanceof Error) {
    errorMessage = error.message
  } else if (typeof error === 'string') {
    errorMessage = error
  } else {
    errorMessage = String(error)
  }
  return prefix ? `${prefix}: ${errorMessage}` : errorMessage
}

/**
 * 统一错误处理 hook
 * @param defaultOptions 默认选项
 */
export function useErrorHandler(defaultOptions?: ErrorHandlerOptions) {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...defaultOptions }

  /**
   * 处理错误
   * @param error 错误对象
   * @param context 错误上下文/描述
   * @param options 额外选项
   */
  function handleError(error: unknown, context: string, options?: ErrorHandlerOptions): void {
    const opts = { ...mergedOptions, ...options }
    const _prefix = opts.prefix || context
    const errorText = getErrorText(error, '')

    // 1. 记录日志
    if (opts.logError) {
      logger.error(`[${context}]`, error)
    }

    // 2. 显示用户提示
    if (opts.showMessage) {
      window.$message?.error(errorText)
    }

    // 3. 上报错误（可选）
    if (opts.reportError) {
      // TODO: 接入错误上报服务
      // reportError(error, { context, ...opts })
    }
  }

  /**
   * 异步错误处理包装器
   * 用于包装 async 函数，自动捕获并处理错误
   * @param fn 要包装的异步函数
   * @param context 错误上下文
   * @param options 错误处理选项
   */
  function withErrorHandler<T>(
    fn: (...args: unknown[]) => Promise<T>,
    context: string,
    options?: ErrorHandlerOptions
  ): (...args: unknown[]) => Promise<T | undefined> {
    return async (...args: unknown[]): Promise<T | undefined> => {
      try {
        return await fn(...args)
      } catch (error) {
        handleError(error, context, options)
        return undefined
      }
    }
  }

  /**
   * 同步错误处理包装器
   * 用于包装可能抛出异常的同步函数
   * @param fn 要包装的函数
   * @param context 错误上下文
   * @param options 错误处理选项
   */
  function withErrorHandlerSync<T>(
    fn: (...args: unknown[]) => T,
    context: string,
    options?: ErrorHandlerOptions
  ): (...args: unknown[]) => T | undefined {
    return (...args: unknown[]): T | undefined => {
      try {
        return fn(...args)
      } catch (error) {
        handleError(error, context, options)
        return undefined
      }
    }
  }

  /**
   * 试运行函数，忽略错误
   * @param fn 要运行的函数
   * @param errorHandler 可选的自定义错误处理
   */
  function tryRun(fn: () => void, errorHandler?: (error: unknown) => void): void {
    try {
      fn()
    } catch (error) {
      if (errorHandler) {
        errorHandler(error)
      } else {
        logger.warn('[tryRun] Error ignored:', error)
      }
    }
  }

  /**
   * 异步试运行函数，忽略错误
   * @param fn 要运行的异步函数
   * @param errorHandler 可选的自定义错误处理
   */
  async function tryRunAsync<T>(fn: () => Promise<T>, errorHandler?: (error: unknown) => void): Promise<T | undefined> {
    try {
      return await fn()
    } catch (error) {
      if (errorHandler) {
        errorHandler(error)
      } else {
        logger.warn('[tryRunAsync] Error ignored:', error)
      }
      return undefined
    }
  }

  return {
    handleError,
    withErrorHandler,
    withErrorHandlerSync,
    tryRun,
    tryRunAsync
  }
}

/**
 * 全局错误处理实例 - 带默认配置
 * 默认显示错误消息并记录日志
 */
export const globalErrorHandler = useErrorHandler({
  showMessage: true,
  logError: true,
  reportError: false
})

// 导出便捷方法
export const { handleError, withErrorHandler, withErrorHandlerSync, tryRun, tryRunAsync } = globalErrorHandler
