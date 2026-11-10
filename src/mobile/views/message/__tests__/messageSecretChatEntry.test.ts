import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Ref, ref } from 'vue'
import type { MobileSessionListItem } from '@/mobile/composables/useMobileSessionList'

/**
 * 移动端消息页的私密会话入口可见性。
 *
 * 入口必须同时满足「有私密房」与「已配置密码」：清除密码后登记表可能还留着旧数据，
 * 此时入口点进去只会落到一个永远解不开的页面（计划验收第 7 条）。
 */

const mocks = vi.hoisted(() => ({
  // 真实 ref 在 import 之后补（vi.mock 工厂在执行导入时就会读这些属性，但只在挂载时求值）
  searchText: null as unknown as Ref<string>,
  filteredSessionList: null as unknown as Ref<MobileSessionListItem[]>,
  hiddenSessionCount: null as unknown as Ref<number>,
  loadError: null as unknown as Ref<string | null>,
  isLoading: null as unknown as Ref<boolean>,
  isEnablePullRefresh: null as unknown as Ref<boolean>,
  showMask: null as unknown as Ref<boolean>,
  showAddPopover: null as unknown as Ref<boolean>,
  showNewChatDialog: null as unknown as Ref<boolean>,
  showCreateGroupDialog: null as unknown as Ref<boolean>,
  newChatUserId: null as unknown as Ref<string>,
  createGroupName: null as unknown as Ref<string>,
  createGroupMemberIds: null as unknown as Ref<string[]>,
  configured: null as unknown as Ref<boolean>,
  push: vi.fn(),
  showFeedback: vi.fn(),
  openUnlock: vi.fn()
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('#/layout/navBar/index.vue', () => ({
  default: { name: 'NavBar', template: '<div><slot name="left" /><slot name="right" /></div>' }
}))
vi.mock('@/mobile/components/common/MobileConnectionBanner.vue', () => ({
  default: { name: 'MobileConnectionBanner', template: '<div />' }
}))
vi.mock('@/mobile/components/message/MobileCreateDialogs.vue', () => ({
  default: { name: 'MobileCreateDialogs', template: '<div />' }
}))
vi.mock('@/mobile/components/message/MobileSessionHeader.vue', () => ({
  default: { name: 'MobileSessionHeader', template: '<div />' }
}))
vi.mock('@/mobile/components/message/MobileSessionList.vue', () => ({
  default: { name: 'MobileSessionList', template: '<div />' }
}))
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: mocks.showFeedback })
}))
vi.mock('@/composables/secretChat/useSecretChatGate', () => ({
  openSecretChatUnlock: mocks.openUnlock
}))
vi.mock('@/mobile/composables/useMobileSessionList', () => ({
  useMobileSessionList: () => ({
    searchText: mocks.searchText,
    filteredSessionList: mocks.filteredSessionList,
    hiddenSessionCount: mocks.hiddenSessionCount,
    loadError: mocks.loadError,
    isLoading: mocks.isLoading
  })
}))
vi.mock('@/mobile/composables/useMobileScrollRefresh', () => ({
  useMobileScrollRefresh: () => ({
    isEnablePullRefresh: mocks.isEnablePullRefresh,
    enablePullRefresh: vi.fn(),
    disablePullRefresh: vi.fn(),
    onScroll: vi.fn(),
    getScrollTop: () => 0,
    lockScroll: vi.fn(),
    unlockScroll: vi.fn()
  })
}))
vi.mock('@/mobile/composables/useMobileLongPress', () => ({
  useMobileLongPress: () => ({
    showMask: mocks.showMask,
    currentLongPressItem: null,
    longPressMenuRef: null,
    longPressState: { longPressActive: false, showLongPressMenu: false, longPressMenuTop: 0 },
    longPressOption: {},
    maskHandler: { close: vi.fn() },
    handleLongPress: vi.fn()
  })
}))
vi.mock('@/mobile/composables/useMobileMessageActions', () => ({
  useMobileMessageActions: () => ({
    loading: ref(false),
    handleDelete: vi.fn(),
    handleToggleTop: vi.fn(),
    handleToggleReadStatus: vi.fn(),
    handleTogglePrivate: vi.fn(),
    isRoomPrivate: () => false,
    onRefresh: vi.fn()
  })
}))
vi.mock('@/mobile/composables/useMobileCreateDialogs', () => ({
  useMobileCreateDialogs: () => ({
    showAddPopover: mocks.showAddPopover,
    addActions: [],
    showNewChatDialog: mocks.showNewChatDialog,
    newChatUserId: mocks.newChatUserId,
    showCreateGroupDialog: mocks.showCreateGroupDialog,
    createGroupName: mocks.createGroupName,
    createGroupMemberIds: mocks.createGroupMemberIds,
    onAddActionSelect: vi.fn(),
    beforeCloseNewChat: vi.fn(),
    beforeCloseCreateGroup: vi.fn()
  })
}))
vi.mock('@/mobile/composables/useSessionListScrollMemory', () => ({
  useSessionListScrollMemory: () => ({ remember: vi.fn(), restore: () => true, getRemembered: () => 0 })
}))
vi.mock('@/stores/domains/settings/secretChatSession', () => ({
  isSecretChatUnlocked: () => true
}))
vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({ isSecretChatConfigured: () => mocks.configured.value })
}))
vi.mock('@/utils/TimerManager', () => ({
  useTimerManager: () => ({ setTimeout: (cb: () => void) => window.setTimeout(cb, 0) })
}))

import MessagePage from '../index.vue'

mocks.searchText = ref('')
mocks.filteredSessionList = ref([])
mocks.hiddenSessionCount = ref(0)
mocks.loadError = ref(null)
mocks.isLoading = ref(false)
mocks.isEnablePullRefresh = ref(true)
mocks.showMask = ref(false)
mocks.showAddPopover = ref(false)
mocks.showNewChatDialog = ref(false)
mocks.showCreateGroupDialog = ref(false)
mocks.newChatUserId = ref('')
mocks.createGroupName = ref('')
mocks.createGroupMemberIds = ref([])
mocks.configured = ref(true)

const ENTRY_SELECTOR = '[aria-label="home.secret_chat.hidden_sessions"]'

const mountPage = () =>
  mount(MessagePage, {
    global: {
      stubs: {
        'van-button': { template: '<button v-bind="$attrs"><slot /></button>' },
        'van-popover': { template: '<div><slot name="reference" /></div>' }
      }
    }
  })

describe('移动端消息页 · 私密会话入口', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.hiddenSessionCount.value = 1
    mocks.configured.value = true
  })

  it('有私密会话且已配置密码时渲染入口', () => {
    const wrapper = mountPage()
    expect(wrapper.find(ENTRY_SELECTOR).exists()).toBe(true)
  })

  it('未配置密码时即使存在私密会话也不渲染入口', () => {
    mocks.configured.value = false
    const wrapper = mountPage()
    expect(wrapper.find(ENTRY_SELECTOR).exists()).toBe(false)
  })

  it('没有私密会话时不渲染入口', () => {
    mocks.hiddenSessionCount.value = 0
    const wrapper = mountPage()
    expect(wrapper.find(ENTRY_SELECTOR).exists()).toBe(false)
  })

  it('清除密码后入口随配置变化消失', async () => {
    const wrapper = mountPage()
    expect(wrapper.find(ENTRY_SELECTOR).exists()).toBe(true)

    mocks.configured.value = false
    await wrapper.vm.$nextTick()

    expect(wrapper.find(ENTRY_SELECTOR).exists()).toBe(false)
  })
})
