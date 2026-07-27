import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppError } from '@/common/errors'
import { useActionFeedback } from '@/composables/common/useActionFeedback'

const announceMock = vi.hoisted(() => vi.fn())
const destroyMock = vi.hoisted(() => vi.fn())

vi.mock('@/composables/common/useAriaLive', () => ({
  useAriaLive: () => ({
    announce: announceMock
  })
}))

describe('useActionFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as any).$message = {
      info: vi.fn(),
      loading: vi.fn(() => ({ destroy: destroyMock })),
      warning: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      destroyAll: vi.fn()
    }
  })

  it('shows toast and announces with type-based default politeness', () => {
    const { showFeedback } = useActionFeedback()

    showFeedback('saved', 'success')
    showFeedback('failed', 'error')
    showFeedback('warn', 'warning')
    showFeedback('info', 'info')

    expect(window.$message.success).toHaveBeenCalledWith('saved')
    expect(window.$message.error).toHaveBeenCalledWith('failed')
    expect(window.$message.warning).toHaveBeenCalledWith('warn')
    expect(window.$message.info).toHaveBeenCalledWith('info')

    expect(announceMock).toHaveBeenCalledWith('saved', 'polite')
    expect(announceMock).toHaveBeenCalledWith('failed', 'assertive')
    expect(announceMock).toHaveBeenCalledWith('warn', 'assertive')
    expect(announceMock).toHaveBeenCalledWith('info', 'polite')
  })

  it('allows overriding politeness explicitly', () => {
    const { showFeedback } = useActionFeedback()

    showFeedback('custom', 'success', 'assertive')

    expect(window.$message.success).toHaveBeenCalledWith('custom')
    expect(announceMock).toHaveBeenCalledWith('custom', 'assertive')
  })

  it('shows destroyable progress feedback and allows clearing all toasts', () => {
    const { showProgressFeedback, clearFeedback } = useActionFeedback()

    const handle = showProgressFeedback('thinking', 'loading', 'polite', { duration: 0 })
    handle.destroy()
    clearFeedback()

    expect(window.$message.loading).toHaveBeenCalledWith('thinking', { duration: 0 })
    expect(destroyMock).toHaveBeenCalled()
    expect(window.$message.destroyAll).toHaveBeenCalled()
    expect(announceMock).toHaveBeenCalledWith('thinking', 'polite')
  })

  describe('showError — errcode 文案中心化 (§9.3.5)', () => {
    it('传入 errcode 字符串时解析为中文文案并以 error 类型展示', () => {
      const { showError } = useActionFeedback()
      showError('M_FORBIDDEN')
      expect(window.$message.error).toHaveBeenCalledWith('权限不足，无法执行此操作')
      expect(announceMock).toHaveBeenCalledWith('权限不足，无法执行此操作', 'assertive')
    })

    it('传入未知 errcode 字符串时回退到 errcode 本身', () => {
      const { showError } = useActionFeedback()
      showError('M_CUSTOM_UNKNOWN')
      expect(window.$message.error).toHaveBeenCalledWith('M_CUSTOM_UNKNOWN')
    })

    it('传入 AppError 时从 code 解析文案', () => {
      const { showError } = useActionFeedback()
      const appError: AppError = {
        kind: 'auth',
        code: 'M_UNKNOWN_TOKEN',
        recoverable: true,
        message: '原始 SDK 消息'
      }
      showError(appError)
      expect(window.$message.error).toHaveBeenCalledWith('会话已过期，请重新登录')
    })

    it('AppError code 未命中时回退到 message', () => {
      const { showError } = useActionFeedback()
      const appError: AppError = {
        kind: 'fatal',
        code: 'CUSTOM_CODE',
        message: '自定义错误消息',
        correlationId: 'corr-1'
      }
      showError(appError)
      expect(window.$message.error).toHaveBeenCalledWith('自定义错误消息')
    })

    it('可指定展示类型（如 warning）', () => {
      const { showError } = useActionFeedback()
      showError('M_LIMIT_EXCEEDED', 'warning')
      expect(window.$message.warning).toHaveBeenCalledWith('请求过于频繁，请稍后重试')
      expect(announceMock).toHaveBeenCalledWith('请求过于频繁，请稍后重试', 'assertive')
    })

    it('传入 Error 对象时降级为通用文案', () => {
      const { showError } = useActionFeedback()
      showError(new Error('网络断开'))
      // Error 对象无 errcode，回退到 message
      expect(window.$message.error).toHaveBeenCalledWith('网络断开')
    })
  })
})
