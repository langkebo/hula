import { MatrixError } from 'matrix-js-sdk'
import { error as logError } from '@tauri-apps/plugin-log'

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = 0,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string, cause?: unknown) {
    super('M_NOT_FOUND', message, 404, cause)
    this.name = 'NotFoundError'
  }
}

export class AuthError extends ApiError {
  constructor(message: string, cause?: unknown) {
    super('M_UNKNOWN_TOKEN', message, 401, cause)
    this.name = 'AuthError'
  }
}

export class RetryableError extends ApiError {
  constructor(message: string, cause?: unknown) {
    super('RETRYABLE', message, 0, cause)
    this.name = 'RetryableError'
  }
}

export abstract class BaseManager {
  protected normalizeError(error: unknown, operation: string): ApiError {
    if (error instanceof ApiError) {
      return error
    }
    if (error instanceof MatrixError) {
      const httpStatus = (error as any).httpStatus ?? (error as any).http_status ?? 0
      const errcode = (error as any).errcode ?? 'UNKNOWN'
      if (httpStatus === 401 || errcode === 'M_UNKNOWN_TOKEN') {
        return new AuthError(`${operation} failed: ${error.message}`, error)
      }
      if (httpStatus === 404 || errcode === 'M_NOT_FOUND') {
        return new NotFoundError(`${operation} failed: ${error.message}`, error)
      }
      return new ApiError(errcode, `${operation} failed: ${error.message}`, httpStatus, error)
    }
    if (error instanceof Error) {
      if (this.isRetryableError(error)) {
        return new RetryableError(`${operation} failed: ${error.message}`, error)
      }
      return new ApiError('UNKNOWN', `${operation} failed: ${error.message}`, 0, error)
    }
    return new ApiError('UNKNOWN', `${operation} failed: ${String(error)}`, 0, error)
  }

  protected handleError<T>(error: unknown, operation: string, defaultValue: T, throwOnError: boolean): T {
    const normalizedError = this.normalizeError(error, operation)

    if (throwOnError) {
      throw normalizedError
    }

    logError(`[${this.constructor.name}] ${operation} failed: ${normalizedError.message}`)
    return defaultValue
  }

  private isRetryableError(error: Error): boolean {
    const retryableMessages = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'network', 'timeout', 'abort']
    const message = error.message.toLowerCase()
    return retryableMessages.some((msg) => message.includes(msg.toLowerCase()))
  }
}
