import { beforeEach, describe, expect, it, vi } from 'vitest'

const { chatStoreMock, globalStoreMock, mittMock, sessionServiceMock, invokeMock, routerMock, infoMock } = vi.hoisted(
  () => ({
    chatStoreMock: {
      getSession: vi.fn(),
      markSessionRead: vi.fn(),
      updateSessionLastActiveTime: vi.fn(),
      getSessionList: vi.fn(async () => []),
      addSession: vi.fn()
    },
    globalStoreMock: { updateCurrentSessionRoomId: vi.fn() },
    mittMock: { emit: vi.fn() },
    sessionServiceMock: { getSessionDetailWithFriends: vi.fn() },
    invokeMock: vi.fn(async () => undefined),
    routerMock: {
      currentRoute: { value: { name: 'message', path: '/message' } },
      push: vi.fn()
    },
    infoMock: vi.fn()
  })
)

vi.mock('@/stores/domains/chat/chat', () => ({ useChatStore: () => chatStoreMock }))
vi.mock('@/stores/domains/widget/global', () => ({ useGlobalStore: () => globalStoreMock }))
vi.mock('@/hooks/useMitt.ts', () => ({
  useMitt: mittMock,
  MittEnum: { LOCATE_SESSION: 'LOCATE_SESSION', TO_SEND_MSG: 'TO_SEND_MSG' }
}))
vi.mock('@/router', () => ({ default: routerMock }))
vi.mock('@/services/matrix/auth/MatrixSessionService', () => ({ matrixSessionService: sessionServiceMock }))
vi.mock('../../../utils/TauriInvokeHandler', () => ({ invokeWithErrorHandler: invokeMock }))
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: { getCurrent: () => ({ label: 'home' }) }
}))
vi.mock('@tauri-apps/plugin-log', () => ({ info: infoMock }))

import { openMsgSession } from '../openMsgSession'

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).$message = { error: vi.fn() }
  routerMock.currentRoute.value.name = 'message'
  routerMock.currentRoute.value.path = '/message'
  chatStoreMock.getSession.mockReturnValue({ roomId: 'room-1' })
  sessionServiceMock.getSessionDetailWithFriends.mockResolvedValue({ roomId: 'room-1' })
})

describe('openMsgSession', () => {
  it('routes to /message when current page is not /message and on home label', async () => {
    routerMock.currentRoute.value.name = 'friendsList'
    routerMock.currentRoute.value.path = '/friendsList'
    await openMsgSession('uid-1')
    expect(globalStoreMock.updateCurrentSessionRoomId).toHaveBeenCalledWith('room-1') // Ensure room ID is updated
    expect(routerMock.push).toHaveBeenCalledWith('/message')
    // Now, updateCurrentSessionRoomId should be called BEFORE router.push
    expect(globalStoreMock.updateCurrentSessionRoomId.mock.invocationCallOrder[0]).toBeLessThan(
      routerMock.push.mock.invocationCallOrder[0]
    )
  })

  it('waits for session to become visible and then updates currentSessionRoomId before routing', async () => {
    routerMock.currentRoute.value.name = 'friendsList'
    routerMock.currentRoute.value.path = '/friendsList'
    chatStoreMock.getSession
      .mockReturnValueOnce(undefined) // Call 1: initial check
      .mockReturnValueOnce(undefined) // Call 2: after getSessionList(true)
      .mockReturnValueOnce(undefined) // Call 3: after addSession
      .mockReturnValueOnce({ roomId: 'room-1' }) // Call 4: after loop poll
    chatStoreMock.getSessionList.mockResolvedValue([])

    await openMsgSession('uid-1')

    expect(chatStoreMock.getSession).toHaveBeenCalledTimes(4)
    expect(chatStoreMock.getSessionList).toHaveBeenCalledTimes(2) // One initial, one in loop
    expect(globalStoreMock.updateCurrentSessionRoomId).toHaveBeenCalledWith('room-1')
    expect(routerMock.push).toHaveBeenCalledWith('/message')
  })

  it('does NOT route when already on /message', async () => {
    routerMock.currentRoute.value.name = 'message'
    routerMock.currentRoute.value.path = '/message'
    await openMsgSession('uid-1')
    expect(routerMock.push).not.toHaveBeenCalled()
  })

  it('passes id+type=2 by default to session service', async () => {
    await openMsgSession('uid-1')
    expect(sessionServiceMock.getSessionDetailWithFriends).toHaveBeenCalledWith({ id: 'uid-1', roomType: 2 })
  })

  it('forwards explicit type to session service', async () => {
    await openMsgSession('uid-1', 5)
    expect(sessionServiceMock.getSessionDetailWithFriends).toHaveBeenCalledWith({ id: 'uid-1', roomType: 5 })
  })

  it('toasts and bails when session detail is null', async () => {
    sessionServiceMock.getSessionDetailWithFriends.mockResolvedValueOnce(null)
    await openMsgSession('uid-1')
    expect((window as any).$message.error).toHaveBeenCalledWith('获取会话详情失败')
    expect(globalStoreMock.updateCurrentSessionRoomId).not.toHaveBeenCalled()
  })

  it('unhides the session via hide_contact_command and continues on error', async () => {
    invokeMock.mockRejectedValueOnce(new Error('fail'))
    await openMsgSession('uid-1')
    expect(invokeMock).toHaveBeenCalledWith('hide_contact_command', { data: { roomId: 'room-1', hide: false } })
    expect((window as any).$message.error).toHaveBeenCalledWith('显示会话失败')
    // Still proceeds to focus the session
    expect(globalStoreMock.updateCurrentSessionRoomId).toHaveBeenCalledWith('room-1')
  })

  it('refreshes session list when the session is new', async () => {
    chatStoreMock.getSession.mockReturnValueOnce(undefined)
    await openMsgSession('uid-1')
    expect(chatStoreMock.updateSessionLastActiveTime).toHaveBeenCalledWith('room-1')
    expect(chatStoreMock.getSessionList).toHaveBeenCalledWith(true)
  })

  it('adds a fallback session when the refreshed list still does not contain the room', async () => {
    chatStoreMock.getSession.mockReturnValue(undefined)
    await openMsgSession('uid-1')
    expect(chatStoreMock.addSession).toHaveBeenCalledWith({ roomId: 'room-1' })
    expect(globalStoreMock.updateCurrentSessionRoomId).toHaveBeenCalledWith('room-1')
  })

  it('skips list refresh when session already exists', async () => {
    chatStoreMock.getSession.mockReturnValueOnce({ roomId: 'room-1' })
    await openMsgSession('uid-1')
    expect(chatStoreMock.updateSessionLastActiveTime).not.toHaveBeenCalled()
    expect(chatStoreMock.getSessionList).not.toHaveBeenCalled()
  })

  it('hides details, emits LOCATE_SESSION + TO_SEND_MSG, and marks the session read on success', async () => {
    await openMsgSession('uid-1')
    expect(mittMock.emit).toHaveBeenCalledWith('detailsShow', { detailsShow: false, context: undefined })
    expect(mittMock.emit).toHaveBeenCalledWith('locateSession', { roomId: 'room-1' })
    expect(mittMock.emit).toHaveBeenCalledWith('toSendMsg', { url: 'message' })
    expect(chatStoreMock.markSessionRead).toHaveBeenCalledWith('room-1')
  })
})
