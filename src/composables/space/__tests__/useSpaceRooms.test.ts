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

    const result = await createRoomInSpace({ name: 'Test Room', topic: 'A topic', suggested: true })

    expect(result).toEqual({ roomId: '!new-room:server', attached: true })
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

  it('returns a null room id and sets error when client is unavailable', async () => {
    getClientMock.mockReturnValue(null)
    const { createRoomInSpace, error } = useSpaceRooms(() => SPACE_ID)

    const result = await createRoomInSpace({ name: 'X' })

    expect(result).toEqual({ roomId: null, attached: false })
    expect(error.value).toBe('client_unavailable')
    expect(createRoomMock).not.toHaveBeenCalled()
  })

  it('returns a null room id and exposes the error message when createRoom throws', async () => {
    createRoomMock.mockRejectedValue(new Error('M_ROOM_IN_USE: already in use'))
    const { createRoomInSpace, error } = useSpaceRooms(() => SPACE_ID)

    const result = await createRoomInSpace({ name: 'Dup' })

    expect(result).toEqual({ roomId: null, attached: false })
    expect(error.value).toContain('M_ROOM_IN_USE')
  })

  it('房间已建但挂载失败时返回中间态：保留 roomId、不写 error、不刷新列表', async () => {
    addChildToSpaceMock.mockRejectedValueOnce(new Error('M_FORBIDDEN: cannot add child'))
    const { createRoomInSpace, error, refreshError, rooms } = useSpaceRooms(() => SPACE_ID)

    const result = await createRoomInSpace({ name: 'Half Done' })

    // 房间真实存在：调用方必须能拿到 roomId 并告知「已创建、未入空间」
    expect(result).toEqual({ roomId: '!new-room:server', attached: false })
    // 中间态不等于失败：error 为空，避免上层按「创建失败」提示后用户重试重复建房
    expect(error.value).toBeNull()
    expect(refreshError.value).toBeNull()
    // 列表未发生变更，不做无意义刷新
    expect(getSpaceRoomsMock).not.toHaveBeenCalled()
    expect(rooms.value).toHaveLength(0)
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

  // ── 变更成功但列表刷新失败（refreshError 与 error 分离）──
  it('removeRoom 成功但刷新失败时返回 true，只置 refreshError，不冒充变更失败', async () => {
    getSpaceRoomsMock.mockResolvedValueOnce([
      { roomId: '!r1:server', name: 'Room 1' },
      { roomId: '!r2:server', name: 'Room 2' }
    ])
    const { removeRoom, load, rooms, error, refreshError } = useSpaceRooms(() => SPACE_ID)
    await load()
    expect(rooms.value).toHaveLength(2)

    getSpaceRoomsMock.mockRejectedValueOnce(new Error('M_UNKNOWN: sync down'))
    const ok = await removeRoom('!r1:server')

    expect(ok).toBe(true)
    expect(removeChildMock).toHaveBeenCalledWith(SPACE_ID, '!r1:server')
    // 变更已生效，不能把整页判为失败
    expect(error.value).toBeNull()
    expect(refreshError.value).toContain('sync down')
    // 列表保持刷新前的状态（不清空、不假装成功）
    expect(rooms.value).toHaveLength(2)
  })

  it('刷新失败后重新 load 成功会清空 refreshError 并更新列表', async () => {
    getSpaceRoomsMock.mockRejectedValueOnce(new Error('boom'))
    const { removeRoom, load, rooms, refreshError } = useSpaceRooms(() => SPACE_ID)

    await removeRoom('!r1:server')
    expect(refreshError.value).toContain('boom')

    getSpaceRoomsMock.mockResolvedValueOnce([{ roomId: '!r2:server', name: 'Room 2' }])
    await load()

    expect(refreshError.value).toBeNull()
    expect(rooms.value).toHaveLength(1)
  })

  it('已有列表时 load 失败写入 refreshError 而不是 error，重试再次失败提示仍在', async () => {
    const { load, error, refreshError, rooms } = useSpaceRooms(() => SPACE_ID)
    await load()
    expect(rooms.value).toHaveLength(2)

    getSpaceRoomsMock.mockRejectedValueOnce(new Error('refresh retry boom'))
    await load()

    // 列表非空：失败只代表过期，整页错误态不成立
    expect(error.value).toBeNull()
    expect(refreshError.value).toContain('refresh retry boom')

    getSpaceRoomsMock.mockRejectedValueOnce(new Error('refresh retry boom 2'))
    await load()

    // 重试仍失败：局部提示不能被清空（否则用户看不到任何失败信号）
    expect(error.value).toBeNull()
    expect(refreshError.value).toContain('refresh retry boom 2')
    expect(rooms.value).toHaveLength(2)
  })

  it('空列表时 load 失败仍走整页 error，而不是局部提示', async () => {
    getSpaceRoomsMock.mockRejectedValueOnce(new Error('initial boom'))
    const { load, error, refreshError } = useSpaceRooms(() => SPACE_ID)

    await load()

    expect(error.value).toContain('initial boom')
    expect(refreshError.value).toBeNull()
  })

  it('addRoom 与 toggleSuggested 的刷新失败同样只走 refreshError', async () => {
    const { addRoom, toggleSuggested, error, refreshError } = useSpaceRooms(() => SPACE_ID)

    getSpaceRoomsMock.mockRejectedValueOnce(new Error('add-refresh'))
    expect(await addRoom('!r1:server', { suggested: false })).toBe(true)
    expect(error.value).toBeNull()
    expect(refreshError.value).toContain('add-refresh')

    getSpaceRoomsMock.mockRejectedValueOnce(new Error('toggle-refresh'))
    expect(await toggleSuggested('!r1:server', false)).toBe(true)
    expect(error.value).toBeNull()
    expect(refreshError.value).toContain('toggle-refresh')
  })
})
