import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}))

const getPrivateModeMock = vi.fn().mockResolvedValue(false)
const setPrivateModeMock = vi.fn().mockResolvedValue(undefined)
const canWriteStateEventMock = vi.fn().mockReturnValue(true)

vi.mock('@/services/matrix/room/RoomOperations', () => ({
  PRIVATE_MODE_STATE_EVENT_TYPE: 'com.hula.private_mode',
  roomOperations: {
    getPrivateMode: getPrivateModeMock,
    setPrivateMode: setPrivateModeMock,
    canWriteStateEvent: canWriteStateEventMock
  }
}))

describe('usePrivateMode', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    getPrivateModeMock.mockResolvedValue(false)
    canWriteStateEventMock.mockReturnValue(true)
    const { usePrivateMode } = await import('../usePrivateMode')
    const { privateModeActive, setRoomId } = usePrivateMode()
    privateModeActive.value = false
    await setRoomId('')
  })

  it('confirmPrivateMode persists enabled state for current room', async () => {
    const { usePrivateMode } = await import('../usePrivateMode')
    const { setRoomId, confirmPrivateMode, privateModeActive } = usePrivateMode()
    await setRoomId('!room1:server')
    confirmPrivateMode()
    expect(privateModeActive.value).toBe(true)
    expect(setPrivateModeMock).toHaveBeenCalledWith('!room1:server', true)
  })

  it('setRoomId switching room exits private mode', async () => {
    const { usePrivateMode } = await import('../usePrivateMode')
    const { setRoomId, confirmPrivateMode, privateModeActive } = usePrivateMode()
    await setRoomId('!room1:server')
    confirmPrivateMode()
    expect(privateModeActive.value).toBe(true)

    await setRoomId('!room2:server')
    expect(privateModeActive.value).toBe(false)
  })

  it('togglePrivateMode (exit) persists disabled', async () => {
    const { usePrivateMode } = await import('../usePrivateMode')
    const { setRoomId, confirmPrivateMode, togglePrivateMode } = usePrivateMode()
    await setRoomId('!room1:server')
    confirmPrivateMode()
    togglePrivateMode()
    expect(setPrivateModeMock).toHaveBeenLastCalledWith('!room1:server', false)
  })

  it('setRoomId restores private mode persisted in room state', async () => {
    getPrivateModeMock.mockResolvedValueOnce(true)
    const { usePrivateMode } = await import('../usePrivateMode')
    const { setRoomId, privateModeActive } = usePrivateMode()
    await setRoomId('!room3:server')
    expect(privateModeActive.value).toBe(true)
  })

  it('degrades to session-only mode when user cannot write state event', async () => {
    canWriteStateEventMock.mockReturnValue(false)
    const { usePrivateMode } = await import('../usePrivateMode')
    const { setRoomId, confirmPrivateMode, privateModeActive } = usePrivateMode()
    await setRoomId('!room4:server')
    confirmPrivateMode()
    expect(privateModeActive.value).toBe(true)
    expect(setPrivateModeMock).not.toHaveBeenCalled()
  })
})
