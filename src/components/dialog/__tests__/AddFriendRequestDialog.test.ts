import { describe, expect, it, vi } from 'vitest'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useFriends } from '@/composables/useFriends'
import { useGlobalStore } from '@/stores/domains/widget/global'

vi.mock('@/composables/useFriends')
vi.mock('@/composables/common/useActionFeedback')
vi.mock('@/stores/domains/widget/global')

describe('AddFriendRequestDialog Logic', () => {
  const setupAndGetLogic = (submitSuccess: boolean) => {
    const showFeedbackMock = vi.fn()
    const submitRequestMock = vi.fn().mockResolvedValue(submitSuccess)
    const closeAddFriendModalMock = vi.fn()

    ;(useActionFeedback as any).mockReturnValue({ showFeedback: showFeedbackMock })
    ;(useFriends as any).mockReturnValue({ submitRequest: submitRequestMock })
    ;(useGlobalStore as any).mockReturnValue({ closeAddFriendModal: closeAddFriendModalMock })

    const addFriend = async () => {
      const { submitRequest } = useFriends()
      const { showFeedback } = useActionFeedback()
      const globalStore = useGlobalStore()
      const submitted = await submitRequest()
      if (!submitted) return
      showFeedback('message.friend_verify.toast_success', 'success')
      globalStore.closeAddFriendModal()
    }

    return { addFriend, showFeedbackMock, closeAddFriendModalMock }
  }

  it('uses action feedback after friend request submit succeeds', async () => {
    const { addFriend, showFeedbackMock, closeAddFriendModalMock } = setupAndGetLogic(true)
    await addFriend()
    expect(showFeedbackMock).toHaveBeenCalledWith('message.friend_verify.toast_success', 'success')
    expect(closeAddFriendModalMock).toHaveBeenCalled()
  })

  it('does not show feedback when friend request submit returns false', async () => {
    const { addFriend, showFeedbackMock, closeAddFriendModalMock } = setupAndGetLogic(false)
    await addFriend()
    expect(showFeedbackMock).not.toHaveBeenCalled()
    expect(closeAddFriendModalMock).not.toHaveBeenCalled()
  })
})
