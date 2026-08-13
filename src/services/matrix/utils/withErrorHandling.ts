import { type AppError, type AppErrorAuth, isAuthError, isRetryable, toAppError } from '@/common/errors'
import { useActionFeedback } from '@/composables/common/useActionFeedback'

interface ErrorHandlingOptions {
  feature: string
  retryable?: (err: AppError) => boolean
  feedback?: 'toast' | 'silent' | 'banner'
  maxRetries?: number
  retryDelayMs?: number
  onAuthError?: (err: AppErrorAuth) => void
}

const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resolveFeedbackMessage(appError: AppError): string {
  return appError.message || appError.kind
}

/** 包装函数并添加统一错误处理
 */
export async function withErrorHandling<T>(op: () => Promise<T>, opts: ErrorHandlingOptions): Promise<T | undefined> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES
  const retryDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  const feedbackMode = opts.feedback ?? 'toast'
  const { showFeedback } = useActionFeedback()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await op()
    } catch (err) {
      const appError = toAppError(err)

      // Auth errors: no retry, delegate to caller's callback
      if (isAuthError(appError)) {
        opts.onAuthError?.(appError)
        return undefined
      }

      const shouldRetry = attempt < maxRetries && (opts.retryable ? opts.retryable(appError) : isRetryable(appError))
      if (!shouldRetry) {
        if (feedbackMode === 'toast') {
          showFeedback(resolveFeedbackMessage(appError), 'error', 'assertive')
        }
        return undefined
      }
      if (retryDelayMs > 0) {
        await sleep(retryDelayMs)
      }
    }
  }
  return undefined
}
