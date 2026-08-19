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
  chatMessageListByRoomId: vi.fn<(roomId: string) => Array<Record<string, unknown>>>(),
  getLastMessageByRoomId: vi.fn((roomId: string) => {
    const arr = chatStoreMock.chatMessageListByRoomId(roomId)
    return arr[arr.length - 1]
  }),
  getSession: vi.fn((roomId: string) => sessionStoreMock.sessionList.find((s) => s.roomId === roomId))
})

const sessionStoreMock = reactive({
  syncLoading: false,
  sessionOptions: { isLoading: false },
  sessionList: [] as Array<Record<string, unknown>>,
  getSessionList: vi.fn(async () => undefined)
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
  useChatStore: () => chatStoreMock,
  useSessionStore: () => sessionStoreMock
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

vi.mock('@/composables/common/useNetworkStatus', () => ({
  useNetworkStatus: () => networkStateMock
}))

vi.mock('@/composables/chat/useReplaceMsg', () => ({
  useReplaceMsg: () => replaceMsgMock
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/utils/ComputedTime.ts', () => ({
  formatChatTime: (value: number) => `ts-${value}`
}))

const { useSessionListState, useSessionLastMsg } = await import('../useSessionListState')

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
    sessionStoreMock.syncLoading = false
    sessionStoreMock.sessionOptions.isLoading = false
    sessionStoreMock.getSessionList.mockResolvedValue(undefined)
    globalStoreMock.currentSessionRoomId = 'room-group'
    botStoreMock.displayText = 'bot-display'

    sessionStoreMock.sessionList = [
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
    networkStateMock.wsOnline.value = false
    await flushAll()
    expect(api.networkBanner.value).toEqual({
      text: 'home.chat_main.network_offline',
      retryable: false
    })

    networkStateMock.browserOnline.value = true
    networkStateMock.wsOnline.value = true
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

  it('maps session display data and keeps pinned sessions first', async () => {
    const { wrapper, api } = await createHarness()

    expect(api.sessionList.value.map((item) => item.roomId)).toEqual(['room-group', 'room-single'])
    expect(api.sessionList.value[0]).toEqual(
      expect.objectContaining({
        roomId: 'room-group',
        name: '群备注名'
      })
    )
    expect(api.sessionList.value[1]).toEqual(
      expect.objectContaining({
        roomId: 'room-single',
        avatar: 'new-avatar.png'
      })
    )
    expect(api.selectedSession.value?.roomId).toBe('room-group')

    // 末条预览已下沉到 useSessionLastMsg（按 roomId 细粒度）
    const groupPreview = useSessionLastMsg('room-group')
    const singlePreview = useSessionLastMsg('room-single')
    expect(groupPreview.lastMessage.value).toBe('formatted-room-group')
    expect(groupPreview.lastMsgTime.value).toBe('ts-50')
    expect(groupPreview.isAtMe.value).toBe(true)
    expect(singlePreview.lastMessage.value).toBe('bot-display')
    expect(singlePreview.lastMsgTime.value).toBe('ts-100')

    wrapper.unmount()
  })

  it('retries session loading and refreshes cached display text after invalidation', async () => {
    const { wrapper, api } = await createHarness()

    // 持有同一实例：末条预览的缓存随实例生命周期，非法调用 invalidateSessionCache 不算脏
    const groupPreview = useSessionLastMsg('room-group')
    expect(groupPreview.lastMessage.value).toBe('formatted-room-group')

    replaceMsgMock.formatMessageContent.mockImplementation(
      (_: unknown, __: unknown, ___: string, roomId: string) => `updated-${roomId}`
    )
    expect(groupPreview.lastMessage.value).toBe('formatted-room-group')

    api.invalidateSessionCache()
    await flushAll()
    expect(groupPreview.lastMessage.value).toBe('updated-room-group')

    await api.retrySessions()
    expect(sessionStoreMock.getSessionList).toHaveBeenCalledWith(true)
    expect(sessionStoreMock.syncLoading).toBe(false)

    sessionStoreMock.syncLoading = true
    await api.retrySessions()
    expect(sessionStoreMock.getSessionList).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('falls back to session text when room messages are not cached locally', async () => {
    sessionStoreMock.sessionList = [
      ...sessionStoreMock.sessionList,
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

    const { wrapper } = await createHarness()

    expect(useSessionLastMsg('room-fallback').lastMessage.value).toBe('timeline-preview')

    wrapper.unmount()
  })

  it('reacts to session store updates after the composable has mounted', async () => {
    const { wrapper, api } = await createHarness()

    expect(api.sessionList.value.map((item) => item.roomId)).toEqual(['room-group', 'room-single'])

    sessionStoreMock.sessionList = [
      {
        roomId: 'room-live',
        type: RoomTypeEnum.GROUP,
        avatar: 'live-avatar.png',
        name: '实时会话',
        unreadCount: 0,
        activeTime: 200,
        top: false,
        shield: false
      }
    ]

    chatStoreMock.chatMessageListByRoomId.mockImplementation(() => [])

    await flushAll()

    expect(api.sessionList.value.map((item) => item.roomId)).toEqual(['room-live'])

    wrapper.unmount()
  })

  it('同一对方用户的多个 DM 会话只保留最近活跃一条（根因 C 去重，含 localpart 归一化）', async () => {
    sessionStoreMock.sessionList = [
      {
        roomId: 'dm-old',
        type: RoomTypeEnum.SINGLE,
        detailId: 'test1', // localpart 形式（历史数据）
        name: 'test1(旧)',
        unreadCount: 0,
        activeTime: 100,
        top: false,
        shield: false
      },
      {
        roomId: 'dm-new',
        type: RoomTypeEnum.SINGLE,
        detailId: '@test1:matrix.test', // 完整 MXID 形式
        name: 'test1(新)',
        unreadCount: 0,
        activeTime: 300,
        top: false,
        shield: false
      },
      {
        roomId: 'room-group',
        type: RoomTypeEnum.GROUP,
        name: '群聊',
        unreadCount: 0,
        activeTime: 50,
        top: false,
        shield: false
      }
    ]

    chatStoreMock.chatMessageListByRoomId.mockImplementation(() => [])

    const { wrapper, api } = await createHarness()

    const roomIds = api.sessionList.value.map((item) => item.roomId)
    expect(roomIds).toContain('dm-new') // 最近一条 test1 DM 保留
    expect(roomIds).not.toContain('dm-old') // 旧 DM 被过滤
    expect(roomIds).toContain('room-group')

    wrapper.unmount()
  })

  it('同人重复 DM 房间去重时未读数累加到保留条目（数字角标正确）', async () => {
    sessionStoreMock.sessionList = [
      {
        roomId: 'dm-old',
        type: RoomTypeEnum.SINGLE,
        detailId: '@test1:matrix.test',
        name: 'test1(旧)',
        unreadCount: 5,
        activeTime: 100,
        top: false,
        shield: false
      },
      {
        roomId: 'dm-new',
        type: RoomTypeEnum.SINGLE,
        detailId: '@test1:matrix.test',
        name: 'test1(新)',
        unreadCount: 2,
        activeTime: 300,
        top: false,
        shield: false
      }
    ]

    chatStoreMock.chatMessageListByRoomId.mockImplementation(() => [])

    const { wrapper, api } = await createHarness()

    const items = api.sessionList.value
    expect(items).toHaveLength(1) // 只保留一条 test1
    expect(items[0].roomId).toBe('dm-new') // 保留更活跃的一条
    expect(items[0].unreadCount).toBe(7) // 未读 5 + 2 累加

    wrapper.unmount()
  })

  it('空间(SPACE)及非聊天类条目不进入会话列表', async () => {
    sessionStoreMock.sessionList = [
      {
        roomId: 'room-space',
        type: RoomTypeEnum.SPACE,
        name: '空间',
        unreadCount: 0,
        activeTime: 500,
        top: false,
        shield: false
      },
      {
        roomId: 'room-group',
        type: RoomTypeEnum.GROUP,
        name: '群聊',
        unreadCount: 0,
        activeTime: 50,
        top: false,
        shield: false
      }
    ]

    chatStoreMock.chatMessageListByRoomId.mockImplementation(() => [])

    const { wrapper, api } = await createHarness()

    const roomIds = api.sessionList.value.map((item) => item.roomId)
    expect(roomIds).toContain('room-group')
    expect(roomIds).not.toContain('room-space')

    wrapper.unmount()
  })

  it('detailId 缺失时用房间成员兜底解析 counterpart，仍能合并同一联系人的重复 DM（防御纵深）', async () => {
    const matrixClientService = (await import('@/services/matrix/MatrixClientService')).default
    const getRoomSpy = vi.spyOn(matrixClientService, 'getRoom').mockReturnValue({
      getMembers: () => [
        { userId: '@me:matrix.test', membership: 'join' },
        { userId: '@test1:matrix.test', membership: 'join' }
      ]
    } as never)
    const getClientSpy = vi
      .spyOn(matrixClientService, 'getClient')
      .mockReturnValue({ getUserId: () => '@me:matrix.test' } as never)

    sessionStoreMock.sessionList = [
      {
        roomId: 'dm-1',
        type: RoomTypeEnum.SINGLE,
        name: 'test1',
        unreadCount: 1,
        activeTime: 100,
        top: false,
        shield: false
        // 无 detailId/account：模拟服务重建时成员状态未就绪的会话
      },
      {
        roomId: 'dm-2',
        type: RoomTypeEnum.SINGLE,
        name: 'test1',
        unreadCount: 2,
        activeTime: 300,
        top: false,
        shield: false
      }
    ]

    chatStoreMock.chatMessageListByRoomId.mockImplementation(() => [])

    const { wrapper, api } = await createHarness()

    const items = api.sessionList.value
    expect(items).toHaveLength(1) // 兜底解析后仍只保留一条 test1
    expect(items[0].roomId).toBe('dm-2')
    expect(items[0].unreadCount).toBe(3) // 未读累加

    getRoomSpy.mockRestore()
    getClientSpy.mockRestore()
    wrapper.unmount()
  })

  it('合并重复 DM 时保留身份字段 detailId/account（保留条目不缺 counterpart）', async () => {
    sessionStoreMock.sessionList = [
      {
        roomId: 'dm-old',
        type: RoomTypeEnum.SINGLE,
        account: 'test1', // 旧房间只有 localpart account，无 detailId
        name: 'test1(旧)',
        unreadCount: 5,
        activeTime: 300, // 更活跃 → 作为保留条目
        top: false,
        shield: false
      },
      {
        roomId: 'dm-new',
        type: RoomTypeEnum.SINGLE,
        detailId: '@test1:matrix.test', // 新房间有完整 detailId
        name: 'test1(新)',
        unreadCount: 2,
        activeTime: 100,
        top: false,
        shield: false
      }
    ]

    chatStoreMock.chatMessageListByRoomId.mockImplementation(() => [])

    const { wrapper, api } = await createHarness()

    const items = api.sessionList.value
    expect(items).toHaveLength(1)
    expect(items[0].roomId).toBe('dm-old') // 保留更活跃的 dm-old
    expect(items[0].detailId).toBe('@test1:matrix.test') // 身份字段从 dm-new 补全
    expect(items[0].unreadCount).toBe(7)

    wrapper.unmount()
  })

  it('结构层与消息内容解耦：会话列表重算时不读取 chatMessageListByRoomId', async () => {
    await createHarness()

    chatStoreMock.chatMessageListByRoomId.mockClear()
    // 触发一次会话列表重算（改变 sessionStore）
    sessionStoreMock.sessionList = [
      {
        roomId: 'room-x',
        type: RoomTypeEnum.GROUP,
        name: 'X',
        unreadCount: 0,
        activeTime: 10,
        top: false,
        shield: false
      }
    ]
    await flushAll()

    // 结构层不应再为取末条而扫描整条消息数组（末条预览已下沉到 useSessionLastMsg）
    expect(chatStoreMock.chatMessageListByRoomId).not.toHaveBeenCalled()
  })
})
