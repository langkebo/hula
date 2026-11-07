import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpaceRooms } from '../useSpaceRooms'

// === Mocks ===
type MockSpaceRoom = { roomId: string; name: string; suggested?: boolean }

const {
  getSpaceRoomsMock,
  getSpaceChildrenMock,
  addChildToSpaceMock,
  removeChildMock,
  setChildSuggestedMock,
  createRoomMock,
  getRoomMock,
  getClientMock,
  clientObj
} = vi.hoisted(() => {
  const getRoomMock = vi.fn(() => ({ getJoinRule: () => 'public' as string }))
  const createRoomMock = vi.fn<() => Promise<{ roomId: string }>>(async () => ({ roomId: '!new-room:server' }))
  const getSpaceRoomsMock = vi.fn<() => Promise<MockSpaceRoom[]>>(async () => [])
  const getSpaceChildrenMock = vi.fn(async () => [])
  const addChildToSpaceMock = vi.fn<() => Promise<void>>(async () => undefined)
  const removeChildMock = vi.fn<() => Promise<void>>(async () => undefined)
  const setChildSuggestedMock = vi.fn<() => Promise<void>>(async () => undefined)
  const clientObj = { getRoom: getRoomMock }
  const getClientMock = vi.fn<() => typeof clientObj | null>(() => clientObj)
  return {
    getSpaceRoomsMock,
    getSpaceChildrenMock,
    addChildToSpaceMock,
    removeChildMock,
    setChildSuggestedMock,
    createRoomMock,
    getRoomMock,
    getClientMock,
    clientObj
  }
})

// 可被测试用例修改的 join_rule，用于验证可见性推导
let joinRule = 'public'

vi.mock('matrix-js-sdk', () => ({
  Visibility: { Public: 'public', Private: 'private' }
}))

vi.mock('@/services/matrix/room/MatrixSpaceService', () => ({
  matrixSpaceService: {
    getSpaceRooms: getSpaceRoomsMock,
    getSpaceChildren: getSpaceChildrenMock,
    addChildToSpace: addChildToSpaceMock,
    removeChild: removeChildMock,
    setChildSuggested: setChildSuggestedMock
  }
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: getClientMock,
    createRoom: createRoomMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() })
}))

const SPACE_ID = '!space:server'

describe('useSpaceRooms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    joinRule = 'public'
    getRoomMock.mockImplementation(() => ({ getJoinRule: () => joinRule }))
    getClientMock.mockReturnValue(clientObj)
    getSpaceRoomsMock.mockResolvedValue([
      { roomId: '!r1:server', name: 'Room 1' },
      { roomId: '!r2:server', name: 'Room 2' }
    ])
    getSpaceChildrenMock.mockResolvedValue([])
    createRoomMock.mockResolvedValue({ roomId: '!new-room:server' })
    setChildSuggestedMock.mockResolvedValue(undefined)
  })

  // ── createRoomInSpace ──
  it('creates a room through the service, mounts it to the space and returns the new room id', async () => {
    const { createRoomInSpace, rooms } = useSpaceRooms(() => SPACE_ID)

    const roomId = await createRoomInSpace({ name: 'Test Room', topic: 'A topic', suggested: true })

    expect(roomId).toBe('!new-room:server')
    expect(createRoomMock).toHaveBeenCalledWith({
      name: 'Test Room',
      topic: 'A topic',
      visibility: 'public'
    })
    expect(addChildToSpaceMock).toHaveBeenCalledWith(SPACE_ID, '!new-room:server', { suggested: true })
    // load() 刷新了子房间列表
    expect(getSpaceRoomsMock).toHaveBeenCalledWith(SPACE_ID)
    expect(rooms.value.length).toBe(2)
  })

  it('derives private visibility when the space join rule is not public', async () => {
    joinRule = 'invite'
    const { createRoomInSpace } = useSpaceRooms(() => SPACE_ID)

    await createRoomInSpace({ name: 'Private Room' })

    expect(createRoomMock).toHaveBeenCalledWith({
      name: 'Private Room',
      topic: undefined,
      visibility: 'private'
    })
  })

  it('returns null and sets error when client is unavailable', async () => {
    getClientMock.mockReturnValue(null)
    const { createRoomInSpace, error } = useSpaceRooms(() => SPACE_ID)

    const roomId = await createRoomInSpace({ name: 'X' })

    expect(roomId).toBeNull()
    expect(error.value).toBe('client_unavailable')
    expect(createRoomMock).not.toHaveBeenCalled()
  })

  it('returns null and exposes the error message when createRoom throws', async () => {
    createRoomMock.mockRejectedValue(new Error('M_ROOM_IN_USE: already in use'))
    const { createRoomInSpace, error } = useSpaceRooms(() => SPACE_ID)

    const roomId = await createRoomInSpace({ name: 'Dup' })

    expect(roomId).toBeNull()
    expect(error.value).toContain('M_ROOM_IN_USE')
  })

  // ── toggleSuggested ──
  it('delegates the flip to the space service', async () => {
    const { toggleSuggested } = useSpaceRooms(() => SPACE_ID)

    const ok = await toggleSuggested('!r1:server', false)

    expect(ok).toBe(true)
    expect(setChildSuggestedMock).toHaveBeenCalledWith(SPACE_ID, '!r1:server', true)
  })

  it('flips suggested to false when currently suggested', async () => {
    const { toggleSuggested } = useSpaceRooms(() => SPACE_ID)

    await toggleSuggested('!r1:server', true)

    expect(setChildSuggestedMock).toHaveBeenCalledWith(SPACE_ID, '!r1:server', false)
  })

  it('returns false without calling the service when room id is empty', async () => {
    const { toggleSuggested } = useSpaceRooms(() => SPACE_ID)

    expect(await toggleSuggested('', false)).toBe(false)
    expect(setChildSuggestedMock).not.toHaveBeenCalled()
  })

  it('returns false and exposes error when the service rejects', async () => {
    setChildSuggestedMock.mockRejectedValue(new Error('network'))
    const { toggleSuggested, error } = useSpaceRooms(() => SPACE_ID)

    expect(await toggleSuggested('!r1:server', false)).toBe(false)
    expect(error.value).toContain('network')
  })
})
