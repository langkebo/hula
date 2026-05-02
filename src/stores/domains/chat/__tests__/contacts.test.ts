import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { matrixDirectMessageService } from '@/services/matrix/room/MatrixDirectMessageService'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { type ContactInvite, useContactStore } from '../contacts'

const { matrixClientServiceMock, getClientMock } = vi.hoisted(() => {
  const waitForClientReadyMock = vi.fn()
  const getClientMock = vi.fn()
  const matrixClientServiceMock = {
    waitForClientReady: waitForClientReadyMock,
    getClient: getClientMock
  }
  return {
    matrixClientServiceMock,
    getClientMock
  }
})

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

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: matrixClientServiceMock
}))

const globalStoreMock = {
  setGroupUnreadCount: vi.fn(),
  setFriendUnreadCount: vi.fn(),
  incrementFriendUnreadCount: vi.fn(),
  decrementFriendUnreadCount: vi.fn()
}

function createInvite(roomId = '!invite:matrix.org'): ContactInvite {
  return {
    roomId,
    fromUserId: '@alice:matrix.org',
    fromDisplayName: 'Alice',
    timestamp: Date.now(),
    isGroup: true
  }
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

  it('getUserProfile returns null when client is not available', async () => {
    getClientMock.mockReturnValue(null)

    const store = useContactStore()
    const profile = await store.getUserProfile('@test:matrix.org')

    expect(getClientMock).toHaveBeenCalled()
    expect(profile).toBeNull()
  })

  it('getUserProfile reads profile when client is available', async () => {
    const getProfileInfo = vi.fn().mockResolvedValue({
      displayname: 'Test User',
      avatar_url: 'mxc://avatar/test'
    })

    getClientMock.mockReturnValue({
      getProfileInfo
    })

    const store = useContactStore()
    const profile = await store.getUserProfile('@test:matrix.org')

    expect(getProfileInfo).toHaveBeenCalledWith('@test:matrix.org')
    expect(profile?.displayName).toBe('Test User')
    expect(profile?.avatarUrl).toBe('mxc://avatar/test')
  })

  it('getUserProfile returns null when getProfileInfo throws', async () => {
    const getProfileInfo = vi.fn().mockRejectedValue(new Error('not found'))

    getClientMock.mockReturnValue({
      getProfileInfo
    })

    const store = useContactStore()
    const profile = await store.getUserProfile('@test:matrix.org')

    expect(profile).toBeNull()
  })

  it('loadPendingInvites returns early when client is not available', async () => {
    getClientMock.mockReturnValue(null)

    const store = useContactStore()
    await store.loadPendingInvites()

    expect(store.pendingInvites).toHaveLength(0)
  })

  it('loadPendingInvites reads invite rooms when client is available', async () => {
    getClientMock.mockReturnValue({
      getRooms: vi.fn(() => [createInviteRoom()]),
      getUserId: vi.fn(() => '@me:matrix.org')
    })

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

  it('acceptInvite joins room when client is available', async () => {
    const joinRoom = vi.fn().mockResolvedValue(undefined)
    getClientMock.mockReturnValue({ joinRoom })

    const store = useContactStore()
    store.$patch({ pendingInvites: [createInvite()] })

    await expect(store.acceptInvite('!invite:matrix.org')).resolves.toBe(true)

    expect(joinRoom).toHaveBeenCalledWith('!invite:matrix.org')
    expect(store.pendingInvites).toHaveLength(0)
  })

  it('rejectInvite leaves room when client is available', async () => {
    const leave = vi.fn().mockResolvedValue(undefined)
    getClientMock.mockReturnValue({ leave })

    const store = useContactStore()
    store.$patch({ pendingInvites: [createInvite()] })

    await expect(store.rejectInvite('!invite:matrix.org')).resolves.toBe(true)

    expect(leave).toHaveBeenCalledWith('!invite:matrix.org')
    expect(store.pendingInvites).toHaveLength(0)
  })
})
