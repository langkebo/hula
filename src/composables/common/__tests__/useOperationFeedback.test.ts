import { beforeEach, describe, expect, it, vi } from 'vitest'

const showFeedbackMock = vi.fn()
const translateMatrixErrorMock = vi.fn()

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('@/common/matrixErrorTranslator', () => ({
  translateMatrixError: (error: unknown) => translateMatrixErrorMock(error)
}))

import { useOperationFeedback } from '../useOperationFeedback'

describe('useOperationFeedback', () => {
  beforeEach(() => {
    showFeedbackMock.mockReset()
    translateMatrixErrorMock.mockReset()
  })

  it('权限类错误使用专用文案', () => {
    translateMatrixErrorMock.mockReturnValue({ userMessage: 'error.matrix.forbidden' })

    useOperationFeedback().reportFailure(new Error('forbidden'))

    expect(showFeedbackMock).toHaveBeenCalledWith('error.matrix.forbidden', 'error')
  })

  it('无法识别的错误回落到调用方兜底文案', () => {
    translateMatrixErrorMock.mockReturnValue({ userMessage: 'error.matrix.unknown' })

    useOperationFeedback().reportFailure(new Error('boom'), 'common.load_failed')

    expect(showFeedbackMock).toHaveBeenCalledWith('common.load_failed', 'error')
  })

  it('默认兜底文案为通用操作失败', () => {
    translateMatrixErrorMock.mockReturnValue({ userMessage: 'error.matrix.unknown' })

    useOperationFeedback().reportFailure(new Error('boom'))

    expect(showFeedbackMock).toHaveBeenCalledWith('common.error', 'error')
  })
})
