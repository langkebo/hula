import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import {
  makeAnnouncementListPage,
  makeAnnouncementListRecord
} from '@/stores/domains/chat/__tests__/fixtures/announcement'
import NoticeList from '../NoticeList.vue'

/**
 * 移动端群公告列表四态。
 *
 * 回归背景：拉取失败曾被渲染成「暂无公告」，用户会误以为公告已被清空；
 * 同时首次加载没有 loading 态，列表未返回前是一片空白。
 */

const { getGroupAnnouncementListMock } = vi.hoisted(() => ({
  getGroupAnnouncementListMock: vi.fn()
}))

vi.mock('vant', () => ({}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => ({ params: { roomId: '!room:server' }, query: {} }),
  useRouter: () => ({ push: vi.fn() })
}))
vi.mock('vue-virtual-scroller', () => ({
  RecycleScroller: defineComponent({
    name: 'RecycleScroller',
    props: ['items'],
    template: '<div data-testid="notice-rows" />'
  })
}))
vi.mock('@/stores/domains/chat/announcement', () => ({
  useAnnouncementStore: () => ({
    getGroupAnnouncementList: (...args: unknown[]) => getGroupAnnouncementListMock(...args)
  })
}))
vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: () => ({ name: 'Alice' }),
    isCurrentLord: () => false,
    isAdmin: () => false
  })
}))
vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: ref({ uid: 'u1' }) })
}))
vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId: '!room:server' })
}))

const MobileAsyncStateStub = defineComponent({
  name: 'MobileAsyncState',
  props: ['state', 'testId', 'minHeight', 'errorText', 'emptyText'],
  emits: ['retry'],
  template:
    '<div :data-testid="testId + \'-\' + state"><slot name="empty" /><button data-testid="notice-retry" @click="$emit(\'retry\')" /></div>'
})

const PassThrough = defineComponent({
  name: 'PassThrough',
  template: '<div><slot name="header" /><slot name="container" /></div>'
})

const mountPage = () =>
  mount(NoticeList, {
    global: {
      stubs: {
        AutoFixHeightPage: PassThrough,
        HeaderBar: true,
        MobileAsyncState: MobileAsyncStateStub
      },
      directives: { clickable: {} }
    }
  })

describe('NoticeList 四态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('首屏加载时展示 loading 态', async () => {
    getGroupAnnouncementListMock.mockReturnValue(new Promise(() => undefined))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="notice-list-loading"]').exists()).toBe(true)
  })

  it('拉取失败时展示 error 态与重试，而不是「暂无公告」', async () => {
    getGroupAnnouncementListMock.mockRejectedValue(new Error('network down'))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="notice-list-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="notice-list-empty"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="notice-retry"]').exists()).toBe(true)
  })

  it('点击重试后重新拉取并渲染列表', async () => {
    getGroupAnnouncementListMock.mockRejectedValueOnce(new Error('network down'))
    getGroupAnnouncementListMock.mockResolvedValueOnce(
      makeAnnouncementListPage([makeAnnouncementListRecord({ id: '1', content: 'hello', uid: 'u1' })])
    )
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('[data-testid="notice-retry"]').trigger('click')
    await flushPromises()

    expect(getGroupAnnouncementListMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="notice-list-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="notice-rows"]').exists()).toBe(true)
  })

  it('真正的空列表才展示空态', async () => {
    getGroupAnnouncementListMock.mockResolvedValue({ records: [] })
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="notice-list-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="notice-list-error"]').exists()).toBe(false)
  })
})
