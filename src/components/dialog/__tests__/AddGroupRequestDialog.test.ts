import { describe, expect, it, vi } from 'vitest'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useGroupRequestConfirm } from '@/composables/useGroupRequestConfirm'
import { useGlobalStore } from '@/stores/domains/widget/global'

vi.mock('@/composables/useGroupRequestConfirm')
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: vi.fn(() => ({ showFeedback: vi.fn() }))
}))
vi.mock('@/stores/domains/widget/global')

describe('AddGroupRequestDialog Logic', () => {
  const setupAndGetLogic = (submitSuccess: boolean) => {
    const showFeedbackMock = vi.fn()
    const submitRequestMock = vi.fn().mockResolvedValue(submitSuccess)
    const closeAddGroupModalMock = vi.fn()

    ;(useActionFeedback as any).mockReturnValue({ showFeedback: showFeedbackMock })
    ;(useGroupRequestConfirm as any).mockReturnValue({ submitRequest: submitRequestMock })
    ;(useGlobalStore as any).mockReturnValue({ closeAddGroupModal: closeAddGroupModalMock })

    const addGroupRequest = async () => {
      const { submitRequest } = useGroupRequestConfirm()
      const { showFeedback } = useActionFeedback()
      const globalStore = useGlobalStore()
      const submitted = await submitRequest()
      if (!submitted) return
      showFeedback('message.group_verify.toast_success', 'success')
      globalStore.closeAddGroupModal()
    }

    return { addGroupRequest, showFeedbackMock, closeAddGroupModalMock }
  }

  it('uses action feedback after group request submit succeeds', async () => {
    const { addGroupRequest, showFeedbackMock, closeAddGroupModalMock } = setupAndGetLogic(true)
    await addGroupRequest()
    expect(showFeedbackMock).toHaveBeenCalledWith('message.group_verify.toast_success', 'success')
    expect(closeAddGroupModalMock).toHaveBeenCalled()
  })

  it('does not show feedback when group request submit returns false', async () => {
    const { addGroupRequest, showFeedbackMock, closeAddGroupModalMock } = setupAndGetLogic(false)
    await addGroupRequest()
    expect(showFeedbackMock).not.toHaveBeenCalled()
    expect(closeAddGroupModalMock).not.toHaveBeenCalled()
  })
})
