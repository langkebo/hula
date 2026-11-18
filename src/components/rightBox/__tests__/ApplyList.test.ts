import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoticeItem } from '@/services/types.ts'
import { NoticeType, RequestNoticeAgreeStatus } from '@/services/types.ts'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { createI18nMock } from '~/tests/i18n-messages'
import ApplyList from '../ApplyList.vue'

const { loadGroupInfoMock, getUserInfoMock } = vi.hoisted(() => ({
  loadGroupInfoMock: vi.fn(),
  getUserInfoMock: vi.fn()
}))

vi.mock('naive-ui', async () => {
  const { defineComponent } = await import('vue')

  return {
    NFlex: defineComponent({
      name: 'NFlex',
      template: '<div><slot /></div>'
    }),
    NAvatar: defineComponent({
      name: 'NAvatar',
      props: ['src', 'size', 'round'],
      template: '<div data-test="avatar" />'
    }),
    NButton: defineComponent({
      name: 'NButton',
      template: '<button type="button"><slot /></button>'
    }),
    NDropdown: defineComponent({
      name: 'NDropdown',
      template: '<div><slot /></div>'
    }),
    NIcon: defineComponent({
      name: 'NIcon',
      template: '<span><slot /></span>'
    }),
    NVirtualList: defineComponent({
      name: 'NVirtualList',
      props: ['items'],
      template:
        '<div><template v-for="item in items" :key="item.id ?? item.applyId"><slot :item="item" /></template></div>'
    })
  }
})

vi.mock('vue-i18n', () => createI18nMock())

vi.mock('@/stores/domains/chat/contacts', async () => {
  const { reactive } = await import('vue')
  const state = reactive({
    requestFriendsList: [] as NoticeItem[],
    requestLoadError: false,
    applyPageOptions: { isLast: true },
    getApplyPage: vi.fn().mockResolvedValue(undefined),
    loadFriendRequests: vi.fn().mockResolvedValue(undefined),
    onHandleInvite: vi.fn().mockResolvedValue(undefined)
  })
  return { useContactStore: () => state }
})

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: getUserInfoMock,
    loadGroupInfo: loadGroupInfoMock
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    userInfo: { uid: '999' }
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (url: string) => url
  }
}))

vi.mock('@/utils/ComputedTime.ts', () => ({
  formatChatTime: () => ''
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

vi.mock('@/utils/TimerManager', () => ({
  useTimerManager: () => ({ setTimeout: vi.fn(), clearAll: vi.fn() })
}))

type ContactState = { requestFriendsList: NoticeItem[]; requestLoadError: boolean }

const contactState = () => useContactStore() as unknown as ContactState

const buildGroupNotice = (overrides: Partial<NoticeItem> = {}): NoticeItem => ({
  id: 'notice-1',
  eventType: NoticeType.GROUP_APPLY,
  type: 1,
  senderId: 'alice',
  receiverId: '999',
  applyId: 'apply-1',
  roomId: '123',
  content: '',
  status: RequestNoticeAgreeStatus.UNTREATED,
  isRead: false,
  createTime: 0,
  ...overrides
})

describe('ApplyList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    contactState().requestFriendsList = []
    contactState().requestLoadError = false
    getUserInfoMock.mockReturnValue(undefined)
  })

  it('群详情读取失败时显示失败文案与重试入口，重试成功后恢复群名', async () => {
    loadGroupInfoMock.mockRejectedValueOnce(new Error('group detail failed'))
    contactState().requestFriendsList = [buildGroupNotice()]

    const wrapper = mount(ApplyList, { props: { type: 'group' } })
    await flushPromises()

    // 失败不得一直停留在「加载中...」
    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.text()).not.toContain('加载中...')
    const retryButton = wrapper.find('[data-test="apply-group-detail-retry"]')
    expect(retryButton.exists()).toBe(true)

    loadGroupInfoMock.mockResolvedValueOnce({ name: '测试群' })
    await retryButton.trigger('click')
    await flushPromises()

    expect(loadGroupInfoMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('申请加入 [测试群]')
    expect(wrapper.find('[data-test="apply-group-detail-retry"]').exists()).toBe(false)
  })

  it('群详情读取失败后不会因重复渲染而反复请求', async () => {
    loadGroupInfoMock.mockRejectedValueOnce(new Error('group detail failed'))
    contactState().requestFriendsList = [buildGroupNotice()]

    const wrapper = mount(ApplyList, { props: { type: 'group' } })
    await flushPromises()
    await wrapper.vm.$nextTick()
    await flushPromises()

    expect(loadGroupInfoMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('加载失败')
  })
})
