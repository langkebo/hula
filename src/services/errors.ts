export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public isRetryable: boolean = false
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export class ServiceErrorCode {
  static readonly NETWORK_ERROR = 'NETWORK_ERROR'
  static readonly TIMEOUT = 'TIMEOUT'
  static readonly UNAUTHORIZED = 'UNAUTHORIZED'
  static readonly NOT_FOUND = 'NOT_FOUND'
  static readonly SERVER_ERROR = 'SERVER_ERROR'
  static readonly VALIDATION_ERROR = 'VALIDATION_ERROR'
  static readonly UNKNOWN = 'UNKNOWN'
}

export interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: ServiceError
}

export async function withServiceError<T>(
  operation: () => Promise<T>,
  options?: {
    errorCode?: string
    isRetryable?: boolean
    context?: string
  }
): Promise<ServiceResult<T>> {
  try {
    const data = await operation()
    return { success: true, data }
  } catch (err) {
    const error = err as Error
    const serviceError = new ServiceError(
      options?.context ? `${options.context}: ${error.message}` : error.message,
      options?.errorCode || ServiceErrorCode.UNKNOWN,
      undefined,
      options?.isRetryable || false
    )
    return { success: false, error: serviceError }
  }
}

export function isServiceError(err: unknown): err is ServiceError {
  return err instanceof ServiceError
}
