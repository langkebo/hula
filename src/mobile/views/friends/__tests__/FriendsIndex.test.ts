import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import FriendsIndex from '../index.vue'

/**
 * 移动端好友列表：本地搜索（昵称/备注/账号/userId）与下拉刷新。
 *
 * F-6：原页面只有服务端用户目录搜索，好友列表本身没有本地过滤；
 * 也没有下拉刷新入口，只能靠重新进入页面触发 onMounted 重新加载。
 */

const { initializeMock, showFeedbackMock, contactStoreMock, friendData } = vi.hoisted(() => ({
  initializeMock: vi.fn().mockResolvedValue(undefined),
  showFeedbackMock: vi.fn(),
  contactStoreMock: {
    lastFriendError: null as null | { message: string },
    getContactList: vi.fn().mockResolvedValue(undefined),
    getApplyPage: vi.fn().mockResolvedValue(undefined),
    getApplyUnReadCount: vi.fn().mockResolvedValue(undefined)
  },
  friendData: {
    special: [
      {
        userId: '@alice:example.org',
        displayName: 'Alice',
        remark: '学姐',
        account: 'alice',
        avatarUrl: '',
        activeStatus: 1
      }
    ],
    normal: [
      {
        userId: '@carol:example.org',
        displayName: 'Carol',
        remark: '同事',
        account: 'carol01',
        avatarUrl: '',
        activeStatus: 1
      },
      {
        userId: '@dave:example.org',
        displayName: 'Dave',
        remark: '',
        account: 'dave',
        avatarUrl: '',
        activeStatus: 2
      }
    ],
    blocked: [] as Array<Record<string, unknown>>
  }
}))

vi.mock('@/composables/useFriends', async () => {
  const { ref } = await import('vue')
  const specialContacts = ref(friendData.special)
  const normalContacts = ref(friendData.normal)
  const blockedContacts = ref(friendData.blocked)
  return {
    useFriends: () => ({
      groupChatList: ref([]),
      specialContacts,
      specialOnlineCount: ref(1),
      blockedContacts,
      normalContacts,
      normalOnlineCount: ref(1),
      contactUnreadCount: ref(0),
      selectedItem: ref(null),
      isBotUser: () => false,
      getUserState: () => null,
      setSelectedItem: vi.fn(),
      clearSelectedItem: vi.fn(),
      loading: ref(false),
      initialLoading: ref(false),
      initialize: initializeMock
    })
  }
})

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: { on: vi.fn(() => () => {}), emit: vi.fn(), off: vi.fn() }
}))

vi.mock('@/composables/chat/useMessage', () => ({
  useMessage: () => ({ preloadChatRoom: vi.fn() })
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => contactStoreMock
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({ getUserInfo: () => undefined })
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({ sessionList: [] })
}))

vi.mock('@/services/matrix/MatrixCapabilityService', () => ({
  useServerCapability: () => ({ isLoaded: { value: true }, canUseFriendList: { value: true } })
}))

vi.mock('@/services/matrix', () => ({
  matrixFriendOperations: {
    sendFriendRequest: vi.fn().mockResolvedValue(undefined),
    removeFriend: vi.fn().mockResolvedValue(undefined)
  },
  userDirectoryService: { searchUsers: vi.fn().mockResolvedValue([]) }
}))

vi.mock('@/router', () => ({ default: { push: vi.fn(), replace: vi.fn(), back: vi.fn() } }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }))

vi.mock('vant', () => ({
  showToast: vi.fn(),
  showFailToast: vi.fn(),
  showConfirmDialog: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('#/layout/navBar/index.vue', () => ({
  default: { name: 'NavBar', template: '<div><slot name="center" /><slot name="right" /></div>' }
}))

vi.mock('@/mobile/components/friend/FriendContactRow.vue', () => ({
  default: {
    name: 'FriendContactRow',
    props: ['userId', 'name'],
    template: '<div class="friend-row">{{ name }}</div>'
  }
}))

vi.mock('@/utils/AvatarUtils', () => ({ AvatarUtils: { getAvatarUrl: () => '' } }))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

vi.mock('@/utils/TimerManager', () => ({
  useTimerManager: () => ({ setTimeout: (fn: () => void) => fn() })
}))

const VanSearch = defineComponent({
  name: 'VanSearch',
  props: { modelValue: { type: String, default: '' }, placeholder: String },
  emits: ['update:modelValue'],
  template: `<div class="van-search">
    <input
      class="van-search-input"
      :value="modelValue"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', $event.target.value)" />
  </div>`
})

const VanPullRefresh = defineComponent({
  name: 'VanPullRefresh',
  props: ['modelValue'],
  emits: ['update:modelValue', 'refresh'],
  template: '<div class="van-pull-refresh"><slot /></div>'
})

const VanEmpty = defineComponent({
  name: 'VanEmpty',
  props: ['description'],
  template: '<div class="van-empty">{{ description }}<slot /><slot name="bottom" /></div>'
})

const VanCollapse = defineComponent({
  name: 'VanCollapse',
  props: ['modelValue'],
  template: '<div class="van-collapse"><slot /></div>'
})

const VanCollapseItem = defineComponent({
  name: 'VanCollapseItem',
  props: ['name', 'title'],
  template: `<div class="van-collapse-item">
    <slot name="title" /><slot name="value" /><slot />
  </div>`
})

const VanSwipeCell = defineComponent({
  name: 'VanSwipeCell',
  template: '<div class="van-swipe-cell"><slot /><slot name="right" /></div>'
})

const VanTabs = defineComponent({ name: 'VanTabs', template: '<div class="van-tabs"><slot /></div>' })
const VanTab = defineComponent({ name: 'VanTab', props: ['title'], template: '<div class="van-tab"><slot /></div>' })
const VanPopover = defineComponent({
  name: 'VanPopover',
  template: '<div class="van-popover"><slot name="reference" /></div>'
})
const VanButton = defineComponent({
  name: 'VanButton',
  template: '<button class="van-button"><slot /></button>'
})
const VanField = defineComponent({
  name: 'VanField',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: `<input class="van-field-input" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`
})
const VanLoading = defineComponent({ name: 'VanLoading', template: '<div class="van-loading" />' })

const mountPage = () =>
  mount(FriendsIndex, {
    global: {
      components: {
        VanSearch,
        VanPullRefresh,
        VanEmpty,
        VanCollapse,
        VanCollapseItem,
        VanSwipeCell,
        VanTabs,
        VanTab,
        VanPopover,
        VanButton,
        VanField,
        VanLoading
      }
    }
  })

const renderedNames = (wrapper: ReturnType<typeof mountPage>) => wrapper.findAll('.friend-row').map((row) => row.text())

describe('FriendsIndex 本地搜索与下拉刷新', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    initializeMock.mockResolvedValue(undefined)
    contactStoreMock.lastFriendError = null
  })

  it('关键词为空时展示全部好友', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(renderedNames(wrapper)).toEqual(expect.arrayContaining(['学姐', '同事', 'Dave']))
  })

  it('按备注过滤：只保留命中的好友', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('input.van-search-input').setValue('同事')

    expect(renderedNames(wrapper)).toEqual(['同事'])
  })

  it('按昵称、账号与 userId 过滤', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const input = wrapper.find('input.van-search-input')

    await input.setValue('Dave')
    expect(renderedNames(wrapper)).toEqual(['Dave'])

    await input.setValue('alice')
    expect(renderedNames(wrapper)).toEqual(['学姐'])

    await input.setValue('@dave:example.org')
    expect(renderedNames(wrapper)).toEqual(['Dave'])
  })

  it('无匹配结果时展示空态文案', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('input.van-search-input').setValue('不存在的关键词')

    expect(renderedNames(wrapper)).toEqual([])
    expect(wrapper.find('.van-empty').text()).toContain('mobile_contact.search_no_result')
  })

  it('下拉刷新复用 initialize()，并在结束后复位刷新状态', async () => {
    const wrapper = mountPage()
    await flushPromises()
    initializeMock.mockClear()

    wrapper.findComponent(VanPullRefresh).vm.$emit('refresh')
    await flushPromises()

    expect(initializeMock).toHaveBeenCalledTimes(1)
    expect((wrapper.findComponent(VanPullRefresh).props() as { modelValue: boolean }).modelValue).toBe(false)
  })

  it('刷新失败时给出提示', async () => {
    const wrapper = mountPage()
    await flushPromises()
    initializeMock.mockClear()
    contactStoreMock.lastFriendError = { message: 'boom' }

    wrapper.findComponent(VanPullRefresh).vm.$emit('refresh')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('mobile_contact.refresh_failed', 'error')
  })
})
