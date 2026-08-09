import { shallowMount } from '@vue/test-utils'
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
