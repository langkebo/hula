import { ref, computed } from 'vue'
import { useMessage } from 'naive-ui'

export type ErrorLevel = 'info' | 'warning' | 'error' | 'success'

export interface ErrorLog {
  id: string
  message: string
  level: ErrorLevel
  timestamp: number
  context?: string
  stack?: string
}

/**
 * 全局错误日志存储
 */
const errorLogs = ref<ErrorLog[]>([])

/**
 * Error Handling Composable
 * 提供统一的错误处理、错误日志和用户通知功能
 */
export function useErrorHandler() {
  const message = useMessage()

  // 生成唯一 ID
  const generateId = () => `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 记录错误
  const logError = (message: string, level: ErrorLevel = 'error', context?: string, stack?: string): string => {
    const id = generateId()
    const errorLog: ErrorLog = {
      id,
      message,
      level,
      timestamp: Date.now(),
      context,
      stack
    }
    errorLogs.value.unshift(errorLog) // 最新错误放在前面

    // 限制日志数量，防止内存溢出
    if (errorLogs.value.length > 100) {
      errorLogs.value = errorLogs.value.slice(0, 100)
    }

    return id
  }

  // 清理指定错误
  const clearError = (id: string) => {
    errorLogs.value = errorLogs.value.filter((log) => log.id !== id)
  }

  // 清理所有错误
  const clearAllErrors = () => {
    errorLogs.value = []
  }

  // 获取错误日志
  const getErrorLogs = computed(() => errorLogs.value)

  // 获取错误数量
  const errorCount = computed(() => errorLogs.value.length)

  // 显示错误消息给用户
  const notifyError = (msg: string, duration = 5000) => {
    message.error(msg, { duration })
    logError(msg, 'error')
  }

  const notifyWarning = (msg: string, duration = 4000) => {
    message.warning(msg, { duration })
    logError(msg, 'warning')
  }

  const notifySuccess = (msg: string, duration = 3000) => {
    message.success(msg, { duration })
  }

  const notifyInfo = (msg: string, duration = 3000) => {
    message.info(msg, { duration })
  }

  // 统一处理 API 错误
  const handleApiError = async <T>(
    promise: Promise<T>,
    options: {
      errorMsg?: string
      context?: string
      onError?: (error: any) => void
    } = {}
  ): Promise<[T | null, Error | null]> => {
    const { errorMsg = '操作失败，请稍后重试', context, onError } = options

    try {
      const data = await promise
      return [data, null]
    } catch (error: any) {
      const errorMessage = errorMsg || error?.message || '未知错误'
      notifyError(errorMessage)
      logError(errorMessage, 'error', context, error?.stack)

      if (onError) {
        onError(error)
      }

      return [null, error as Error]
    }
  }

  // 全局错误捕获 handler（用于 window.onerror）
  const createGlobalErrorHandler = (context?: string) => {
    return (message: string, source?: string, lineno?: number, colno?: number, error?: Error) => {
      const errorMsg = `${message} at ${source}:${lineno}:${colno}`
      logError(errorMsg, 'error', context, error?.stack)
      return false // 不阻止默认错误处理
    }
  }

  // Promise rejection handler
  const createUnhandledRejectionHandler = (context?: string) => {
    return (reason: any) => {
      const errorMsg = reason?.message || String(reason)
      logError(errorMsg, 'error', context, reason?.stack)
    }
  }

  // 组件错误捕获
  const createVueErrorHandler = (context?: string) => {
    return (err: Error, _instance: any, info: string) => {
      const errorMsg = `${err.message} | Info: ${info}`
      logError(errorMsg, 'error', context, err.stack)
      notifyError('应用发生错误，请刷新页面')
    }
  }

  return {
    errorLogs,
    errorCount,
    logError,
    clearError,
    clearAllErrors,
    getErrorLogs,
    notifyError,
    notifyWarning,
    notifySuccess,
    notifyInfo,
    handleApiError,
    createGlobalErrorHandler,
    createUnhandledRejectionHandler,
    createVueErrorHandler
  }
}
