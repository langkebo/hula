import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, reactive, ref } from 'vue'
import { MsgEnum, RoomTypeEnum, UserType } from '@/enums'

const networkStateMock = {
  browserOnline: ref(true),
  isWsConnecting: ref(false),
  wsOnline: ref(true)
}

const chatStoreMock = reactive({
  syncLoading: false,
  sessionOptions: { isLoading: false },
  sessionList: [] as Array<Record<string, unknown>>,
  getSessionList: vi.fn(async () => undefined),
  chatMessageListByRoomId: vi.fn<(roomId: string) => Array<Record<string, unknown>>>()
})

const globalStoreMock = reactive({
  currentSessionRoomId: 'room-group'
})

const groupStoreMock = reactive({
  getUserInfo: vi.fn((detailId: string) => (detailId === 'user-1' ? { avatar: 'new-avatar.png' } : undefined))
})

const botStoreMock = reactive({
  displayText: 'bot-display'
})

const replaceMsgMock = {
  checkRoomAtMe: vi.fn((roomId: string) => roomId === 'room-group'),
  getMessageSenderName: vi.fn((_: unknown, __: string, roomId: string) => `sender-${roomId}`),
  formatMessageContent: vi.fn((_: unknown, __: unknown, ___: string, roomId: string) => `formatted-${roomId}`)
}

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => chatStoreMock
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStoreMock
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => groupStoreMock
}))

vi.mock('@/stores/domains/user/bot', () => ({
  useBotStore: () => botStoreMock
}))

vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => networkStateMock
}))

vi.mock('@/hooks/useReplaceMsg.ts', () => ({
  useReplaceMsg: () => replaceMsgMock
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/utils/ComputedTime.ts', () => ({
  formatTimestamp: (value: number) => `ts-${value}`
}))

const { useSessionListState } = await import('../useSessionListState')

const flushAll = async () => {
  await flushPromises()
  await nextTick()
  await flushPromises()
}

const createHarness = async () => {
  let api!: ReturnType<typeof useSessionListState>

  const Harness = defineComponent({
    setup() {
      api = useSessionListState()
      return () => null
    }
  })

  const wrapper = mount(Harness)
  await flushAll()

  return { wrapper, api }
}

describe('useSessionListState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    networkStateMock.browserOnline.value = true
    networkStateMock.isWsConnecting.value = false
    networkStateMock.wsOnline.value = true
    chatStoreMock.syncLoading = false
    chatStoreMock.sessionOptions.isLoading = false
    chatStoreMock.getSessionList.mockResolvedValue(undefined)
    globalStoreMock.currentSessionRoomId = 'room-group'
    botStoreMock.displayText = 'bot-display'

    chatStoreMock.sessionList = [
      {
        roomId: 'room-single',
        type: RoomTypeEnum.SINGLE,
        detailId: 'user-1',
        avatar: 'old-avatar.png',
        name: '单聊',
        account: UserType.BOT,
        unreadCount: 0,
        activeTime: 100,
        top: false,
        shield: false
      },
      {
        roomId: 'room-group',
        type: RoomTypeEnum.GROUP,
        avatar: 'group-avatar.png',
        name: '原群名',
        remark: '群备注名',
        unreadCount: 2,
        activeTime: 50,
        top: true,
        shield: true
      }
    ]

    chatStoreMock.chatMessageListByRoomId.mockImplementation((roomId: string) => {
      if (roomId === 'room-group') {
        return [
          {
            message: {
              sendTime: 10,
              type: MsgEnum.TEXT
            }
          }
        ]
      }

      return [
        {
          message: {
            sendTime: 20,
            type: MsgEnum.TEXT
          }
        }
      ]
    })

    replaceMsgMock.checkRoomAtMe.mockImplementation((roomId: string) => roomId === 'room-group')
    replaceMsgMock.getMessageSenderName.mockImplementation(
      (_: unknown, __: string, roomId: string) => `sender-${roomId}`
    )
    replaceMsgMock.formatMessageContent.mockImplementation(
      (_: unknown, __: unknown, ___: string, roomId: string) => `formatted-${roomId}`
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('derives the network banner from browser and websocket state', async () => {
    const { wrapper, api } = await createHarness()

    expect(api.networkBanner.value).toBeNull()

    networkStateMock.browserOnline.value = false
    await flushAll()
    expect(api.networkBanner.value).toEqual({
      text: 'home.chat_main.network_offline',
      retryable: false
    })

    networkStateMock.browserOnline.value = true
    networkStateMock.isWsConnecting.value = true
    await flushAll()
    expect(api.networkBanner.value).toEqual({
      text: 'home.chat_main.network_connecting',
      retryable: false
    })

    networkStateMock.isWsConnecting.value = false
    networkStateMock.wsOnline.value = false
    await flushAll()
    expect(api.networkBanner.value).toEqual({
      text: 'home.chat_main.network_ws_offline',
      retryable: true
    })

    wrapper.unmount()
  })

  it('maps session display data, keeps pinned sessions first, and computes item classes', async () => {
    const { wrapper, api } = await createHarness()

    expect(api.sessionList.value.map((item) => item.roomId)).toEqual(['room-group', 'room-single'])
    expect(api.sessionList.value[0]).toEqual(
      expect.objectContaining({
        roomId: 'room-group',
        name: '群备注名',
        lastMsg: 'formatted-room-group',
        lastMsgTime: 'ts-50',
        isAtMe: true
      })
    )
    expect(api.sessionList.value[1]).toEqual(
      expect.objectContaining({
        roomId: 'room-single',
        avatar: 'new-avatar.png',
        lastMsg: 'bot-display',
        lastMsgTime: 'ts-100'
      })
    )
    expect(api.selectedSession.value?.roomId).toBe('room-group')

    api.handleMenuShow('room-group', true)
    expect(
      api.getItemClasses({
        roomId: 'room-group',
        account: UserType.BOT,
        shield: true
      } as never)
    ).toEqual(
      expect.objectContaining({
        active: true,
        'active-bot': true,
        'active-shield': true,
        'context-menu-active': true,
        'context-menu-active-shield': true,
        'active-context-menu': true
      })
    )

    wrapper.unmount()
  })

  it('retries session loading and refreshes cached display text after invalidation', async () => {
    const { wrapper, api } = await createHarness()

    expect(api.sessionList.value[0].lastMsg).toBe('formatted-room-group')

    replaceMsgMock.formatMessageContent.mockImplementation(
      (_: unknown, __: unknown, ___: string, roomId: string) => `updated-${roomId}`
    )
    expect(api.sessionList.value[0].lastMsg).toBe('formatted-room-group')

    api.invalidateSessionCache('room-group')
    await flushAll()
    expect(api.sessionList.value[0].lastMsg).toBe('updated-room-group')

    await api.retrySessions()
    expect(chatStoreMock.getSessionList).toHaveBeenCalledWith(true)
    expect(chatStoreMock.syncLoading).toBe(false)

    chatStoreMock.syncLoading = true
    await api.retrySessions()
    expect(chatStoreMock.getSessionList).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('falls back to session text when room messages are not cached locally', async () => {
    chatStoreMock.sessionList = [
      ...chatStoreMock.sessionList,
      {
        roomId: 'room-fallback',
        type: RoomTypeEnum.GROUP,
        avatar: 'fallback-avatar.png',
        name: '回退群',
        unreadCount: 0,
        activeTime: 80,
        top: false,
        shield: false,
        text: 'timeline-preview'
      }
    ]

    chatStoreMock.chatMessageListByRoomId.mockImplementation((roomId: string) => {
      if (roomId === 'room-group') {
        return [
          {
            message: {
              sendTime: 10,
              type: MsgEnum.TEXT
            }
          }
        ]
      }

      return []
    })

    const { wrapper, api } = await createHarness()

    expect(api.sessionList.value.find((item) => item.roomId === 'room-fallback')?.lastMsg).toBe('timeline-preview')

    wrapper.unmount()
  })
})
