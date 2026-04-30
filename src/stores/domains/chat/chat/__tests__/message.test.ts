import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageStatusEnum, MsgEnum } from '@/enums'

const { globalStoreMock, timerWorkerMock, sessionStoreMock } = vi.hoisted(() => ({
  globalStoreMock: {
    currentSessionRoomId: 'room-1',
    currentSession: null as null | { type?: number }
  },
  timerWorkerMock: {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null as null | ((event: { data: { type: string; msgId?: string } }) => void)
  },
  sessionStoreMock: {
    sessionList: [],
    sessionOptions: {},
    syncLoading: false,
    getSession: vi.fn(() => undefined),
    getSessionList: vi.fn(() => []),
    updateSession: vi.fn(),
    updateSessionLastActiveTime: vi.fn(),
    markSessionRead: vi.fn(),
    updateTotalUnreadCount: vi.fn(),
    requestUnreadCountUpdate: vi.fn(),
    clearUnreadCount: vi.fn(),
    getGroupSessions: vi.fn(() => []),
    resetSessionSelection: vi.fn(),
    addSession: vi.fn(),
    removeSession: vi.fn(),
    clearCurrentSessionUnread: vi.fn()
  }
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: '/message'
  })
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getCurrent: () => ({
      label: 'home'
    })
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn()
}))

vi.mock('@tauri-apps/plugin-notification', () => ({
  sendNotification: vi.fn()
}))

vi.mock('@/hooks/useMitt', () => ({
  useMitt: {
    emit: vi.fn(),
    on: vi.fn()
  }
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStoreMock
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: vi.fn(() => null),
    myNameInCurrentGroup: ''
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    userInfo: {
      uid: 'user-1'
    }
  })
}))

vi.mock('../session', () => ({
  useSessionStore: () => sessionStoreMock
}))

vi.mock('../../message', () => ({
  useMessageStore: () => ({
    getTimerWorker: vi.fn(() => timerWorkerMock)
  }),
  pageSize: 20,
  ROOM_MESSAGE_CACHE_LIMIT: 40,
  RECALL_EXPIRATION_TIME: 2 * 60 * 1000
}))

vi.mock('../timerWorker', () => ({
  getTimerWorker: () => timerWorkerMock
}))

vi.mock('@/services/matrix/room/MatrixRoomService', () => ({
  matrixRoomService: {
    getRoom: vi.fn()
  }
}))

vi.mock('@/services/matrix/MatrixEventService', () => ({
  default: {
    getPagedRoomMessages: vi.fn(),
    getRoomMessages: vi.fn(),
    getMoreRoomMessages: vi.fn(),
    convertEventToMessage: vi.fn()
  }
}))

import matrixEventService from '@/services/matrix/MatrixEventService'
import { useChatStore } from '@/stores/domains/chat/chat/message'
import type { MessageType } from '@/stores/domains/chat/message'

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

describe('ChatMessageStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    globalStoreMock.currentSessionRoomId = 'room-1'
    globalStoreMock.currentSession = null
    timerWorkerMock.postMessage.mockClear()
    timerWorkerMock.terminate.mockClear()
    timerWorkerMock.onmessage = null
  })

  it('should return message index based on sorted message keys', async () => {
    const store = useChatStore()

    await store.pushMsg(createMessage('30'))
    await store.pushMsg(createMessage('10'))
    await store.pushMsg(createMessage('20'))

    expect(store.getMsgIndex('10')).toBe(0)
    expect(store.getMsgIndex('20')).toBe(1)
    expect(store.getMsgIndex('30')).toBe(2)
  })

  it('should keep newest messages when trimming redundant room cache', async () => {
    const store = useChatStore()

    await store.pushMsg(createMessage('1', 'room-2'), { isActiveChatView: false, activeRoomId: 'room-1' })
    await store.pushMsg(createMessage('2', 'room-2'), { isActiveChatView: false, activeRoomId: 'room-1' })
    await store.pushMsg(createMessage('3', 'room-2'), { isActiveChatView: false, activeRoomId: 'room-1' })

    store.clearRedundantMessages('room-2', 2)
    globalStoreMock.currentSessionRoomId = 'room-2'

    expect(store.chatMessageListByRoomId('room-2').map((item) => item.message.id)).toEqual(['2', '3'])
    expect(store.getMsgIndex('1')).toBe(-1)
    expect(store.getMsgIndex('2')).toBe(0)
    expect(store.getMsgIndex('3')).toBe(1)
  })

  it('should rebuild sorted keys before trimming when only message map is present', async () => {
    const store = useChatStore()

    await store.pushMsg(createMessage('3', 'room-3'), { isActiveChatView: false, activeRoomId: 'room-1' })
    await store.pushMsg(createMessage('1', 'room-3'), { isActiveChatView: false, activeRoomId: 'room-1' })
    await store.pushMsg(createMessage('2', 'room-3'), { isActiveChatView: false, activeRoomId: 'room-1' })

    store.sortedMessageKeys['room-3'] = []
    store.clearRedundantMessages('room-3', 2)

    expect(store.chatMessageListByRoomId('room-3').map((item) => item.message.id)).toEqual(['2', '3'])
    expect(store.sortedMessageKeys['room-3']).toEqual(['2', '3'])
  })

  it('should update cached indexes after deleting a message', async () => {
    const store = useChatStore()

    await store.pushMsg(createMessage('10'))
    await store.pushMsg(createMessage('20'))
    await store.pushMsg(createMessage('30'))

    store.deleteMsg('20')

    expect(store.chatMessageListByRoomId('room-1').map((item) => item.message.id)).toEqual(['10', '30'])
    expect(store.getMsgIndex('20')).toBe(-1)
    expect(store.getMsgIndex('30')).toBe(1)
  })

  it('should rebuild cached indexes after message id replacement', async () => {
    const store = useChatStore()

    await store.pushMsg(createMessage('10'))
    await store.pushMsg(createMessage('20'))
    await store.pushMsg(createMessage('30'))

    store.updateMsg({
      msgId: '20',
      newMsgId: '25',
      status: MessageStatusEnum.SUCCESS,
      roomId: 'room-1'
    })

    expect(store.chatMessageListByRoomId('room-1').map((item) => item.message.id)).toEqual(['10', '25', '30'])
    expect(store.getMsgIndex('20')).toBe(-1)
    expect(store.getMsgIndex('25')).toBe(1)
  })

  it('should migrate reply references after message id replacement', async () => {
    const store = useChatStore()
    const replyMessage = createMessage('21')

    await store.pushMsg(createMessage('20'))
    await store.pushMsg({
      ...replyMessage,
      message: {
        ...replyMessage.message,
        body: {
          body: 'reply-message',
          reply: {
            id: '20',
            roomId: 'room-1',
            body: 'origin-message'
          }
        }
      }
    })

    store.updateMsg({
      msgId: '20',
      newMsgId: '25',
      status: MessageStatusEnum.SUCCESS,
      roomId: 'room-1'
    })

    const migratedReplyMessage = store.chatMessageListByRoomId('room-1').find((item) => item.message.id === '21')

    expect(store.currentReplyMap['20']).toBeUndefined()
    expect(store.currentReplyMap['25']).toEqual(['21'])
    expect(migratedReplyMessage?.message.body.reply?.id).toBe('25')
  })

  it('should keep recalled messages when worker reports all timers completed', () => {
    const store = useChatStore()

    store.recordRecallMsg({
      recallUid: 'user-2',
      msg: createMessage('50')
    })

    timerWorkerMock.onmessage?.({
      data: {
        type: 'allTimersCompleted'
      }
    })

    expect(store.getRecalledMessage('50')).toBeDefined()
    expect(timerWorkerMock.terminate).not.toHaveBeenCalled()
  })

  it('should update message in another room without passing roomId', async () => {
    const store = useChatStore()

    await store.pushMsg(createMessage('10', 'room-2'), { isActiveChatView: false, activeRoomId: 'room-1' })
    globalStoreMock.currentSessionRoomId = 'room-1'

    store.updateMsg({
      msgId: '10',
      status: MessageStatusEnum.SUCCESS,
      body: {
        body: 'updated-from-index'
      }
    })

    expect(store.chatMessageListByRoomId('room-2')[0]?.message.body.body).toBe('updated-from-index')
  })

  it('should update replied message preview when recalled message is in another room', async () => {
    const store = useChatStore()
    const replyMessage = createMessage('11', 'room-2')

    globalStoreMock.currentSessionRoomId = 'room-2'
    await store.pushMsg(createMessage('10', 'room-2'), { isActiveChatView: true, activeRoomId: 'room-2' })
    await store.pushMsg(
      {
        ...replyMessage,
        message: {
          ...replyMessage.message,
          body: {
            body: 'reply-message',
            reply: {
              id: '10',
              roomId: 'room-2',
              body: 'origin-message'
            }
          }
        }
      },
      { isActiveChatView: true, activeRoomId: 'room-2' }
    )

    globalStoreMock.currentSessionRoomId = 'room-1'
    await store.updateRecallMsg({
      msgId: '10',
      roomId: 'room-2',
      recallUid: 'user-3'
    })

    const recalledReplyBody = store.chatMessageListByRoomId('room-2')[1]?.message.body.reply?.body
    expect(recalledReplyBody).toBe('原消息已被撤回')
  })

  it('should reuse adapter-based event type mapping when loading remote messages', async () => {
    const store = useChatStore()
    vi.mocked(matrixEventService.getPagedRoomMessages).mockResolvedValue({
      messages: [
        {
          fromUser: { uid: '@user:server', username: 'tester', avatar: 'mxc://avatar' },
          message: {
            id: '1',
            roomId: 'room-1',
            type: MsgEnum.VOICE,
            body: { msgtype: 'm.voice', body: 'voice.ogg' },
            sendTime: 123,
            messageMarks: {},
            status: MessageStatusEnum.SUCCESS
          },
          sendTime: 123
        },
        {
          fromUser: { uid: '@user:server', username: 'tester', avatar: 'mxc://avatar' },
          message: {
            id: '2',
            roomId: 'room-1',
            type: MsgEnum.RECALL,
            body: { reason: '撤回' },
            sendTime: 456,
            messageMarks: {},
            status: MessageStatusEnum.SUCCESS
          },
          sendTime: 456
        }
      ],
      isLast: true,
      cursor: ''
    })

    await store.fetchCurrentRoomRemoteOnce()

    expect(store.chatMessageListByRoomId('room-1').map((item) => item.message.type)).toEqual([
      MsgEnum.VOICE,
      MsgEnum.RECALL
    ])
  })

  it('should fetch current room messages and mark session as read when changing session', async () => {
    const store = useChatStore()
    await store.pushMsg(createMessage('1', 'room-2'), { isActiveChatView: false, activeRoomId: 'room-1' })

    vi.mocked(matrixEventService.getPagedRoomMessages).mockResolvedValue({
      messages: [
        {
          fromUser: { uid: '@user:server', username: 'tester', avatar: 'mxc://avatar' },
          message: {
            id: '101',
            roomId: 'room-1',
            type: MsgEnum.TEXT,
            body: { body: 'remote-101', content: 'remote-101' },
            sendTime: 101,
            messageMarks: {},
            status: MessageStatusEnum.SUCCESS
          },
          sendTime: 101
        }
      ],
      isLast: true,
      cursor: ''
    })

    await store.changeRoom()

    expect(matrixEventService.getPagedRoomMessages).toHaveBeenCalledWith('room-1', 20, '')
    expect(store.chatMessageListByRoomId('room-1').map((item) => item.message.id)).toEqual(['101'])
    expect(store.chatMessageListByRoomId('room-2')).toEqual([])
    expect(sessionStoreMock.markSessionRead).toHaveBeenCalledWith('room-1')
  })

  it('should merge remote page messages into existing sorted keys incrementally', async () => {
    const store = useChatStore()
    vi.mocked(matrixEventService.getPagedRoomMessages).mockResolvedValue({
      messages: [
        {
          fromUser: { uid: '@user:server', username: 'tester', avatar: 'mxc://avatar' },
          message: {
            id: '20',
            roomId: 'room-1',
            type: MsgEnum.TEXT,
            body: { body: 'remote-20', content: 'remote-20' },
            sendTime: 200,
            messageMarks: {},
            status: MessageStatusEnum.SUCCESS
          },
          sendTime: 200
        },
        {
          fromUser: { uid: '@user:server', username: 'tester', avatar: 'mxc://avatar' },
          message: {
            id: '40',
            roomId: 'room-1',
            type: MsgEnum.TEXT,
            body: { body: 'remote-40', content: 'remote-40' },
            sendTime: 400,
            messageMarks: {},
            status: MessageStatusEnum.SUCCESS
          },
          sendTime: 400
        }
      ],
      isLast: true,
      cursor: ''
    })

    await store.pushMsg(createMessage('10'))
    await store.pushMsg(createMessage('30'))

    await store.fetchCurrentRoomRemoteOnce()

    expect(store.chatMessageListByRoomId('room-1').map((item) => item.message.id)).toEqual(['10', '20', '30', '40'])
    expect(store.getMsgIndex('20')).toBe(1)
    expect(store.getMsgIndex('40')).toBe(3)
  })
})
