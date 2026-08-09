import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OnlineEnum } from '@/enums'
import { matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { matrixDirectMessageService } from '@/services/matrix/room/MatrixDirectMessageService'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useContactStore } from '../contacts'

const { matrixClientServiceMock, getClientMock, getUserIdMock } = vi.hoisted(() => {
  const waitForClientReadyMock = vi.fn()
  const getClientMock = vi.fn()
  const getUserIdMock = vi.fn()
  const matrixClientServiceMock = {
    waitForClientReady: waitForClientReadyMock,
    getClient: getClientMock,
    getUserId: getUserIdMock
  }
  return {
    matrixClientServiceMock,
    getClientMock,
    getUserIdMock
  }
})

const openMsgSessionByRoomIdMock = vi.hoisted(() => vi.fn())

vi.mock('@/composables/chat/openMsgSession', () => ({
  openMsgSessionByRoomId: openMsgSessionByRoomIdMock
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/common/matrixErrorTranslator', () => ({
  formatMatrixError: (err: unknown) => String(err)
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: vi.fn()
}))

vi.mock('@/services/matrix/friends/MatrixFriendService', () => ({
  matrixFriendService: {
    initialize: vi.fn(),
    on: vi.fn(),
    stop: vi.fn(),
    getFriends: vi.fn(),
    getSpecialFriends: vi.fn(),
    getIncomingRequests: vi.fn(),
    getOutgoingRequests: vi.fn(),
    isFriend: vi.fn(),
    acceptFriendRequest: vi.fn(),
    rejectFriendRequest: vi.fn(),
    cancelFriendRequest: vi.fn(),
    removeFriend: vi.fn(),
    setFriendNote: vi.fn(),
    setFriendStatus: vi.fn(),
    sendFriendRequest: vi.fn()
  }
}))

vi.mock('@/services/matrix/room/MatrixDirectMessageService', () => ({
  matrixDirectMessageService: {
    initialize: vi.fn(),
    stop: vi.fn(),
    getDmRoomInfos: vi.fn(),
    createDm: vi.fn()
  }
}))

const profileServiceMock = vi.hoisted(() => ({
  getProfile: vi.fn()
}))

vi.mock('@/services/matrix/user/MatrixProfileService', () => ({
  profileService: profileServiceMock
}))

const matrixRoomQueryFacadeMock = vi.hoisted(() => ({
  getRooms: vi.fn()
}))

vi.mock('@/services/matrix/room/QueryFacade', () => ({
  matrixRoomQueryFacade: matrixRoomQueryFacadeMock
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: matrixClientServiceMock
}))

const globalStoreMock = {
  setGroupUnreadCount: vi.fn(),
  setFriendUnreadCount: vi.fn(),
  incrementFriendUnreadCount: vi.fn(),
  decrementFriendUnreadCount: vi.fn()
}

function createInviteRoom(roomId = '!invite:matrix.org') {
  return {
    roomId,
    name: 'Invite Room',
    getMyMembership: vi.fn(() => 'invite'),
    getLiveTimeline: vi.fn(() => ({
      getState: vi.fn(() => ({
        getStateEvents: vi.fn(() => ({
          getSender: vi.fn(() => '@alice:matrix.org')
        }))
      }))
    })),
    isSpaceRoom: vi.fn(() => false),
    getJoinedMembers: vi.fn(() => [{}, {}, {}])
  }
}

describe('contacts store startup client readiness', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    vi.mocked(useGlobalStore).mockReturnValue(globalStoreMock as never)

    vi.mocked(matrixFriendService.getFriends).mockResolvedValue([])
    vi.mocked(matrixFriendService.getSpecialFriends).mockResolvedValue([])
    vi.mocked(matrixFriendService.getIncomingRequests).mockResolvedValue([])
    vi.mocked(matrixFriendService.getOutgoingRequests).mockResolvedValue([])
    vi.mocked(matrixDirectMessageService.getDmRoomInfos).mockResolvedValue([])

    getClientMock.mockReturnValue(null)
  })

  it('getUserProfile returns null when profile service throws', async () => {
    profileServiceMock.getProfile.mockRejectedValue(new Error('not found'))

    const store = useContactStore()
    const profile = await store.getUserProfile('@test:matrix.org')

    expect(profile).toBeNull()
  })

  it('getUserProfile reads profile when available', async () => {
    profileServiceMock.getProfile.mockResolvedValue({
      userId: '@test:matrix.org',
      displayname: 'Test User',
      avatarUrl: 'mxc://avatar/test'
    })

    const store = useContactStore()
    const profile = await store.getUserProfile('@test:matrix.org')

    expect(profileServiceMock.getProfile).toHaveBeenCalledWith('@test:matrix.org')
    expect(profile?.displayName).toBe('Test User')
    expect(profile?.avatarUrl).toBe('mxc://avatar/test')
  })

  it('getUserProfile returns null when getProfileInfo throws', async () => {
    profileServiceMock.getProfile.mockRejectedValue(new Error('not found'))

    const store = useContactStore()
    const profile = await store.getUserProfile('@test:matrix.org')

    expect(profile).toBeNull()
  })

  it('loadPendingInvites returns early when client is not available', async () => {
    getUserIdMock.mockReturnValue(null)

    const store = useContactStore()
    await store.loadPendingInvites()

    expect(store.pendingInvites).toHaveLength(0)
  })

  it('loadPendingInvites reads invite rooms when client is available', async () => {
    getUserIdMock.mockReturnValue('@me:matrix.org')
    matrixRoomQueryFacadeMock.getRooms.mockResolvedValue([createInviteRoom()])

    const store = useContactStore()
    await store.loadPendingInvites()

    expect(store.pendingInvites).toHaveLength(1)
    expect(store.pendingInvites[0]).toMatchObject({
      roomId: '!invite:matrix.org',
      fromUserId: '@alice:matrix.org',
      isGroup: true
    })
    expect(globalStoreMock.setGroupUnreadCount).toHaveBeenCalledWith(1)
  })
})

describe('acceptFriendRequest', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(useGlobalStore).mockReturnValue(globalStoreMock as never)
    vi.mocked(matrixFriendService.getFriends).mockResolvedValue([])
    vi.mocked(matrixDirectMessageService.getDmRoomInfos).mockResolvedValue([])
  })

  it('accepts request, creates DM via roomId, and opens session', async () => {
    vi.mocked(matrixFriendService.acceptFriendRequest).mockResolvedValueOnce(undefined)
    vi.mocked(matrixDirectMessageService.createDm).mockResolvedValueOnce('!dm-room:matrix.org')

    const store = useContactStore()
    const result = await store.acceptFriendRequest('@bob:matrix.org')
    await new Promise((r) => setTimeout(r, 0))

    expect(result).toBe(true)
    expect(matrixFriendService.acceptFriendRequest).toHaveBeenCalledWith('@bob:matrix.org')
    expect(matrixDirectMessageService.createDm).toHaveBeenCalledWith('@bob:matrix.org', {
      userIds: ['@bob:matrix.org'],
      isEncrypted: false
    })
    expect(openMsgSessionByRoomIdMock).toHaveBeenCalledWith('!dm-room:matrix.org')
  })

  it('removes the accepted request from incoming list', async () => {
    vi.mocked(matrixFriendService.acceptFriendRequest).mockResolvedValueOnce(undefined)
    vi.mocked(matrixDirectMessageService.createDm).mockResolvedValueOnce('!dm-carol:matrix.org')

    const store = useContactStore()
    store.requestFriendsList = [
      {
        userId: '@carol:matrix.org',
        displayName: 'Carol',
        direction: 'incoming' as const,
        applyId: 'apply-carol-1'
      }
    ]

    await store.acceptFriendRequest('@carol:matrix.org')

    expect(store.requestFriendsList.some((r) => r.userId === '@carol:matrix.org')).toBe(false)
  })

  it('decrements friend unread count after acceptance', async () => {
    vi.mocked(matrixFriendService.acceptFriendRequest).mockResolvedValueOnce(undefined)
    vi.mocked(matrixDirectMessageService.createDm).mockResolvedValueOnce('!dm-dave:matrix.org')

    const store = useContactStore()
    await store.acceptFriendRequest('@dave:matrix.org')

    expect(globalStoreMock.decrementFriendUnreadCount).toHaveBeenCalled()
  })

  it('loads contacts after acceptance', async () => {
    vi.mocked(matrixFriendService.acceptFriendRequest).mockResolvedValueOnce(undefined)
    vi.mocked(matrixDirectMessageService.createDm).mockResolvedValueOnce('!dm-eve:matrix.org')
    vi.mocked(matrixFriendService.getFriends).mockResolvedValue([])

    const store = useContactStore()
    await store.acceptFriendRequest('@eve:matrix.org')

    expect(matrixFriendService.getFriends).toHaveBeenCalled()
  })
})

describe('setFriendStatus', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(useGlobalStore).mockReturnValue(globalStoreMock as never)
  })

  it('normal 动作写回 accepted 时，列表展示口径仍归一为 normal', async () => {
    vi.mocked(matrixFriendService.setFriendStatus).mockResolvedValueOnce(undefined)

    const store = useContactStore()
    store.contactsList = [
      {
        userId: '@alice:matrix.org',
        uid: '@alice:matrix.org',
        displayName: 'Alice',
        name: 'Alice',
        avatarUrl: null,
        avatar: '',
        account: 'alice',
        activeStatus: OnlineEnum.OFFLINE,
        remark: '',
        lastOptTime: Date.now(),
        hideMyPosts: false,
        hideTheirPosts: false,
        friendStatus: 'favorite'
      }
    ]

    const result = await store.setFriendStatus('@alice:matrix.org', 'accepted')

    expect(result).toBe(true)
    expect(store.contactsList[0]?.friendStatus).toBe('normal')
  })
})
