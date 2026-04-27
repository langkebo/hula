import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref, type Ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { RoomTypeEnum } from '@/enums'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

const spaceServiceMock = {
  getSpaces: vi.fn(),
  createSpace: vi.fn(),
  getSpaceRooms: vi.fn(),
  getUserSpaces: vi.fn(),
  deleteSpace: vi.fn(),
  addChildToSpace: vi.fn(),
  removeChildFromSpace: vi.fn()
}

vi.mock('@/services/matrix', () => ({
  matrixSpaceService: spaceServiceMock
}))

vi.mock('@/services/matrix/room/MatrixSpaceService', () => ({
  matrixSpaceService: spaceServiceMock
}))

const { useRoomSpaceWorkbench } = await import('../useRoomSpaceWorkbench')
const { useSpaceStore } = await import('@/stores/domains/widget/space')

type SessionFixture = {
  roomId: string
  name: string
  type: RoomTypeEnum
  top?: boolean
  lastMsg?: string
  remark?: string
  account?: string
}

const flushWorkbench = async () => {
  await flushPromises()
  await nextTick()
  await flushPromises()
  await nextTick()
}

const createHarness = (sourceSessions: Ref<SessionFixture[]>) => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/message', name: 'message', component: defineComponent({ template: '<div />' }) },
      { path: '/other', name: 'other', component: defineComponent({ template: '<div />' }) }
    ]
  })

  let api: ReturnType<typeof useRoomSpaceWorkbench<SessionFixture>>

  const Harness = defineComponent({
    setup() {
      api = useRoomSpaceWorkbench(sourceSessions)
      return () => null
    }
  })

  return {
    pinia,
    router,
    mount: async () => {
      mount(Harness, {
        global: {
          plugins: [pinia, router]
        }
      })

      await router.isReady()
      await flushWorkbench()

      return api
    }
  }
}

describe('useRoomSpaceWorkbench', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    spaceServiceMock.getUserSpaces.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes from route query and filters sessions by active space and keyword', async () => {
    spaceServiceMock.getSpaces.mockResolvedValueOnce([
      { spaceId: 's1', name: 'Space One', memberCount: 3, childCount: 1 },
      { spaceId: 's2', name: 'Space Two', memberCount: 2, childCount: 1 }
    ])
    spaceServiceMock.getSpaceRooms.mockImplementation(async (spaceId: string) => {
      if (spaceId === 's1') {
        return [{ roomId: '!beta:server', name: 'Beta Room' }]
      }

      return []
    })

    const sourceSessions = ref<SessionFixture[]>([
      { roomId: '!alpha:server', name: 'Alpha Room', type: RoomTypeEnum.SINGLE, lastMsg: 'hello' },
      { roomId: '!beta:server', name: 'Project Beta', type: RoomTypeEnum.GROUP, lastMsg: 'update' },
      { roomId: '!gamma:server', name: 'Gamma Room', type: RoomTypeEnum.SINGLE, account: 'beta-user' }
    ])

    const harness = createHarness(sourceSessions)
    await harness.router.push({ name: 'message', query: { spaceId: ' s1 ', search: '  beta ' } })
    const api = await harness.mount()
    const spaceStore = useSpaceStore()

    expect(api.selectedSpaceId.value).toBe('s1')
    expect(api.searchKeyword.value).toBe('beta')
    expect(api.activeSpace.value?.spaceId).toBe('s1')
    expect(api.filteredSessionList.value.map((item) => item.roomId)).toEqual(['!beta:server'])
    expect(spaceStore.activeSpaceId).toBe('s1')
    expect(spaceStore.spaces.map((item) => item.spaceId)).toEqual(['s1', 's2'])
  })

  it('syncs selected space and search keyword back into the workbench route query', async () => {
    vi.useFakeTimers()

    spaceServiceMock.getSpaces.mockResolvedValueOnce([
      { spaceId: 's1', name: 'Space One', memberCount: 3, childCount: 1 },
      { spaceId: 's2', name: 'Space Two', memberCount: 2, childCount: 1 }
    ])
    spaceServiceMock.getSpaceRooms.mockImplementation(async (spaceId: string) => {
      if (spaceId === 's2') {
        return [{ roomId: '!gamma:server', name: 'Gamma Room' }]
      }

      return []
    })

    const sourceSessions = ref<SessionFixture[]>([
      { roomId: '!gamma:server', name: 'Gamma Room', type: RoomTypeEnum.GROUP }
    ])

    const harness = createHarness(sourceSessions)
    await harness.router.push({ name: 'message', query: {} })
    const api = await harness.mount()

    api.setSelectedSpaceId('  s2 ')
    await flushWorkbench()
    expect(harness.router.currentRoute.value.query.spaceId).toBe('s2')

    api.setSearchKeyword('  gamma ')
    await flushWorkbench()
    expect(api.searchKeyword.value).toBe('  gamma ')
    expect(harness.router.currentRoute.value.query.search).toBeUndefined()

    vi.advanceTimersByTime(300)
    await flushWorkbench()
    expect(harness.router.currentRoute.value.query.search).toBe('gamma')

    api.setSessionTypeFilter('group')
    api.setSessionSort('name')
    await flushWorkbench()
    expect(harness.router.currentRoute.value.query.type).toBe('group')
    expect(harness.router.currentRoute.value.query.sort).toBe('name')

    vi.useRealTimers()
  })

  it('clears incompatible space, search and type filters when ensuring a room stays visible', async () => {
    vi.useFakeTimers()

    spaceServiceMock.getSpaces.mockResolvedValueOnce([
      { spaceId: 's1', name: 'Space One', memberCount: 3, childCount: 1 }
    ])
    spaceServiceMock.getSpaceRooms.mockImplementation(async (spaceId: string) => {
      if (spaceId === 's1') {
        return [{ roomId: '!alpha:server', name: 'Alpha Room' }]
      }

      return []
    })

    const sourceSessions = ref<SessionFixture[]>([
      { roomId: '!alpha:server', name: 'Alpha Room', type: RoomTypeEnum.GROUP },
      { roomId: '!beta:server', name: 'Beta Room', type: RoomTypeEnum.SINGLE, lastMsg: 'visible target' }
    ])

    const harness = createHarness(sourceSessions)
    await harness.router.push({ name: 'message', query: { spaceId: 's1', search: 'alpha', type: 'group' } })
    const api = await harness.mount()

    api.ensureRoomVisible('!beta:server')
    await flushWorkbench()

    expect(api.selectedSpaceId.value).toBe('')
    expect(api.searchKeyword.value).toBe('')
    expect(api.sessionTypeFilter.value).toBe('all')
    expect(harness.router.currentRoute.value.query.spaceId).toBeUndefined()

    vi.advanceTimersByTime(300)
    await flushWorkbench()
    expect(harness.router.currentRoute.value.query.search).toBeUndefined()
    expect(harness.router.currentRoute.value.query.type).toBeUndefined()
    expect(api.filteredSessionList.value.map((item) => item.roomId)).toEqual(['!alpha:server', '!beta:server'])
  })

  it('filters by session type and sorts by pinned first then name', async () => {
    spaceServiceMock.getSpaces.mockResolvedValueOnce([])
    spaceServiceMock.getSpaceRooms.mockResolvedValue([])

    const sourceSessions = ref<SessionFixture[]>([
      { roomId: '!gamma:server', name: 'Gamma Room', type: RoomTypeEnum.GROUP },
      { roomId: '!alpha:server', name: 'Alpha Room', type: RoomTypeEnum.GROUP, top: true },
      { roomId: '!beta:server', name: 'Beta Room', type: RoomTypeEnum.SINGLE }
    ])

    const harness = createHarness(sourceSessions)
    await harness.router.push({ name: 'message', query: { type: 'group', sort: 'name' } })
    const api = await harness.mount()

    expect(api.sessionTypeFilter.value).toBe('group')
    expect(api.sessionSort.value).toBe('name')
    expect(api.filteredSessionList.value.map((item) => item.roomId)).toEqual(['!alpha:server', '!gamma:server'])
  })
})
