import { useActionFeedback } from '@/composables/common/useActionFeedback'

export enum ErrorType {
  Network = 'Network',
  Server = 'Server',
  Client = 'Client',
  Validation = 'Validation',
  Authentication = 'Authentication',
  Unknown = 'Unknown',
  TokenExpired = 'TokenExpired',
  TokenInvalid = 'TokenInvalid',
  RateLimit = 'RateLimit',
  Permission = 'Permission',
  NotFound = 'NotFound'
}

interface ErrorDetails {
  type: ErrorType
  code?: number
  details?: Record<string, unknown>
  showError?: boolean
  isRetryError?: boolean
}

const logRetryError = (message: string, details?: Record<string, unknown>) => {
  import('@/utils/Logger').then(({ createLogger }) => {
    const logger = createLogger('AppException')
    logger.info('重试错误:', message, details)
  })
}

const { showFeedback } = useActionFeedback()

export class AppException extends Error {
  public readonly type: ErrorType
  public readonly code?: number
  public readonly details?: Record<string, unknown>
  private static hasShownError = false

  constructor(message: string, errorDetails?: Partial<ErrorDetails>) {
    super(message)
    this.name = 'AppException'
    this.type = errorDetails?.type || ErrorType.Unknown
    this.code = errorDetails?.code
    this.details = errorDetails?.details

    if (errorDetails?.showError && !AppException.hasShownError) {
      if (errorDetails?.isRetryError) {
        logRetryError(message, this.details)
      } else {
        // 先设置标志位再显示反馈，避免同一事件循环中重复弹窗的竞态条件
        AppException.hasShownError = true
        showFeedback(message, 'error')

        // 2 秒内不再显示重复的错误消息
        setTimeout(() => {
          AppException.hasShownError = false
        }, 2000)
      }
    }
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      code: this.code,
      details: this.details
    }
  }
}
