import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, reactive, ref } from 'vue'
import { OnlineEnum, RoomTypeEnum } from '@/enums'
import type { UserItem } from '@/services/types'
import ChatSidebar from '../ChatSidebar.vue'

// 受控的 isGroup，通过 globalStore.currentSession.type 切换群聊/单聊
const { loggerErrorMock, mittOnMock, mittOffMock, mittEmitMock, getUserByIdsMock } = vi.hoisted(() => ({
  loggerErrorMock: vi.fn(),
  mittOnMock: vi.fn(),
  mittOffMock: vi.fn(),
  mittEmitMock: vi.fn(),
  getUserByIdsMock: vi.fn().mockResolvedValue([])
}))

let globalStore: ReturnType<typeof reactive<{ currentSessionRoomId: string; currentSession: { type: RoomTypeEnum } }>>
let groupStore: ReturnType<
  typeof reactive<{
    userList: unknown[]
    onlineCountMap: Record<string, number>
    userListOptions: { loading: boolean }
    updateUserItem: typeof vi.fn
    updateMemberCache: typeof vi.fn
    cleanupSession: typeof vi.fn
    loadMoreGroupMembers: typeof vi.fn
  }>
>
let announcementStore: ReturnType<
  typeof reactive<{
    announcementContent: ReturnType<typeof ref<string>>
    announNum: ReturnType<typeof ref<number>>
    announError: ReturnType<typeof ref<boolean>>
    isAddAnnoun: ReturnType<typeof ref<boolean>>
    loadGroupAnnouncements: typeof vi.fn
    clearAnnouncements: typeof vi.fn
  }>
>
let userStatusStore: ReturnType<typeof reactive<{ stateList: ReturnType<typeof ref<unknown[]>> }>>
let settingStore: ReturnType<typeof reactive<{ themeContent: string }>>

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: { getCurrent: vi.fn() }
}))

vi.mock('@vueuse/core', () => ({
  useDebounceFn: (fn: (...args: unknown[]) => unknown) => fn
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, defaultOrParams?: unknown) => {
      if (typeof defaultOrParams === 'string') return defaultOrParams
      return key
    }
  })
}))

vi.mock('@/services/matrix/room/roomTypeUtils', () => ({
  isDirectMessageRoom: vi.fn(() => false)
}))

vi.mock('@/services/matrix/MatrixClientService', () => {
  const svc = {
    getClient: vi.fn(() => null),
    getUserId: vi.fn(() => '@me:example.com'),
    isRoomEncrypted: vi.fn(() => false)
  }
  return { matrixClientService: svc, default: svc }
})

vi.mock('@/composables/chat/useChatMain', () => ({
  useChatMain: () => ({ optionsList: [], report: {}, selectKey: ref('') })
}))

vi.mock('@/composables/common/useLinkSegments', () => ({
  useLinkSegments: () => ({ segments: ref([]), openLink: vi.fn() })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: { on: mittOnMock, off: mittOffMock, emit: mittEmitMock }
}))

vi.mock('@/composables/common/usePopover', () => ({
  usePopover: () => ({ handlePopoverUpdate: vi.fn(), enableScroll: vi.fn() })
}))

vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({ createWebviewWindow: vi.fn() })
}))

vi.mock('@/services/matrix/user/MatrixContactService', () => ({
  matrixContactService: { getUserByIds: getUserByIdsMock }
}))

vi.mock('@/stores/domains/chat/announcement', () => ({
  useAnnouncementStore: () => announcementStore
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => groupStore
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => settingStore
}))

vi.mock('@/stores/domains/user/userStatus', () => ({
  useUserStatusStore: () => userStatusStore
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStore
}))

vi.mock('@/utils/AppHarness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/AppHarness')>()
  return {
    ...actual,
    hasTauriRuntime: () => false
  }
})

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

// 阻断 AnnouncementPanel / InfoPopover 的传递依赖加载真实 matrix-js-sdk
// （主项目 node_modules 缺少 @babel/runtime，导致 matrix-js-sdk/lib/matrix.js 无法解析）
vi.mock('@/components/room/AnnouncementPanel.vue', () => ({
  default: { name: 'AnnouncementPanel', props: ['roomId'], emits: ['close'], setup: () => () => null }
}))

vi.mock('@/components/common/InfoPopover.vue', () => ({
  default: { name: 'InfoPopover', props: ['uid', 'activeStatus'], setup: () => () => null }
}))

const AnnouncementPanelStub = defineComponent({
  name: 'AnnouncementPanel',
  props: ['roomId'],
  emits: ['close'],
  setup: () => () => null
})

const mountComponent = () =>
  mount(ChatSidebar, {
    global: {
      stubs: {
        AnnouncementPanel: AnnouncementPanelStub,
        ContextMenu: { template: '<div><slot /></div>' },
        InfoPopover: { template: '<div />' },
        'n-flex': { template: '<div><slot /></div>' },
        'n-tabs': { template: '<div><slot /></div>' },
        'n-tab-pane': { template: '<div><slot /></div>' },
        'n-button': { template: '<button><slot /></button>' },
        'n-input': { template: '<input />' },
        'n-popover': { template: '<div><slot name="trigger" /><slot /></div>' },
        'n-avatar': { template: '<div />' },
        'n-progress': { template: '<div />' },
        'n-empty': { template: '<div />' }
      }
    }
  })

describe('ChatSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    globalStore = reactive({
      currentSessionRoomId: '!room:example.com',
      currentSession: { type: RoomTypeEnum.GROUP }
    })

    groupStore = reactive({
      userList: [],
      onlineCountMap: {},
      userListOptions: { loading: false },
      updateUserItem: vi.fn(),
      updateMemberCache: vi.fn(),
      cleanupSession: vi.fn(),
      loadMoreGroupMembers: vi.fn()
    })

    announcementStore = reactive({
      announcementContent: ref(''),
      announNum: ref(0),
      announError: ref(false),
      isAddAnnoun: ref(false),
      loadGroupAnnouncements: vi.fn().mockResolvedValue(undefined),
      clearAnnouncements: vi.fn()
    })

    userStatusStore = reactive({
      stateList: ref([])
    })

    settingStore = reactive({
      themeContent: 'light'
    })
  })

  it('collapses the info panel by default for group chats', () => {
    const wrapper = mountComponent()

    const main = wrapper.find('main')
    expect(main.classes()).toContain('w-0')
    expect(main.classes()).not.toContain('w-240px')

    const toggle = wrapper.find('[role="button"]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })

  it('expands the info panel when the toggle button is clicked', async () => {
    const wrapper = mountComponent()

    const toggle = wrapper.find('[role="button"]')
    await toggle.trigger('click')
    await flushPromises()

    const main = wrapper.find('main')
    expect(main.classes()).toContain('w-240px')
    expect(main.classes()).not.toContain('w-0')
    expect(wrapper.find('[role="button"]').attributes('aria-expanded')).toBe('true')
  })

  it('hides the panel and toggle for direct (friend) chats', async () => {
    globalStore.currentSession.type = RoomTypeEnum.SINGLE
    const wrapper = mountComponent()
    await flushPromises()

    const main = wrapper.find('main')
    expect(main.classes()).toContain('w-0')

    const toggle = wrapper.find('[role="button"]')
    expect(toggle.exists()).toBe(true)
    // v-show 在好友/单聊下隐藏交互把手（display:none）
    expect(toggle.attributes('style')).toContain('display: none')
  })

  // ---- P0-1: 成员列表按 presence 分在线/离线两组 ----
  const makeUser = (uid: string, name: string, activeStatus: OnlineEnum): UserItem => ({
    uid,
    name,
    account: uid,
    avatar: '',
    activeStatus,
    lastOptTime: 0
  })

  /** 装载包含 2 个在线 + 1 个离线成员的群聊侧栏，并展开侧栏 */
  const mountWithMembers = async () => {
    groupStore.userList = [
      makeUser('u1', 'Alice', OnlineEnum.ONLINE),
      makeUser('u2', 'Bob', OnlineEnum.ONLINE),
      makeUser('u3', 'Carol', OnlineEnum.OFFLINE)
    ]
    const wrapper = mountComponent()
    // 展开侧栏（默认折叠）
    await wrapper.find('[role="button"]').trigger('click')
    await flushPromises()
    return wrapper
  }

  it('groups members with an online header showing the online count', async () => {
    const wrapper = await mountWithMembers()

    const onlineHeader = wrapper.find('[data-testid="group-header-online"]')
    expect(onlineHeader.exists()).toBe(true)
    expect(onlineHeader.text()).toContain('在线')
    expect(onlineHeader.text()).toContain('2')
  })

  it('groups members with an offline header showing the offline count', async () => {
    const wrapper = await mountWithMembers()

    const offlineHeader = wrapper.find('[data-testid="group-header-offline"]')
    expect(offlineHeader.exists()).toBe(true)
    expect(offlineHeader.text()).toContain('离线')
    expect(offlineHeader.text()).toContain('1')
  })

  it('shows online members and hides offline members when collapsed by default', async () => {
    const wrapper = await mountWithMembers()

    const text = wrapper.text()
    expect(text).toContain('Alice')
    expect(text).toContain('Bob')
    // 离线组默认折叠，Carol 不应渲染
    expect(text).not.toContain('Carol')
  })

  it('expands offline members when the offline header is clicked', async () => {
    const wrapper = await mountWithMembers()

    const offlineHeader = wrapper.find('[data-testid="group-header-offline"]')
    await offlineHeader.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Carol')
  })

  it('collapses offline members again when the offline header is clicked twice', async () => {
    const wrapper = await mountWithMembers()

    const offlineHeader = wrapper.find('[data-testid="group-header-offline"]')
    await offlineHeader.trigger('click')
    await flushPromises()
    await offlineHeader.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Carol')
  })
})
