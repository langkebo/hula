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

export interface ErrorDetails {
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
        showFeedback(message, 'error')
        AppException.hasShownError = true

        // 只有在 2 秒内没有显示过错误消息时才会显示
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
