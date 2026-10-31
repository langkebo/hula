import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OnlineEnum } from '@/enums'
import { matrixFriendOperations, matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { matrixDirectMessageService } from '@/services/matrix/room/MatrixDirectMessageService'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useContactStore } from '../contacts'
import { createContactsList } from '../contacts/list'

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
    on: vi.fn(),
    stop: vi.fn(),
    getFriends: vi.fn(),
    getSpecialFriends: vi.fn(),
    getIncomingRequests: vi.fn(),
    getOutgoingRequests: vi.fn(),
    isFriend: vi.fn()
  },
  matrixFriendSync: {
    initialize: vi.fn()
  },
  matrixFriendOperations: {
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
    getDmForUser: vi.fn(),
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

vi.mock('@/services/matrix/room/RoomFacade', () => ({
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
    vi.mocked(matrixFriendOperations.acceptFriendRequest).mockResolvedValueOnce(undefined)
    vi.mocked(matrixDirectMessageService.createDm).mockResolvedValueOnce('!dm-room:matrix.org')

    const store = useContactStore()
    const result = await store.acceptFriendRequest('@bob:matrix.org')
    await new Promise((r) => setTimeout(r, 0))

    expect(result).toBe(true)
    expect(matrixFriendOperations.acceptFriendRequest).toHaveBeenCalledWith('@bob:matrix.org')
    expect(matrixDirectMessageService.createDm).toHaveBeenCalledWith('@bob:matrix.org', {
      userIds: ['@bob:matrix.org'],
      isEncrypted: false
    })
    expect(openMsgSessionByRoomIdMock).toHaveBeenCalledWith('!dm-room:matrix.org')
  })

  it('m.direct 已有 DM 房间时复用而不重复创建（根因 A）', async () => {
    vi.mocked(matrixFriendOperations.acceptFriendRequest).mockResolvedValueOnce(undefined)
    // m.direct 账号数据已存在该用户的 DM 房间 → startDirectRoom 应复用，不再 createDm
    vi.mocked(matrixDirectMessageService.getDmForUser).mockResolvedValueOnce('!existing-dm:matrix.org')

    const store = useContactStore()
    const result = await store.acceptFriendRequest('@bob:matrix.org')
    await new Promise((r) => setTimeout(r, 0))

    expect(result).toBe(true)
    expect(matrixDirectMessageService.getDmForUser).toHaveBeenCalledWith('@bob:matrix.org', false)
    expect(matrixDirectMessageService.createDm).not.toHaveBeenCalled() // 未重复创建
    expect(openMsgSessionByRoomIdMock).toHaveBeenCalledWith('!existing-dm:matrix.org')
  })

  it('removes the accepted request from incoming list', async () => {
    vi.mocked(matrixFriendOperations.acceptFriendRequest).mockResolvedValueOnce(undefined)
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
    vi.mocked(matrixFriendOperations.acceptFriendRequest).mockResolvedValueOnce(undefined)
    vi.mocked(matrixDirectMessageService.createDm).mockResolvedValueOnce('!dm-dave:matrix.org')

    const store = useContactStore()
    await store.acceptFriendRequest('@dave:matrix.org')

    expect(globalStoreMock.decrementFriendUnreadCount).toHaveBeenCalled()
  })

  it('loads contacts after acceptance', async () => {
    vi.mocked(matrixFriendOperations.acceptFriendRequest).mockResolvedValueOnce(undefined)
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
    vi.mocked(matrixFriendOperations.setFriendStatus).mockResolvedValueOnce(undefined)

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

describe('contacts presence preservation on friend sync', () => {
  const createList = () => createContactsList({ ensureFriendServicesReady: async () => {} })

  const contact = {
    userId: '@test1:matrix.org',
    uid: '@test1:matrix.org',
    displayName: 'test1',
    name: 'test1',
    avatarUrl: null,
    avatar: '',
    account: 'test1',
    activeStatus: OnlineEnum.ONLINE,
    presence: 'online',
    lastOptTime: 111,
    remark: '',
    hideMyPosts: false,
    hideTheirPosts: false
  }

  const friend = {
    user_id: '@test1:matrix.org',
    display_name: 'test1',
    avatar_url: null,
    note: '',
    since: 222
  } as never

  it('updateContactsFromFriends 不把已在线好友刷回离线', () => {
    const list = createList()
    list.contactsList.value = [{ ...contact }]

    list.updateContactsFromFriends([friend])

    expect(list.contactsList.value[0]).toMatchObject({
      activeStatus: OnlineEnum.ONLINE,
      presence: 'online',
      lastOptTime: 111
    })
  })

  it('handleFriendUpdated 只更新资料字段，保留在线状态', () => {
    const list = createList()
    list.contactsList.value = [{ ...contact }]

    list.handleFriendUpdated(friend)

    expect(list.contactsList.value[0]).toMatchObject({
      activeStatus: OnlineEnum.ONLINE,
      presence: 'online',
      lastOptTime: 111
    })
  })
})

describe('联系人「备注名 / 笔记」的字段归属（判据 1）', () => {
  const createList = () => createContactsList({ ensureFriendServicesReady: async () => {} })

  const baseContact = {
    userId: '@bob:matrix.org',
    uid: '@bob:matrix.org',
    displayName: 'Bob',
    name: 'Bob',
    avatarUrl: null,
    avatar: '',
    account: 'bob',
    activeStatus: OnlineEnum.OFFLINE,
    remark: '',
    note: '',
    lastOptTime: 1,
    hideMyPosts: false,
    hideTheirPosts: false
  }

  /**
   * 回归锁：`remark` 是「我给他的备注名」，来源必须是 `Friend.display_name`。
   * 历史映射把 `remark` 也取自 `Friend.note`，导致「设备注名 → 刷新后变成笔记内容」。
   */
  it('好友快照的 display_name 落到 remark，note 与 remark 各自独立', () => {
    const list = createList()
    list.contactsList.value = [{ ...baseContact }]

    list.updateContactsFromFriends([
      {
        user_id: '@bob:matrix.org',
        display_name: '王总',
        avatar_url: null,
        note: '老王',
        since: 2
      } as never
    ])

    const contact = list.contactsList.value[0]!
    expect(contact.remark).toBe('王总')
    expect(contact.note).toBe('老王')
  })

  /**
   * 回归锁：写笔记只动 `note`，不能把备注名一起改掉。
   */
  it('setFriendNote 只写 note，不覆盖 remark', async () => {
    const list = createList()
    list.contactsList.value = [{ ...baseContact, remark: '王总', note: '老王' }]

    await list.setFriendNote('@bob:matrix.org', '新的笔记')

    const contact = list.contactsList.value[0]!
    expect(contact.note).toBe('新的笔记')
    expect(contact.remark).toBe('王总')
  })
})
