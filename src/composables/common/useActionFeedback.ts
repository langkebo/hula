import type { AppError } from '@/common/errors'
import { getLocalizedMessageFromAppError, resolveErrorMessage } from '@/locales/errors'
import type { AriaLivePoliteness } from './useAriaLive'
import { useAriaLive } from './useAriaLive'

type ActionFeedbackType = 'info' | 'warning' | 'success' | 'error'
type ActionProgressFeedbackType = 'info' | 'loading'
interface ActionFeedbackHandle {
  destroy: () => void
}

const defaultPolitenessByType: Record<ActionFeedbackType, AriaLivePoliteness> = {
  info: 'polite',
  warning: 'assertive',
  success: 'polite',
  error: 'assertive'
}

/** 类型守卫：判断对象是否为已分类的 AppError */
function isAppError(value: unknown): value is AppError {
  if (typeof value !== 'object' || value === null) return false
  const kind = (value as { kind?: unknown }).kind
  return kind === 'auth' || kind === 'validation' || kind === 'not_found' || kind === 'retryable' || kind === 'fatal'
}

export function useActionFeedback() {
  const { announce } = useAriaLive()

  const showFeedback = (
    message: string,
    type: ActionFeedbackType,
    politeness: AriaLivePoliteness = defaultPolitenessByType[type]
  ) => {
    if (!message) {
      return
    }

    window.$message?.[type]?.(message)
    announce(message, politeness)
  }

  /**
   * §9.3.5 展示错误反馈，自动从 errcode 解析中心化文案。
   *
   * @param err errcode 字符串、AppError 或原始 Error 对象
   * @param type 反馈类型，默认 'error'
   */
  const showError = (err: AppError | Error | string, type: ActionFeedbackType = 'error') => {
    let message: string
    if (typeof err === 'string') {
      message = resolveErrorMessage(err)
    } else if (isAppError(err)) {
      message = getLocalizedMessageFromAppError(err)
    } else {
      const errcode = (err as { errcode?: string })?.errcode
      message = errcode ? resolveErrorMessage(errcode) : err.message || resolveErrorMessage('UNKNOWN')
    }
    showFeedback(message, type)
  }

  const showProgressFeedback = (
    message: string,
    type: ActionProgressFeedbackType = 'loading',
    politeness: AriaLivePoliteness = 'polite',
    options?: Record<string, unknown>
  ): ActionFeedbackHandle => {
    if (!message) {
      return {
        destroy: () => {}
      }
    }

    const handle = window.$message?.[type]?.(message, options) as Partial<ActionFeedbackHandle> | undefined
    announce(message, politeness)

    return {
      destroy: () => {
        handle?.destroy?.()
      }
    }
  }

  const clearFeedback = () => {
    window.$message?.destroyAll?.()
  }

  const startLoading = () => {
    window.$loadingBar?.start?.()
  }

  const finishLoading = () => {
    window.$loadingBar?.finish?.()
  }

  const errorLoading = () => {
    window.$loadingBar?.error?.()
  }

  return {
    showFeedback,
    showError,
    showProgressFeedback,
    clearFeedback,
    startLoading,
    finishLoading,
    errorLoading
  }
}
