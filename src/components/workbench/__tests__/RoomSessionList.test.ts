import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import RoomSessionList from '../RoomSessionList.vue'

const { scrollToMock, themesRefMock, globalStoreMock } = vi.hoisted(() => ({
  scrollToMock: vi.fn(),
  themesRefMock: {
    value: { content: 'light' as const }
  },
  globalStoreMock: {
    currentSessionRoomId: '',
    unreadReady: true
  }
}))

vi.mock('pinia', () => ({
  storeToRefs: () => ({
    themes: themesRefMock
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStoreMock
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themes: themesRefMock.value
  })
}))

vi.mock('@/components/common/ContextMenu.vue', () => ({
  default: {
    name: 'ContextMenu',
    template: '<div><slot /></div>'
  }
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: vi.fn(() => '')
  }
}))

vi.mock('vue-virtual-scroller', () => ({
  RecycleScroller: {
    name: 'RecycleScroller',
    template: '<div data-test="recycle-scroller"><slot :item="items[0]" /></div>',
    props: ['items', 'itemSize', 'keyField']
  }
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthroughStub = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  const NScrollbar = defineComponent({
    name: 'NScrollbar',
    setup(_, { slots, expose }) {
      expose({
        scrollTo: scrollToMock
      })

      return () => h('div', { 'data-test': 'NScrollbar' }, slots.default?.())
    }
  })

  return {
    NScrollbar,
    NSpin: defineComponent({
      name: 'NSpin',
      setup() {
        return () => h('div', { 'data-test': 'NSpin' })
      }
    }),
    NFlex: passthroughStub('NFlex'),
    NSkeleton: defineComponent({
      name: 'NSkeleton',
      setup() {
        return () => h('div', { 'data-test': 'NSkeleton' })
      }
    }),
    NResult: defineComponent({
      name: 'NResult',
      props: {
        description: {
          type: String,
          default: ''
        }
      },
      setup(props) {
        return () => h('div', { 'data-test': 'NResult' }, props.description)
      }
    }),
    NAvatar: passthroughStub('NAvatar'),
    NPopover: passthroughStub('NPopover'),
    NBadge: passthroughStub('NBadge')
  }
})

type RoomSessionListProps = InstanceType<typeof RoomSessionList>['$props']

const createProps = (overrides: Partial<RoomSessionListProps> = {}): RoomSessionListProps => ({
  sessionList: [],
  syncLoading: false,
  sessionLoading: false,
  networkBanner: null,
  emptyDescription: '暂无会话',
  getItemClasses: () => ({}),
  visibleMenu: () => [],
  visibleSpecialMenu: () => [],
  onMsgClick: vi.fn(),
  onMsgDblclick: vi.fn(),
  onMenuShow: vi.fn(),
  onRetryNetwork: vi.fn(),
  ...overrides
})

const mountComponent = (overrides: Partial<RoomSessionListProps> = {}) =>
  mount(RoomSessionList, {
    props: createProps(overrides)
  })

describe('RoomSessionList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    themesRefMock.value = { content: 'light' }
    globalStoreMock.currentSessionRoomId = ''
    globalStoreMock.unreadReady = true
  })

  it('shows the sync loading hint while syncing sessions', () => {
    const wrapper = mountComponent({
      syncLoading: true
    })

    expect(wrapper.text()).toContain('message.message_list.sync_loading')
    expect(wrapper.find('[data-test="NSpin"]').exists()).toBe(true)
  })

  it('shows the network banner only when no session is currently open', () => {
    const visibleWrapper = mountComponent({
      networkBanner: { text: '网络异常' }
    })
    expect(visibleWrapper.text()).toContain('网络异常')

    globalStoreMock.currentSessionRoomId = '!room:server'
    const hiddenWrapper = mountComponent({
      networkBanner: { text: '网络异常' }
    })
    expect(hiddenWrapper.text()).not.toContain('网络异常')
  })

  it('shows a retry action only for retryable network states and triggers it', async () => {
    const onRetryNetwork = vi.fn()
    const wrapper = mountComponent({
      networkBanner: { text: '连接已断开', retryable: true },
      onRetryNetwork
    })

    expect(wrapper.get('[data-test="network-retry"]').text()).toBe('common.retry')

    await wrapper.get('[data-test="network-retry"]').trigger('click')
    expect(onRetryNetwork).toHaveBeenCalledTimes(1)

    const nonRetryableWrapper = mountComponent({
      networkBanner: { text: '正在连接', retryable: false }
    })
    expect(nonRetryableWrapper.find('[data-test="network-retry"]').exists()).toBe(false)
  })

  it('renders skeleton placeholders while session data is loading', () => {
    const wrapper = mountComponent({
      sessionLoading: true
    })

    expect(wrapper.findAll('[data-test="NSkeleton"]')).toHaveLength(4)
    expect(wrapper.find('[data-test="NResult"]').exists()).toBe(false)
  })

  it('renders the empty description when there are no sessions and not loading', () => {
    const wrapper = mountComponent({
      emptyDescription: '当前筛选条件下暂无会话'
    })

    expect(wrapper.get('[data-test="NResult"]').text()).toBe('当前筛选条件下暂无会话')
  })

  it('exposes scrollToIndex and delegates to the scrollbar ref', async () => {
    const wrapper = mountComponent()

    await wrapper.vm.scrollToIndex(5)
    expect(scrollToMock).toHaveBeenCalledWith({
      top: 136,
      behavior: 'smooth'
    })

    scrollToMock.mockClear()
    await wrapper.vm.scrollToIndex(-1)
    await nextTick()

    expect(scrollToMock).not.toHaveBeenCalled()
  })
})
