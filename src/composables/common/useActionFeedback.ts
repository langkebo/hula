import type { AriaLivePoliteness } from './useAriaLive'
import { useAriaLive } from './useAriaLive'

export type ActionFeedbackType = 'info' | 'warning' | 'success' | 'error'
export type ActionProgressFeedbackType = 'info' | 'loading'
export interface ActionFeedbackHandle {
  destroy: () => void
}

const defaultPolitenessByType: Record<ActionFeedbackType, AriaLivePoliteness> = {
  info: 'polite',
  warning: 'assertive',
  success: 'polite',
  error: 'assertive'
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

  return {
    showFeedback,
    showProgressFeedback,
    clearFeedback
  }
}
