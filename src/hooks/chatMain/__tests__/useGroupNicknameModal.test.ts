import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
}))

const setMemberDisplayName = vi.fn()
vi.mock('@/services/matrix/room/MemberProfileService', () => ({
  matrixRoomMemberProfileService: {
    setMemberDisplayName: (...args: unknown[]) => setMemberDisplayName(...args)
  }
}))

const mittOn = vi.fn()
const mittOff = vi.fn()
const mittEmit = vi.fn()
vi.mock('@/hooks/useMitt', () => ({
  useMitt: {
    on: (...a: unknown[]) => mittOn(...a),
    off: (...a: unknown[]) => mittOff(...a),
    emit: (...a: unknown[]) => mittEmit(...a)
  }
}))

const updateUserItem = vi.fn()
const updateGroupDetail = vi.fn().mockResolvedValue(undefined)
const showFeedbackMock = vi.fn()
vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    updateUserItem,
    updateGroupDetail,
    myNameInCurrentGroup: ''
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

const { useGroupNicknameModal } = await import('../useGroupNicknameModal')

const t = (key: string) => key

describe('useGroupNicknameModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initializes with hidden modal and empty state', () => {
    const m = useGroupNicknameModal({ userUid: ref('u-self'), t })
    expect(m.groupNicknameModalVisible.value).toBe(false)
    expect(m.groupNicknameValue.value).toBe('')
    expect(m.groupNicknameError.value).toBe('')
    expect(m.groupNicknameSubmitting.value).toBe(false)
    expect(m.groupNicknameContext.value).toBeNull()
  })

  it('openGroupNicknameModal populates state from payload', () => {
    const m = useGroupNicknameModal({ userUid: ref('u-self'), t })
    m.openGroupNicknameModal({ roomId: 'r1', currentUid: 'u1', originalNickname: 'Alice' })

    expect(m.groupNicknameModalVisible.value).toBe(true)
    expect(m.groupNicknameValue.value).toBe('Alice')
    expect(m.groupNicknameContext.value?.roomId).toBe('r1')
  })

  it('enableMitt=true registers OPEN_GROUP_NICKNAME_MODAL listener', () => {
    useGroupNicknameModal({ userUid: ref('u-self'), t, enableMitt: true })
    expect(mittOn).toHaveBeenCalledTimes(1)
    const [event] = mittOn.mock.calls[0]!
    expect(event).toBe('openGroupNicknameModal')
  })

  it('enableMitt=false (default) does not register a listener', () => {
    useGroupNicknameModal({ userUid: ref('u-self'), t })
    expect(mittOn).not.toHaveBeenCalled()
  })

  it('confirm with empty trimmed name sets error and does not submit', async () => {
    const m = useGroupNicknameModal({ userUid: ref('u-self'), t })
    m.openGroupNicknameModal({ roomId: 'r1', currentUid: 'u1', originalNickname: 'Alice' })
    m.groupNicknameValue.value = '   '

    await m.handleGroupNicknameConfirm()

    expect(m.groupNicknameError.value).toBe('home.chat_main.group_nickname.error.empty')
    expect(setMemberDisplayName).not.toHaveBeenCalled()
  })

  it('confirm with unchanged name just closes modal', async () => {
    const m = useGroupNicknameModal({ userUid: ref('u-self'), t })
    m.openGroupNicknameModal({ roomId: 'r1', currentUid: 'u1', originalNickname: 'Alice' })
    m.groupNicknameValue.value = 'Alice'

    await m.handleGroupNicknameConfirm()

    expect(m.groupNicknameModalVisible.value).toBe(false)
    expect(setMemberDisplayName).not.toHaveBeenCalled()
  })

  it('confirm with invalid roomId shows error toast', async () => {
    const m = useGroupNicknameModal({ userUid: ref('u-self'), t })
    m.openGroupNicknameModal({ roomId: '', currentUid: 'u1', originalNickname: 'Alice' })
    m.groupNicknameValue.value = 'Bob'

    await m.handleGroupNicknameConfirm()

    expect(showFeedbackMock).toHaveBeenCalledWith('home.chat_main.group_nickname.error.invalid_room', 'error')
    expect(setMemberDisplayName).not.toHaveBeenCalled()
  })

  it('confirm submits happy-path, updates stores, and closes modal', async () => {
    setMemberDisplayName.mockResolvedValueOnce(undefined)
    const m = useGroupNicknameModal({ userUid: ref('u-self'), t })
    m.openGroupNicknameModal({ roomId: 'r1', currentUid: 'u-self', originalNickname: 'Alice' })
    m.groupNicknameValue.value = 'Bob'

    await m.handleGroupNicknameConfirm()

    expect(setMemberDisplayName).toHaveBeenCalledWith('r1', 'Bob')
    expect(updateUserItem).toHaveBeenCalledWith('u-self', { myName: 'Bob' }, 'r1')
    expect(updateGroupDetail).toHaveBeenCalledWith('r1', { myName: 'Bob' })
    expect(m.groupNicknameModalVisible.value).toBe(false)
  })

  it('confirm keeps modal open and resets submitting on SDK error', async () => {
    setMemberDisplayName.mockRejectedValueOnce(new Error('boom'))
    const m = useGroupNicknameModal({ userUid: ref('u-self'), t })
    m.openGroupNicknameModal({ roomId: 'r1', currentUid: 'u1', originalNickname: 'Alice' })
    m.groupNicknameValue.value = 'Bob'

    await m.handleGroupNicknameConfirm()

    expect(m.groupNicknameModalVisible.value).toBe(true)
    expect(m.groupNicknameSubmitting.value).toBe(false)
  })
})
