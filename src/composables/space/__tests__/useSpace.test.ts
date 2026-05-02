import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

const spaceServiceMock = {
  getSpaces: vi.fn(),
  createSpace: vi.fn(),
  getSpace: vi.fn(),
  updateSpace: vi.fn(),
  leaveSpace: vi.fn(),
  getSpaceMembers: vi.fn(),
  inviteToSpace: vi.fn(),
  getSpaceRooms: vi.fn(),
  addChildToSpace: vi.fn(),
  removeChildFromSpace: vi.fn()
}

vi.mock('@/services/matrix/room/MatrixSpaceService', () => ({
  matrixSpaceService: spaceServiceMock
}))

const { useSpaces } = await import('../useSpaces')
const { useSpace } = await import('../useSpace')
const { useSpaceMembers } = await import('../useSpaceMembers')
const { useSpaceRooms } = await import('../useSpaceRooms')

describe('useSpaces', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.resetAllMocks())

  it('load populates list and clears loading', async () => {
    spaceServiceMock.getSpaces.mockResolvedValueOnce([{ spaceId: 's1', name: 'S', memberCount: 1, childCount: 0 }])
    const { spaces, loading, load } = useSpaces()
    const promise = load()
    expect(loading.value).toBe(true)
    await promise
    expect(loading.value).toBe(false)
    expect(spaces.value).toHaveLength(1)
  })

  it('load surfaces error into error ref', async () => {
    spaceServiceMock.getSpaces.mockRejectedValueOnce(new Error('net'))
    const { load, error } = useSpaces()
    await load()
    expect(error.value).toBe('net')
  })

  it('create reloads list on success', async () => {
    spaceServiceMock.createSpace.mockResolvedValueOnce({
      spaceId: 's1',
      name: 'S',
      memberCount: 1,
      childCount: 0
    })
    spaceServiceMock.getSpaces.mockResolvedValueOnce([{ spaceId: 's1', name: 'S', memberCount: 1, childCount: 0 }])
    const { create, spaces } = useSpaces()
    const result = await create({ name: 'S' })
    expect(result?.spaceId).toBe('s1')
    expect(spaceServiceMock.getSpaces).toHaveBeenCalled()
    expect(spaces.value).toHaveLength(1)
  })

  it('create captures error and returns null', async () => {
    spaceServiceMock.createSpace.mockRejectedValueOnce(new Error('forbidden'))
    const { create, error } = useSpaces()
    const result = await create({ name: 'S' })
    expect(result).toBeNull()
    expect(error.value).toBe('forbidden')
  })
})

describe('useSpace', () => {
  beforeEach(() => vi.clearAllMocks())

  it('load is a no-op when spaceId is empty', async () => {
    const { load, space } = useSpace(() => '')
    await load()
    expect(space.value).toBeNull()
    expect(spaceServiceMock.getSpace).not.toHaveBeenCalled()
  })

  it('load populates space state', async () => {
    spaceServiceMock.getSpace.mockResolvedValueOnce({
      spaceId: 's1',
      name: 'S',
      memberCount: 3,
      childCount: 2
    })
    const { load, space } = useSpace(() => 's1')
    await load()
    expect(space.value?.memberCount).toBe(3)
  })

  it('update calls service and reloads', async () => {
    spaceServiceMock.updateSpace.mockResolvedValueOnce(undefined)
    spaceServiceMock.getSpace.mockResolvedValueOnce({
      spaceId: 's1',
      name: 'Renamed',
      memberCount: 1,
      childCount: 0
    })
    const { update, space } = useSpace(() => 's1')
    const ok = await update({ name: 'Renamed' })
    expect(ok).toBe(true)
    expect(spaceServiceMock.updateSpace).toHaveBeenCalledWith('s1', { name: 'Renamed' })
    expect(space.value?.name).toBe('Renamed')
  })

  it('update returns false and captures error on failure', async () => {
    spaceServiceMock.updateSpace.mockRejectedValueOnce(new Error('nope'))
    const { update, error } = useSpace(() => 's1')
    const ok = await update({ name: 'x' })
    expect(ok).toBe(false)
    expect(error.value).toBe('nope')
  })

  it('leave clears space on success', async () => {
    spaceServiceMock.leaveSpace.mockResolvedValueOnce(undefined)
    const { leave, space } = useSpace(() => 's1')
    space.value = { spaceId: 's1', name: 'S', memberCount: 1, childCount: 0 }
    const ok = await leave()
    expect(ok).toBe(true)
    expect(space.value).toBeNull()
  })
})

describe('useSpaceMembers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('load populates members', async () => {
    spaceServiceMock.getSpaceMembers.mockResolvedValueOnce(['@a:e', '@b:e'])
    const { load, members } = useSpaceMembers(() => 's1')
    await load()
    expect(members.value).toEqual(['@a:e', '@b:e'])
  })

  it('invite calls service and reloads', async () => {
    spaceServiceMock.inviteToSpace.mockResolvedValueOnce(undefined)
    spaceServiceMock.getSpaceMembers.mockResolvedValueOnce(['@a:e'])
    const { invite, members } = useSpaceMembers(() => 's1')
    const ok = await invite('@a:e')
    expect(ok).toBe(true)
    expect(spaceServiceMock.inviteToSpace).toHaveBeenCalledWith('s1', '@a:e')
    expect(members.value).toEqual(['@a:e'])
  })

  it('invite returns false when userId empty', async () => {
    const { invite } = useSpaceMembers(() => 's1')
    const ok = await invite('')
    expect(ok).toBe(false)
    expect(spaceServiceMock.inviteToSpace).not.toHaveBeenCalled()
  })

  it('invite captures service error', async () => {
    spaceServiceMock.inviteToSpace.mockRejectedValueOnce(new Error('forbidden'))
    const { invite, error } = useSpaceMembers(() => 's1')
    const ok = await invite('@a:e')
    expect(ok).toBe(false)
    expect(error.value).toBe('forbidden')
  })
})

describe('useSpaceRooms', () => {
  beforeEach(() => vi.clearAllMocks())

  it('load populates child rooms', async () => {
    spaceServiceMock.getSpaceRooms.mockResolvedValueOnce([{ roomId: '!r:e', name: 'R' }])
    const { load, rooms } = useSpaceRooms(() => 's1')
    await load()
    expect(rooms.value).toHaveLength(1)
  })

  it('addRoom calls service and reloads', async () => {
    spaceServiceMock.addChildToSpace.mockResolvedValueOnce(undefined)
    spaceServiceMock.getSpaceRooms.mockResolvedValueOnce([{ roomId: '!r:e', name: 'R' }])
    const { addRoom, rooms } = useSpaceRooms(() => 's1')
    const ok = await addRoom('!r:e', { suggested: true })
    expect(ok).toBe(true)
    expect(spaceServiceMock.addChildToSpace).toHaveBeenCalledWith('s1', '!r:e', { suggested: true })
    expect(rooms.value).toHaveLength(1)
  })

  it('addRoom returns false when roomId empty', async () => {
    const { addRoom } = useSpaceRooms(() => 's1')
    const ok = await addRoom('')
    expect(ok).toBe(false)
    expect(spaceServiceMock.addChildToSpace).not.toHaveBeenCalled()
  })

  it('removeRoom captures error', async () => {
    spaceServiceMock.removeChildFromSpace.mockRejectedValueOnce(new Error('boom'))
    const { removeRoom, error } = useSpaceRooms(() => 's1')
    const ok = await removeRoom('!r:e')
    expect(ok).toBe(false)
    expect(error.value).toBe('boom')
  })
})
