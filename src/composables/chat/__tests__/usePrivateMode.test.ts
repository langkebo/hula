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

const refreshBurnSettingsMock = vi.fn().mockResolvedValue(undefined)
const disableBurnMock = vi.fn().mockResolvedValue(true)
const burnState = { enabled: false, durationSeconds: 0 }

vi.mock('@/services/matrix/room/RoomOperations', () => ({
  PRIVATE_MODE_STATE_EVENT_TYPE: 'com.hula.private_mode',
  roomOperations: {
    getPrivateMode: getPrivateModeMock,
    setPrivateMode: setPrivateModeMock,
    canWriteStateEvent: canWriteStateEventMock
  }
}))

vi.mock('@/composables/useBurnAfterRead', () => ({
  useBurnAfterRead: () => ({
    refreshBurnSettings: refreshBurnSettingsMock,
    disableBurn: disableBurnMock,
    isRoomBurnEnabled: () => burnState.enabled,
    getRoomBurnDuration: () => burnState.durationSeconds
  })
}))

describe('usePrivateMode', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    getPrivateModeMock.mockResolvedValue(false)
    canWriteStateEventMock.mockReturnValue(true)
    burnState.enabled = false
    burnState.durationSeconds = 0
    disableBurnMock.mockResolvedValue(true)
    const { usePrivateMode } = await import('../usePrivateMode')
    const { privateModeActive, burnEnabled, setRoomId } = usePrivateMode()
    privateModeActive.value = false
    burnEnabled.value = false
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

  it('退出私密模式时同步关闭服务端阅后即焚', async () => {
    const { usePrivateMode } = await import('../usePrivateMode')
    const { setRoomId, confirmPrivateMode, togglePrivateMode, burnEnabled } = usePrivateMode()
    await setRoomId('!room5:server')
    confirmPrivateMode()
    burnEnabled.value = true

    togglePrivateMode()

    expect(disableBurnMock).toHaveBeenCalledWith('!room5:server')
  })

  it('未启用阅后即焚时退出私密模式不调用服务端', async () => {
    const { usePrivateMode } = await import('../usePrivateMode')
    const { setRoomId, confirmPrivateMode, togglePrivateMode } = usePrivateMode()
    await setRoomId('!room6:server')
    confirmPrivateMode()

    togglePrivateMode()

    expect(disableBurnMock).not.toHaveBeenCalled()
  })

  it('进入私密模式后从服务端回填阅后即焚开关与时长', async () => {
    burnState.enabled = true
    burnState.durationSeconds = 300
    const { usePrivateMode } = await import('../usePrivateMode')
    const { setRoomId, confirmPrivateMode, burnEnabled, burnDuration } = usePrivateMode()
    await setRoomId('!room7:server')

    confirmPrivateMode()

    await vi.waitFor(() => expect(burnEnabled.value).toBe(true))
    expect(refreshBurnSettingsMock).toHaveBeenCalledWith('!room7:server')
    expect(burnDuration.value).toBe(300)
  })

  it('从房间状态恢复私密模式时回填阅后即焚状态', async () => {
    getPrivateModeMock.mockResolvedValueOnce(true)
    burnState.enabled = true
    burnState.durationSeconds = 120
    const { usePrivateMode } = await import('../usePrivateMode')
    const { setRoomId, privateModeActive, burnEnabled, burnDuration } = usePrivateMode()

    await setRoomId('!room8:server')

    expect(privateModeActive.value).toBe(true)
    expect(burnEnabled.value).toBe(true)
    expect(burnDuration.value).toBe(120)
  })
})
