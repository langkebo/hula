import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { OnlineEnum } from '@/enums'
import type { MatrixContact } from '@/stores/domains/chat/contacts'

const {
  contactStoreMock,
  showFeedbackMock,
  addSpecialFriendMock,
  getFriendDmRoomMock,
  openMsgSessionByRoomIdMock,
  contextMenuShowMock
} = vi.hoisted(() => ({
  contactStoreMock: {
    contactsList: [] as MatrixContact[],
    isLoading: false,
    requestFriendsList: [] as Array<Record<string, unknown>>,
    incomingRequestsCount: 0,
    lastFriendError: null as { message: string } | null,
    startDirectRoom: vi.fn().mockResolvedValue('@new-room:example.com'),
    removeFromContacts: vi.fn().mockResolvedValue(undefined),
    setFriendStatus: vi.fn().mockResolvedValue(undefined),
    setFriendNote: vi.fn().mockResolvedValue(undefined),
    setFriendDisplayName: vi.fn().mockResolvedValue(undefined)
  },
  showFeedbackMock: vi.fn(),
  addSpecialFriendMock: vi.fn(),
  getFriendDmRoomMock: vi.fn(),
  openMsgSessionByRoomIdMock: vi.fn(),
  contextMenuShowMock: vi.fn()
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => contactStoreMock
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/services/matrix/friends/MatrixFriendService', () => ({
  matrixFriendService: {
    getFriendDmRoom: getFriendDmRoomMock
  }
}))

vi.mock('@/services/matrix/friends/MatrixSpecialFriendService', () => ({
  matrixSpecialFriendService: {
    addSpecialFriend: addSpecialFriendMock
  }
}))

vi.mock('@/composables/chat/openMsgSession', () => ({
  openMsgSessionByRoomId: openMsgSessionByRoomIdMock
}))

import { useFriendContextMenu } from '../useFriendContextMenu'

const makeFriend = (overrides: Partial<MatrixContact> = {}): MatrixContact => ({
  userId: '@alice:example.com',
  displayName: 'Alice',
  avatarUrl: null,
  uid: '@alice:example.com',
  name: 'alice',
  account: 'alice',
  avatar: '',
  activeStatus: OnlineEnum.ONLINE,
  remark: '',
  lastOptTime: 0,
  hideMyPosts: false,
  hideTheirPosts: false,
  friendStatus: 'normal',
  ...overrides
})

const setupMenu = () => {
  const contextMenuRef = ref<{ show: (event: MouseEvent) => void } | undefined>({
    show: contextMenuShowMock
  })
  const menu = useFriendContextMenu({ contextMenuRef })
  return { menu, contextMenuRef }
}

describe('useFriendContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getFriendDmRoomMock.mockResolvedValue({ room_id: '', exists: false })
    contactStoreMock.startDirectRoom.mockResolvedValue('@new-room:example.com')
  })

  describe('contextMenuItems', () => {
    it('returns expected menu items with i18n labels', () => {
      const { menu } = setupMenu()
      const labels = menu.contextMenuItems.value.map((item) => item.label)

      expect(labels).toContain('friend.context.send_message')
      expect(labels).toContain('friend.context.encrypted_chat')
      expect(labels).toContain('friend.context.secret_chat')
      expect(labels).toContain('friend.context.set_note')
      expect(labels).toContain('friend.context.set_display_name')
      expect(labels).toContain('friend.context.set_favorite')
      expect(labels).toContain('friend.context.set_normal')
      expect(labels).toContain('friend.context.set_blocked')
      expect(labels).toContain('friend.context.remove')
      // 3 dividers
      expect(labels.filter((l) => l === 'divider')).toHaveLength(3)
    })
  })

  describe('handleContextMenu', () => {
    it('prevents default, sets selectedFriend, and shows the menu', () => {
      const { menu } = setupMenu()
      const event = { preventDefault: vi.fn() } as unknown as MouseEvent
      const friend = makeFriend()

      menu.handleContextMenu(event, friend)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(menu.selectedFriend.value?.userId).toBe(friend.userId)
      expect(contextMenuShowMock).toHaveBeenCalledWith(event)
    })
  })

  describe('performSendMessage', () => {
    it('opens existing DM room when getFriendDmRoom returns a room_id', async () => {
      getFriendDmRoomMock.mockResolvedValue({ room_id: '@existing-dm:example.com', exists: true })
      const { menu } = setupMenu()
      const friend = makeFriend()

      await menu.performSendMessage(friend)

      expect(getFriendDmRoomMock).toHaveBeenCalledWith(friend.userId)
      expect(openMsgSessionByRoomIdMock).toHaveBeenCalledWith('@existing-dm:example.com')
      expect(contactStoreMock.startDirectRoom).not.toHaveBeenCalled()
    })

    it('creates a new DM room when no existing room_id', async () => {
      getFriendDmRoomMock.mockResolvedValue({ room_id: '', exists: false })
      const { menu } = setupMenu()
      const friend = makeFriend()

      await menu.performSendMessage(friend)

      expect(getFriendDmRoomMock).toHaveBeenCalledWith(friend.userId)
      expect(contactStoreMock.startDirectRoom).toHaveBeenCalledWith(friend.userId, false)
      expect(openMsgSessionByRoomIdMock).toHaveBeenCalledWith('@new-room:example.com')
    })
  })

  describe('performRemoveFriend', () => {
    it('calls removeFromContacts with the userId', async () => {
      const { menu } = setupMenu()
      const friend = makeFriend({ userId: '@bob:example.com' })

      await menu.performRemoveFriend(friend)

      expect(contactStoreMock.removeFromContacts).toHaveBeenCalledWith('@bob:example.com')
    })
  })

  describe('handleSendMessage / handleRemoveFriend', () => {
    it('handleSendMessage initiates the DM room flow (delegates to performSendMessage)', async () => {
      getFriendDmRoomMock.mockResolvedValue({ room_id: '', exists: false })
      const { menu } = setupMenu()
      const friend = makeFriend()

      await menu.handleSendMessage(friend)

      expect(getFriendDmRoomMock).toHaveBeenCalledWith(friend.userId)
      expect(contactStoreMock.startDirectRoom).toHaveBeenCalledWith(friend.userId, false)
    })

    it('handleRemoveFriend calls removeFromContacts (delegates to performRemoveFriend)', async () => {
      const { menu } = setupMenu()
      const friend = makeFriend({ userId: '@carol:example.com' })

      await menu.handleRemoveFriend(friend)

      expect(contactStoreMock.removeFromContacts).toHaveBeenCalledWith('@carol:example.com')
    })
  })

  describe('handleSetSecretFriend', () => {
    it('shows success feedback on success', async () => {
      addSpecialFriendMock.mockResolvedValue(undefined)
      const { menu } = setupMenu()
      const friend = makeFriend()

      await menu.handleSetSecretFriend(friend)

      expect(addSpecialFriendMock).toHaveBeenCalledWith(friend.userId)
      expect(showFeedbackMock).toHaveBeenCalledWith('friend.secret_chat.success', 'success')
    })

    it('shows error feedback on failure', async () => {
      addSpecialFriendMock.mockRejectedValue(new Error('secret friend failed'))
      const { menu } = setupMenu()
      const friend = makeFriend()

      await menu.handleSetSecretFriend(friend)

      expect(showFeedbackMock).toHaveBeenCalledWith('Error: secret friend failed', 'error')
    })
  })

  describe('handleContextMenuSelect', () => {
    it('returns early when no friend is selected', async () => {
      const { menu } = setupMenu()
      // selectedFriend is null initially
      await menu.handleContextMenuSelect({ label: 'friend.context.send_message' })
      expect(getFriendDmRoomMock).not.toHaveBeenCalled()
    })

    it('dispatches send_message to performSendMessage', async () => {
      const { menu } = setupMenu()
      const friend = makeFriend()
      menu.selectedFriend.value = friend

      await menu.handleContextMenuSelect({ label: 'friend.context.send_message' })

      expect(getFriendDmRoomMock).toHaveBeenCalledWith(friend.userId)
      // selectedFriend is cleared after dispatch
      expect(menu.selectedFriend.value).toBeNull()
    })

    it('dispatches remove to performRemoveFriend', async () => {
      const { menu } = setupMenu()
      const friend = makeFriend()
      menu.selectedFriend.value = friend

      await menu.handleContextMenuSelect({ label: 'friend.context.remove' })

      expect(contactStoreMock.removeFromContacts).toHaveBeenCalledWith(friend.userId)
      expect(menu.selectedFriend.value).toBeNull()
    })

    it('dispatches set_favorite to setFriendStatus("favorite")', async () => {
      const { menu } = setupMenu()
      const friend = makeFriend()
      menu.selectedFriend.value = friend

      await menu.handleContextMenuSelect({ label: 'friend.context.set_favorite' })

      expect(contactStoreMock.setFriendStatus).toHaveBeenCalledWith(friend.userId, 'favorite')
    })

    it('dispatches set_normal to setFriendStatus("accepted")', async () => {
      const { menu } = setupMenu()
      const friend = makeFriend()
      menu.selectedFriend.value = friend

      await menu.handleContextMenuSelect({ label: 'friend.context.set_normal' })

      expect(contactStoreMock.setFriendStatus).toHaveBeenCalledWith(friend.userId, 'accepted')
    })

    it('dispatches set_blocked to setFriendStatus("blocked")', async () => {
      const { menu } = setupMenu()
      const friend = makeFriend()
      menu.selectedFriend.value = friend

      await menu.handleContextMenuSelect({ label: 'friend.context.set_blocked' })

      expect(contactStoreMock.setFriendStatus).toHaveBeenCalledWith(friend.userId, 'blocked')
    })

    it('dispatches encrypted_chat to startDirectRoom(encrypted=true)', async () => {
      const { menu } = setupMenu()
      const friend = makeFriend()
      menu.selectedFriend.value = friend

      await menu.handleContextMenuSelect({ label: 'friend.context.encrypted_chat' })

      expect(contactStoreMock.startDirectRoom).toHaveBeenCalledWith(friend.userId, true)
      expect(openMsgSessionByRoomIdMock).toHaveBeenCalledWith('@new-room:example.com')
    })

    it('dispatches secret_chat to handleSetSecretFriend', async () => {
      addSpecialFriendMock.mockResolvedValue(undefined)
      const { menu } = setupMenu()
      const friend = makeFriend()
      menu.selectedFriend.value = friend

      await menu.handleContextMenuSelect({ label: 'friend.context.secret_chat' })

      expect(addSpecialFriendMock).toHaveBeenCalledWith(friend.userId)
      expect(showFeedbackMock).toHaveBeenCalledWith('friend.secret_chat.success', 'success')
    })
  })
})
