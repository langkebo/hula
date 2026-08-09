import { mount, shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ChatBanners from '../ChatBanners.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const baseProps = {
  networkBannerText: null as string | null,
  isAnnouncementLoading: true,
  isGroup: true,
  topAnnouncement: null as { content: string } | null,
  currentRoomId: 'room-1',
  privateModeActive: false,
  burnEnabled: false,
  currentUserId: '@u:matrix.test',
  currentUserName: 'u',
  stickyEvents: [] as Array<{ eventId: string; sender: string; body: string; timestamp: number }>,
  canSetSticky: false
}

describe('ChatBanners 公告区 loading spinner 门控', () => {
  it('单聊(isGroup=false)时即使 isAnnouncementLoading=true 也不渲染加载 spinner', () => {
    const wrapper = shallowMount(ChatBanners, {
      props: { ...baseProps, isGroup: false }
    })
    expect(wrapper.find('.custom-announcement').exists()).toBe(false)
  })

  it('群聊(isGroup=true)且 isAnnouncementLoading=true 时渲染加载 spinner', () => {
    const wrapper = shallowMount(ChatBanners, {
      props: { ...baseProps, isGroup: true }
    })
    expect(wrapper.find('.custom-announcement').exists()).toBe(true)
  })

  it('isAnnouncementLoading=false 时不渲染加载 spinner（无论群聊/单聊）', () => {
    const wrapper = shallowMount(ChatBanners, {
      props: { ...baseProps, isAnnouncementLoading: false, isGroup: true }
    })
    expect(wrapper.find('.custom-announcement').exists()).toBe(false)
  })
})

const mountBanners = (props: Partial<InstanceType<typeof ChatBanners>['$props']> = {}) =>
  mount(ChatBanners, {
    props: {
      networkBannerText: null,
      isAnnouncementLoading: false,
      isGroup: false,
      topAnnouncement: null,
      currentRoomId: '!room1:server',
      privateModeActive: true,
      burnEnabled: false,
      currentUserId: '@me:server',
      currentUserName: 'Me',
      stickyEvents: [],
      canSetSticky: false,
      ...props
    },
    global: { stubs: ['E2EEBanner', 'StickyEventBanner', 'PrivateModeBanner', 'ScreenshotWatermark'] }
  })

describe('ChatBanners 私密模式 S 按钮（已委托给 ChatHeaderToolbar）', () => {
  it('不渲染私密模式 S 切换按钮（已委托给 ChatHeaderToolbar）', () => {
    const wrapper = mountBanners({ privateModeActive: false })
    expect(wrapper.find('[data-testid="private-toggle-btn"]').exists()).toBe(false)
  })

  it('privateModeActive 且 burnEnabled 时渲染 PrivateModeBanner', () => {
    const wrapper = mountBanners({ privateModeActive: true, burnEnabled: true })
    expect(wrapper.findComponent({ name: 'PrivateModeBanner' }).exists()).toBe(true)
  })

  it('privateModeActive 时渲染锁图标', () => {
    const wrapper = mountBanners({ privateModeActive: true })
    expect(wrapper.find('[data-testid="private-lock-icon"]').exists()).toBe(true)
  })

  it('privateModeActive 时渲染 ScreenshotWatermark', () => {
    const wrapper = mountBanners({ privateModeActive: true })
    expect(wrapper.findComponent({ name: 'ScreenshotWatermark' }).exists()).toBe(true)
  })
})
