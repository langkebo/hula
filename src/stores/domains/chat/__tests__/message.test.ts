import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { MsgEnum } from '@/enums'

const { globalStoreMock } = vi.hoisted(() => {
  class WorkerMock {
    onerror: ((event: unknown) => void) | null = null
    onmessage: ((event: MessageEvent) => void) | null = null

    postMessage() {}

    terminate() {}
  }

  vi.stubGlobal('Worker', WorkerMock)

  return {
    globalStoreMock: {
      currentSessionRoomId: 'room-1'
    }
  }
})

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: '/message'
  })
}))

vi.mock('@tauri-apps/plugin-notification', () => ({
  sendNotification: vi.fn()
}))

vi.mock('@/hooks/useMitt', () => ({
  useMitt: {
    emit: vi.fn()
  }
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStoreMock
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    userInfo: {
      uid: 'user-1'
    }
  })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: vi.fn(() => null)
  })
}))

vi.mock('@/stores/domains/chat/chat/session', () => ({
  useSessionStore: () => ({
    sessionList: [],
    sessionOptions: {},
    syncLoading: false,
    getSession: vi.fn(() => undefined),
    updateSession: vi.fn(),
    markSessionRead: vi.fn(),
    addSession: vi.fn(),
    removeSession: vi.fn(),
    resetSessionSelection: vi.fn(),
    updateSessionLastActiveTime: vi.fn(),
    getSessionList: vi.fn(),
    updateTotalUnreadCount: vi.fn(),
    requestUnreadCountUpdate: vi.fn(),
    clearUnreadCount: vi.fn(),
    clearCurrentSessionUnread: vi.fn(),
    getGroupSessions: vi.fn(() => [])
  })
}))

vi.mock('@/services/matrix/room/MatrixRoomService', () => ({
  matrixRoomService: {
    getRoom: vi.fn(() => null)
  }
}))

import { useMessageStore, type MessageType } from '@/stores/domains/chat/message'

const createMessage = (id: string, roomId = 'room-1'): MessageType => ({
  message: {
    id,
    roomId,
    sendTime: Number(id),
    type: MsgEnum.TEXT,
    body: {
      body: `message-${id}`
    }
  },
  fromUser: {
    uid: 'user-2',
    username: 'tester'
  }
})

describe('MessageStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    globalStoreMock.currentSessionRoomId = 'room-1'
  })

  it('should not register component lifecycle hooks when store is instantiated', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    useMessageStore()

    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('onUnmounted is called'))
    warnSpy.mockRestore()
  })

  it('should cache sorted room message list until room messages change', async () => {
    const store = useMessageStore()

    await store.pushMsg(createMessage('3'))
    await store.pushMsg(createMessage('1'))
    await store.pushMsg(createMessage('2'))

    const firstRead = store.chatMessageListByRoomId('room-1')
    const secondRead = store.chatMessageListByRoomId('room-1')

    expect(firstRead.map((item: MessageType) => item.message.id)).toEqual(['1', '2', '3'])
    expect(secondRead.map((item: MessageType) => item.message.id)).toEqual(['1', '2', '3'])
  })

  it('should invalidate cached list when messages are deleted', async () => {
    const store = useMessageStore()

    await store.pushMsg(createMessage('1'))
    await store.pushMsg(createMessage('2'))

    const firstRead = store.chatMessageListByRoomId('room-1')
    store.deleteMsg('1')
    const secondRead = store.chatMessageListByRoomId('room-1')

    expect(firstRead.map((item) => item.message.id)).toEqual(['1', '2'])
    expect(secondRead.map((item) => item.message.id)).toEqual(['2'])
    expect(secondRead).not.toBe(firstRead)
  })

  it('should reuse cached indexes for current room lookups', async () => {
    const store = useMessageStore()

    await store.pushMsg(createMessage('30'))
    await store.pushMsg(createMessage('10'))
    await store.pushMsg(createMessage('20'))

    expect(store.getMsgIndex('10')).toBe(0)
    expect(store.getMsgIndex('20')).toBe(1)
    expect(store.getMsgIndex('30')).toBe(2)
  })

  it('should keep newest messages when trimming redundant room cache', async () => {
    const store = useMessageStore()

    await store.pushMsg(createMessage('1', 'room-2'), { isActiveChatView: false, activeRoomId: 'room-1' })
    await store.pushMsg(createMessage('2', 'room-2'), { isActiveChatView: false, activeRoomId: 'room-1' })
    await store.pushMsg(createMessage('3', 'room-2'), { isActiveChatView: false, activeRoomId: 'room-1' })

    store.clearRedundantMessages('room-2', 2)

    expect(store.chatMessageListByRoomId('room-2').map((item) => item.message.id)).toEqual(['2', '3'])
    expect(store.getMessageIndexByRoomId('room-2', '1')).toBe(-1)
    expect(store.getMessageIndexByRoomId('room-2', '2')).toBe(0)
    expect(store.getMessageIndexByRoomId('room-2', '3')).toBe(1)
  })

  it('should reuse adapter-based event type mapping for store message conversion', () => {
    const store = useMessageStore()
    const room = {
      roomId: 'room-1',
      getMember: vi.fn(() => ({
        name: 'tester',
        getMxcAvatarUrl: vi.fn(() => 'mxc://avatar')
      }))
    } as any

    const voiceEvent = {
      getContent: () => ({ msgtype: 'm.voice', body: 'voice.ogg' }),
      getSender: () => '@user:server',
      getType: () => 'm.room.message',
      getId: () => '$voice',
      getTs: () => 123
    } as any

    const recallEvent = {
      getContent: () => ({ reason: '撤回' }),
      getSender: () => '@user:server',
      getType: () => 'm.room.redaction',
      getId: () => '$recall',
      getTs: () => 456
    } as any

    expect(store.convertEventToMessage(voiceEvent, room)?.message.type).toBe(MsgEnum.VOICE)
    expect(store.convertEventToMessage(recallEvent, room)?.message.type).toBe(MsgEnum.RECALL)
  })
})
