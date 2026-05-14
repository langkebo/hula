import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { MittEnum, RoomTypeEnum } from '@/enums'
import FriendsList from '../FriendsList.vue'

const contactStoreMock = vi.hoisted(() => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  getContactList: vi.fn().mockResolvedValue(undefined),
  getApplyPage: vi.fn().mockResolvedValue(undefined)
}))

const useMittEmitMock = vi.hoisted(() => vi.fn())
const createWebviewWindowMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const setSelectedItemMock = vi.hoisted(() => vi.fn())
const clearSelectedItemMock = vi.hoisted(() => vi.fn())

vi.mock('vue-i18n', () => ({
  createI18n: () => ({
    global: {
      t: (key: string) => key
    }
  }),
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'friends', query: {} }),
  useRouter: () => ({ push: vi.fn() }),
  createRouter: () => ({
    install: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    resolve: vi.fn(),
    beforeEach: vi.fn(),
    afterEach: vi.fn(),
    getRoutes: vi.fn(() => []),
    addRoute: vi.fn(),
    removeRoute: vi.fn(),
    hasRoute: vi.fn(() => false),
    options: { routes: [] }
  }),
  createWebHashHistory: vi.fn()
}))

vi.mock('@/hooks/useMitt.ts', () => ({
  useMitt: { emit: useMittEmitMock, on: vi.fn(), off: vi.fn() }
}))

vi.mock('@/router/spaceNavigation', () => ({
  buildSpaceWorkbenchRoute: vi.fn(() => '/search')
}))

vi.mock('@/hooks/useWindow', () => ({
  useWindow: () => ({
    createWebviewWindow: createWebviewWindowMock
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: { getAvatarUrl: (value: string) => value }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }))
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => contactStoreMock
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: vi.fn(() => null)
  })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    friendUnreadCount: 0,
    clearFriendUnreadCount: vi.fn(),
    refreshUnreadBadge: vi.fn()
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light',
    isSecretChatConfigured: vi.fn(() => true)
  })
}))

vi.mock('@/composables/useFriends', () => ({
  useFriends: () => ({
    specialContacts: computed(() => []),
    specialOnlineCount: computed(() => 0),
    blockedContacts: computed(() => []),
    hiddenContacts: computed(() => []),
    normalContacts: computed(() => [
      {
        uid: '@ljf:matrix.test',
        userId: '@ljf:matrix.test',
        displayName: 'ljf',
        name: 'ljf',
        avatarUrl: 'mxc://avatar',
        avatar: 'mxc://avatar',
        remark: '',
        activeStatus: 1
      }
    ]),
    normalOnlineCount: computed(() => 1),
    selectedItem: ref(''),
    isBotUser: vi.fn(() => false),
    getUserState: vi.fn(() => null),
    setSelectedItem: setSelectedItemMock,
    clearSelectedItem: clearSelectedItemMock
  })
}))

describe('FriendsList', () => {
  const globalStubs = {
    ContextMenu: { template: '<div><slot /></div>' },
    NInput: { template: '<div><slot name="prefix" /></div>' },
    NPopover: {
      template:
        '<div class="popover-stub"><div class="popover-trigger"><slot name="trigger" /></div><div class="popover-content"><slot /></div></div>'
    },
    NButton: { template: '<button><slot name="icon" /><slot /></button>' },
    NFlex: { template: '<div><slot /></div>' },
    NBadge: { template: '<div><slot /></div>' },
    NTabs: { template: '<div><slot /></div>' },
    NTabPane: { template: '<div><slot /></div>' },
    NCollapse: { template: '<div><slot /></div>' },
    NCollapseItem: { template: '<div><slot name="header" /><slot name="header-extra" /><slot /></div>' },
    NScrollbar: { template: '<div><slot /></div>' },
    AddFriendDialog: {
      props: ['show'],
      template: '<div class="add-friend-dialog-stub" :data-show="show"></div>'
    },
    NAvatar: {
      props: ['src'],
      template: '<img class="avatar" :src="src" />'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    contactStoreMock.initialize.mockResolvedValue(undefined)
  })

  it('在 groupStore 缺少用户资料时，仍然使用联系人数据渲染好友', async () => {
    const wrapper = mount(FriendsList, {
      global: {
        stubs: globalStubs,
        plugins: [createPinia()]
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain('ljf')
    expect(wrapper.html()).toContain('mxc://avatar')
  })

  it('挂载时走 contactStore.initialize，而不是只拉一次列表', async () => {
    mount(FriendsList, {
      global: {
        stubs: globalStubs,
        plugins: [createPinia()]
      }
    })

    await flushPromises()

    expect(contactStoreMock.initialize).toHaveBeenCalledTimes(1)
    expect(contactStoreMock.getContactList).not.toHaveBeenCalled()
  })

  it('点击好友时会选中联系人并发出详情展示事件', async () => {
    const wrapper = mount(FriendsList, {
      global: {
        stubs: globalStubs,
        plugins: [createPinia()]
      }
    })

    await flushPromises()
    await wrapper.find('.item-box').trigger('click')
    await flushPromises()

    expect(setSelectedItemMock).toHaveBeenCalledTimes(1)
    expect(setSelectedItemMock).toHaveBeenCalledWith('@ljf:matrix.test')
    expect(useMittEmitMock).toHaveBeenCalledWith(MittEnum.DETAILS_SHOW, {
      context: {
        type: RoomTypeEnum.SINGLE,
        uid: '@ljf:matrix.test'
      },
      detailsShow: true
    })
  })

  it('点击添加入口时会打开搜索好友窗口', async () => {
    const wrapper = mount(FriendsList, {
      global: {
        stubs: globalStubs,
        plugins: [createPinia()]
      }
    })

    await flushPromises()
    await (
      wrapper.vm as unknown as { addPanels: { list: Array<{ click: () => Promise<void> }> } }
    ).addPanels.list[0].click()
    await flushPromises()

    expect(createWebviewWindowMock).toHaveBeenCalledTimes(1)
    expect(createWebviewWindowMock).toHaveBeenCalledWith('menu.add_friend', 'searchFriend', 500, 580)
  })
})
