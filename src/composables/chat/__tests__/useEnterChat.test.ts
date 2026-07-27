import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
}))

const openMsgSessionMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const openMsgSessionByRoomIdMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('../openMsgSession', () => ({
  openMsgSession: (...args: unknown[]) => openMsgSessionMock(...args),
  openMsgSessionByRoomId: (...args: unknown[]) => openMsgSessionByRoomIdMock(...args)
}))

const getSpaceChildrenMock = vi.hoisted(() => vi.fn())
vi.mock('@/services/matrix/room/MatrixSpaceService', () => ({
  matrixSpaceService: {
    getSpaceChildren: (...args: unknown[]) => getSpaceChildrenMock(...args)
  }
}))

const routerPushMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/router', () => ({
  default: {
    push: (...args: unknown[]) => routerPushMock(...args)
  }
}))

import { RoomTypeEnum } from '@/enums'
import { useEnterChat } from '../useEnterChat'

describe('useEnterChat', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    openMsgSessionMock.mockClear()
    openMsgSessionByRoomIdMock.mockClear()
    getSpaceChildrenMock.mockClear()
    routerPushMock.mockClear()
  })

  it('enterChat with friend type calls openMsgSession with SINGLE', async () => {
    const { enterChat } = useEnterChat()
    await enterChat('@alice:matrix.test', 'friend')
    expect(openMsgSessionMock).toHaveBeenCalledTimes(1)
    expect(openMsgSessionMock).toHaveBeenCalledWith('@alice:matrix.test', RoomTypeEnum.SINGLE)
    expect(openMsgSessionByRoomIdMock).not.toHaveBeenCalled()
  })

  it('enterChat with room type calls openMsgSessionByRoomId', async () => {
    const { enterChat } = useEnterChat()
    await enterChat('!room1:matrix.test', 'room')
    expect(openMsgSessionByRoomIdMock).toHaveBeenCalledTimes(1)
    expect(openMsgSessionByRoomIdMock).toHaveBeenCalledWith('!room1:matrix.test')
    expect(openMsgSessionMock).not.toHaveBeenCalled()
  })

  it('enterChat with empty targetId does nothing', async () => {
    const { enterChat } = useEnterChat()
    await enterChat('', 'friend')
    expect(openMsgSessionMock).not.toHaveBeenCalled()
    expect(openMsgSessionByRoomIdMock).not.toHaveBeenCalled()
    expect(routerPushMock).not.toHaveBeenCalled()
  })

  it('enterChat with space type delegates to enterSpace', async () => {
    getSpaceChildrenMock.mockResolvedValue([])
    const { enterChat } = useEnterChat()
    await enterChat('!space1:matrix.test', 'space')
    expect(getSpaceChildrenMock).toHaveBeenCalledWith('!space1:matrix.test')
    expect(routerPushMock).toHaveBeenCalledWith('/space/!space1:matrix.test')
  })

  it('enterSpace with 0 children routes to /space/{spaceId}', async () => {
    getSpaceChildrenMock.mockResolvedValue([])
    const { enterSpace } = useEnterChat()
    await enterSpace('!space1:matrix.test')
    expect(getSpaceChildrenMock).toHaveBeenCalledWith('!space1:matrix.test')
    expect(routerPushMock).toHaveBeenCalledWith('/space/!space1:matrix.test')
  })

  it('enterSpace with 1 child routes directly to /message/{roomId}', async () => {
    getSpaceChildrenMock.mockResolvedValue([{ room_id: '!room1:matrix.test' }])
    const { enterSpace } = useEnterChat()
    await enterSpace('!space1:matrix.test')
    expect(routerPushMock).toHaveBeenCalledWith('/message/!room1:matrix.test')
  })

  it('enterSpace with multiple children routes to /space/{spaceId}', async () => {
    getSpaceChildrenMock.mockResolvedValue([{ room_id: '!room1:matrix.test' }, { room_id: '!room2:matrix.test' }])
    const { enterSpace } = useEnterChat()
    await enterSpace('!space1:matrix.test')
    expect(routerPushMock).toHaveBeenCalledWith('/space/!space1:matrix.test')
  })

  it('enterSpace falls back to /space/{spaceId} when getSpaceChildren fails', async () => {
    getSpaceChildrenMock.mockRejectedValue(new Error('network error'))
    const { enterSpace } = useEnterChat()
    await enterSpace('!space1:matrix.test')
    expect(routerPushMock).toHaveBeenCalledWith('/space/!space1:matrix.test')
  })

  it('enterSpace with empty spaceId does nothing', async () => {
    const { enterSpace } = useEnterChat()
    await enterSpace('')
    expect(getSpaceChildrenMock).not.toHaveBeenCalled()
    expect(routerPushMock).not.toHaveBeenCalled()
  })
})
