import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, reactive } from 'vue'
import { RoomTypeEnum } from '@/enums'
import type { SessionItem } from '@/stores/domains/chat/chat'

const chatStoreMock = reactive({
  currentSessionInfo: null as Record<string, unknown> | null,
  getSession: vi.fn(),
  markSessionRead: vi.fn()
})

const globalStoreMock = reactive({
  currentSessionRoomId: ''
})

const groupStoreMock = reactive({
  countInfo: {
    memberNum: 8,
    remark: '项目群',
    myName: '我'
  }
})

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => chatStoreMock
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStoreMock
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => groupStoreMock
}))

const { useSessionPageSync } = await import('../useSessionPageSync')

type HandleMsgClick = (item: SessionItem) => Promise<unknown> | unknown
type BeforeHandleSession = (roomId: string) => void

const flushAll = async () => {
  await flushPromises()
  await nextTick()
  await flushPromises()
}

const createHarness = async (options: {
  activePath: string
  handleMsgClick: HandleMsgClick
  beforeHandleSession?: BeforeHandleSession
}) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', redirect: '/other' },
      { path: '/message', name: 'message', component: defineComponent({ template: '<div />' }) },
      { path: '/spaceList', name: 'spaceList', component: defineComponent({ template: '<div />' }) },
      { path: '/other', name: 'other', component: defineComponent({ template: '<div />' }) }
    ]
  })

  const Harness = defineComponent({
    setup() {
      useSessionPageSync(options)
      return () => null
    }
  })

  const wrapper = mount(Harness, {
    global: {
      plugins: [router]
    }
  })

  await router.push('/other')
  await router.isReady()
  await flushAll()

  return { wrapper, router }
}

describe('useSessionPageSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    chatStoreMock.currentSessionInfo = null
    globalStoreMock.currentSessionRoomId = ''
    groupStoreMock.countInfo = {
      memberNum: 8,
      remark: '项目群',
      myName: '我'
    }
    chatStoreMock.getSession.mockReturnValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('syncs group sessions with extra group metadata and calls the visibility hook first', async () => {
    const handleMsgClick = vi.fn(async () => undefined)
    const beforeHandleSession = vi.fn()
    const { wrapper } = await createHarness({
      activePath: '/spaceList',
      handleMsgClick,
      beforeHandleSession
    })

    chatStoreMock.currentSessionInfo = {
      roomId: '!group:server',
      type: RoomTypeEnum.GROUP,
      unreadCount: 2
    }
    await flushAll()

    expect(beforeHandleSession).toHaveBeenCalledWith('!group:server')
    expect(handleMsgClick).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: '!group:server',
        type: RoomTypeEnum.GROUP,
        memberNum: 8,
        remark: '项目群',
        myName: '我'
      })
    )

    wrapper.unmount()
  })

  it('marks the current session as read after entering the active page for 2 seconds', async () => {
    const handleMsgClick = vi.fn()
    chatStoreMock.getSession.mockReturnValue({ unreadCount: 3 })
    globalStoreMock.currentSessionRoomId = '!room:server'

    const { router, wrapper } = await createHarness({
      activePath: '/message',
      handleMsgClick
    })

    await router.push('/message')
    await flushAll()

    expect(chatStoreMock.markSessionRead).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1999)
    await flushAll()
    expect(chatStoreMock.markSessionRead).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    await flushAll()
    expect(chatStoreMock.markSessionRead).toHaveBeenCalledWith('!room:server')

    wrapper.unmount()
  })

  it('cancels the pending read marker when leaving the active page early', async () => {
    const handleMsgClick = vi.fn()
    chatStoreMock.getSession.mockReturnValue({ unreadCount: 2 })
    globalStoreMock.currentSessionRoomId = '!room:server'

    const { router, wrapper } = await createHarness({
      activePath: '/message',
      handleMsgClick
    })

    await router.push('/message')
    await flushAll()
    await router.push('/other')
    await flushAll()

    vi.advanceTimersByTime(3000)
    await flushAll()

    expect(chatStoreMock.markSessionRead).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
