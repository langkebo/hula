/**
 * Regression net for high-value, previously untested actions in
 * stores/domains/chat/chat/message.ts: pushMsg session/unread/notify side effects,
 * multi-choose toggling, clearRoomMessages, getMessage lookup, recall expiration cleanup.
 *
 * The existing message.test.ts already covers index/sort/trim/replace/recall preview/
 * remote loading. This file fills the P0-3 gaps without overlapping those.
 */

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MsgEnum, RoomTypeEnum } from '@/enums'

const { globalStoreMock, sessionStoreMock, groupStoreMock, userStoreMock, timerWorkerMock, sendNotificationMock } =
  vi.hoisted(() => {
    const sessions: Record<string, any> = {}
    return {
      globalStoreMock: {
        currentSessionRoomId: 'room-1',
        currentSession: null as null | { type?: number }
      },
      sessionStoreMock: {
        sessions,
        sessionList: [],
        sessionOptions: {},
        syncLoading: false,
        getSession: vi.fn((id: string) => sessions[id]),
        getSessionList: vi.fn(() => Object.values(sessions)),
        updateSession: vi.fn((id: string, patch: any) => {
          if (sessions[id]) sessions[id] = { ...sessions[id], ...patch }
        }),
        addSession: vi.fn((s: any) => {
          sessions[s.roomId] = s
        }),
        updateSessionLastActiveTime: vi.fn(),
        markSessionRead: vi.fn(),
        updateTotalUnreadCount: vi.fn(),
        requestUnreadCountUpdate: vi.fn(),
        clearUnreadCount: vi.fn(),
        getGroupSessions: vi.fn(() => []),
        resetSessionSelection: vi.fn(),
        removeSession: vi.fn(),
        clearCurrentSessionUnread: vi.fn()
      },
      groupStoreMock: {
        getUserInfo: vi.fn((_uid: string) => null as { name?: string; avatar?: string } | null),
        myNameInCurrentGroup: ''
      },
      userStoreMock: {
        userInfo: { uid: 'user-self' }
      },
      timerWorkerMock: {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null as null | ((event: { data: { type: string; msgId?: string } }) => void)
      },
      sendNotificationMock: vi.fn()
    }
  })

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/message' })
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: { getCurrent: () => ({ label: 'home' }) }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
}))

vi.mock('@tauri-apps/plugin-notification', () => ({
  sendNotification: (...a: unknown[]) => sendNotificationMock(...a)
}))

vi.mock('@/hooks/useMitt', () => ({
  useMitt: { emit: vi.fn(), on: vi.fn() }
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStoreMock
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => groupStoreMock
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => userStoreMock
}))

vi.mock('../session', () => ({
  useSessionStore: () => sessionStoreMock
}))

vi.mock('../../message', () => ({
  useMessageStore: () => ({ getTimerWorker: vi.fn(() => timerWorkerMock) }),
  pageSize: 20,
  ROOM_MESSAGE_CACHE_LIMIT: 40,
  RECALL_EXPIRATION_TIME: 2 * 60 * 1000
}))

vi.mock('../timerWorker', () => ({
  getTimerWorker: () => timerWorkerMock
}))

vi.mock('@/services/matrix/room/ActionFacade', () => ({
  matrixRoomActionFacade: { getRoom: vi.fn() }
}))

vi.mock('@/services/matrix/MatrixEventService', () => ({
  default: {
    getPagedRoomMessages: vi.fn(),
    getRoomMessages: vi.fn(),
    getMoreRoomMessages: vi.fn(),
    convertEventToMessage: vi.fn()
  }
}))

import { useChatStore } from '@/stores/domains/chat/chat/message'
import type { MessageType } from '@/stores/domains/chat/message'

const createMessage = (
  id: string,
  opts: Partial<{ roomId: string; uid: string; body: any; type: MsgEnum }> = {}
): MessageType => ({
  message: {
    id,
    roomId: opts.roomId ?? 'room-1',
    sendTime: Number(id),
    type: opts.type ?? MsgEnum.TEXT,
    body: opts.body ?? { body: `text-${id}` }
  },
  fromUser: {
    uid: opts.uid ?? 'user-other',
    username: 'tester'
  }
})

const seedSession = (roomId: string, overrides: Record<string, unknown> = {}) => {
  sessionStoreMock.sessions[roomId] = {
    roomId,
    name: roomId,
    type: RoomTypeEnum.SINGLE,
    unreadCount: 0,
    activeTime: 0,
    text: '',
    ...overrides
  }
}

const clearSessions = () => {
  for (const k of Object.keys(sessionStoreMock.sessions)) delete sessionStoreMock.sessions[k]
}

describe('chatStore — pushMsg side effects', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    globalStoreMock.currentSessionRoomId = 'room-1'
    clearSessions()
    sessionStoreMock.updateSession.mockClear()
    sessionStoreMock.addSession.mockClear()
    groupStoreMock.getUserInfo.mockReset().mockReturnValue(null)
    sendNotificationMock.mockClear()
    timerWorkerMock.postMessage.mockClear()
  })

  it('is idempotent: a second pushMsg with same id+sendTime is a no-op', async () => {
    const store = useChatStore()
    seedSession('room-1')

    await store.pushMsg(createMessage('10'))
    sessionStoreMock.updateSession.mockClear()
    await store.pushMsg(createMessage('10'))

    expect(store.chatMessageListByRoomId('room-1')).toHaveLength(1)
    expect(sessionStoreMock.updateSession).not.toHaveBeenCalled()
  })

  it('updates the session text and activeTime to the message body', async () => {
    const store = useChatStore()
    seedSession('room-1')

    await store.pushMsg(createMessage('10', { body: { content: 'hello' } }))

    const lastUpdate = sessionStoreMock.updateSession.mock.calls.at(-1)
    expect(lastUpdate?.[0]).toBe('room-1')
    expect(lastUpdate?.[1]).toMatchObject({ text: 'hello' })
    expect(typeof (lastUpdate?.[1] as any).activeTime).toBe('number')
  })

  it('increments unread when the message is from another user and view is inactive', async () => {
    const store = useChatStore()
    seedSession('room-2', { unreadCount: 4 })

    await store.pushMsg(createMessage('10', { roomId: 'room-2' }), { isActiveChatView: false, activeRoomId: 'room-1' })

    const lastUpdate = sessionStoreMock.updateSession.mock.calls.at(-1)
    expect(lastUpdate?.[1]).toMatchObject({ unreadCount: 5 })
  })

  it('does NOT increment unread when the message is from current user', async () => {
    const store = useChatStore()
    seedSession('room-2', { unreadCount: 4 })

    await store.pushMsg(createMessage('10', { roomId: 'room-2', uid: 'user-self' }), {
      isActiveChatView: false,
      activeRoomId: 'room-1'
    })

    const lastUpdate = sessionStoreMock.updateSession.mock.calls.at(-1)
    expect((lastUpdate?.[1] as any).unreadCount).toBeUndefined()
  })

  it('does NOT increment unread when the room view is currently active', async () => {
    const store = useChatStore()
    seedSession('room-1', { unreadCount: 0 })

    await store.pushMsg(createMessage('10'), { isActiveChatView: true, activeRoomId: 'room-1' })

    const lastUpdate = sessionStoreMock.updateSession.mock.calls.at(-1)
    expect((lastUpdate?.[1] as any).unreadCount).toBeUndefined()
  })

  it('triggers a system notification when atUidList includes the current user', async () => {
    groupStoreMock.getUserInfo.mockReturnValue({ name: 'Bob', avatar: 'mxc://b' })
    const store = useChatStore()
    seedSession('room-1')

    await store.pushMsg(
      createMessage('10', {
        body: { content: '@you', atUidList: ['user-self'] }
      })
    )

    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Bob', body: '@you', icon: 'mxc://b' })
    )
  })

  it('does not notify when atUidList omits current user', async () => {
    groupStoreMock.getUserInfo.mockReturnValue({ name: 'Bob', avatar: 'mxc://b' })
    const store = useChatStore()
    seedSession('room-1')

    await store.pushMsg(createMessage('10', { body: { content: 'hi', atUidList: ['user-other'] } }))

    expect(sendNotificationMock).not.toHaveBeenCalled()
  })
})

describe('chatStore — multi-choose & check toggling', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    globalStoreMock.currentSessionRoomId = 'room-1'
    clearSessions()
  })

  it('clearMsgCheck resets isCheck on all messages of the current room', async () => {
    const store = useChatStore()
    seedSession('room-1')
    await store.pushMsg(createMessage('1'))
    await store.pushMsg(createMessage('2'))

    store.chatMessageList.forEach((m) => (m.isCheck = true))
    store.clearMsgCheck()

    for (const m of store.chatMessageList) {
      expect(m.isCheck).toBe(false)
    }
  })

  it('setMsgMultiChoose toggles flag and respects mode argument', () => {
    const store = useChatStore()
    expect(store.isMsgMultiChoose).toBe(false)

    store.setMsgMultiChoose(true, 'forward')
    expect(store.isMsgMultiChoose).toBe(true)
    expect(store.msgMultiChooseMode).toBe('forward')

    store.setMsgMultiChoose(false)
    expect(store.isMsgMultiChoose).toBe(false)
    expect(store.msgMultiChooseMode).toBe('normal')
  })

  it('setMsgMultiChoose without mode defaults to normal', () => {
    const store = useChatStore()
    store.setMsgMultiChoose(true)
    expect(store.msgMultiChooseMode).toBe('normal')
  })
})

describe('chatStore — room message lookup & cleanup', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    globalStoreMock.currentSessionRoomId = 'room-1'
    clearSessions()
  })

  it('getMessage returns the message from currentMessageMap', async () => {
    const store = useChatStore()
    seedSession('room-1')
    await store.pushMsg(createMessage('42'))

    const msg = store.getMessage('42')
    expect(msg).toBeDefined()
    expect(msg?.message.id).toBe('42')
  })

  it('getMessage returns undefined for unknown id', async () => {
    const store = useChatStore()
    expect(store.getMessage('does-not-exist')).toBeUndefined()
  })

  it('clearRoomMessages wipes message map, sorted keys, and resets options for the room', async () => {
    const store = useChatStore()
    seedSession('room-1')
    await store.pushMsg(createMessage('1'))
    await store.pushMsg(createMessage('2'))

    store.clearRoomMessages('room-1')

    expect(store.chatMessageListByRoomId('room-1')).toEqual([])
    expect(store.sortedMessageKeys['room-1']).toEqual([])
    expect(store.currentMessageOptions).toMatchObject({ isLast: true, isLoading: false, cursor: '' })
  })

  it('clearRoomMessages on a non-current room only resets that room', async () => {
    const store = useChatStore()
    seedSession('room-1')
    seedSession('room-2')
    globalStoreMock.currentSessionRoomId = 'room-1'

    await store.pushMsg(createMessage('1'))
    await store.pushMsg(createMessage('a', { roomId: 'room-2' }), { isActiveChatView: false, activeRoomId: 'room-1' })

    store.clearRoomMessages('room-2')

    expect(store.chatMessageListByRoomId('room-1')).toHaveLength(1)
    expect(store.chatMessageListByRoomId('room-2')).toEqual([])
  })
})

describe('chatStore — recall expiration cleanup', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    globalStoreMock.currentSessionRoomId = 'room-1'
    clearSessions()
    timerWorkerMock.postMessage.mockClear()
    vi.useFakeTimers()
  })

  it('cleanupExpiredRecalledMessages drops entries past the recall TTL', () => {
    const store = useChatStore()

    vi.setSystemTime(new Date(0))
    store.recordRecallMsg({ recallUid: 'user-other', msg: createMessage('99') })
    expect(store.getRecalledMessage('99')).toBeDefined()

    vi.setSystemTime(new Date(2 * 60 * 1000 + 1))
    store.cleanupExpiredRecalledMessages()
    expect(store.getRecalledMessage('99')).toBeUndefined()
  })

  it('clearAllExpirationTimers posts clearTimer for tracked ids and removes them', () => {
    const store = useChatStore()

    store.recordRecallMsg({ recallUid: 'user-self', msg: createMessage('77') })
    timerWorkerMock.postMessage.mockClear()

    store.clearAllExpirationTimers()

    expect(timerWorkerMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'clearTimer', msgId: '77' })
    )
    expect(store.getRecalledMessage('77')).toBeUndefined()
  })
})
