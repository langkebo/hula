import { translateMatrixError } from '@/common/matrixErrorTranslator'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useI18nGlobal } from '@/services/i18n'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('OperationFeedback')

/**
 * 写操作统一用户反馈：失败必须让用户看到结果，而不是只写日志。
 * Matrix 错误按 errcode 映射（M_FORBIDDEN 已有权限专用文案），
 * 无法识别的错误回落到调用方提供的兜底文案。
 */
export function useOperationFeedback() {
  const { showFeedback } = useActionFeedback()
  const { t } = useI18nGlobal()

  const reportFailure = (error: unknown, fallbackKey = 'common.error') => {
    logger.error('操作失败:', error)
    const { userMessage } = translateMatrixError(error)
    if (userMessage !== 'error.matrix.unknown') {
      showFeedback(t(userMessage), 'error')
      return
    }
    showFeedback(t(fallbackKey), 'error')
  }

  return { reportFailure }
}
