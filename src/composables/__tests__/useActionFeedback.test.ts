import { beforeEach, describe, expect, it, vi } from 'vitest'
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
})
