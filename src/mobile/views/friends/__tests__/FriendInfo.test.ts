import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeProfile } from '@/services/matrix/user/__tests__/fixtures/profile'
import FriendInfo from '../FriendInfo.vue'

/**
 * 移动端好友资料页。
 *
 * 缺口背景：资料读取失败时页面会回落成「未知」，把「读不到昵称」伪装成「该用户没有昵称」。
 */

const { getProfileMock } = vi.hoisted(() => ({ getProfileMock: vi.fn() }))

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)

vi.mock('vant', async () => {
  const { defineComponent } = await import('vue')
  const passthrough = (name: string, tag = 'div') =>
    defineComponent({ name, inheritAttrs: false, template: `<${tag} v-bind="$attrs"><slot /></${tag}>` })
  return {
    VanTabs: passthrough('VanTabs'),
    VanTab: passthrough('VanTab'),
    VanEmpty: passthrough('VanEmpty'),
    VanButton: passthrough('VanButton', 'button')
  }
})

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { uid: '@bob:matrix.test' } }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })
}))

vi.mock('@/router', () => ({ default: { push: vi.fn(), replace: vi.fn(), back: vi.fn() } }))

vi.mock('#/components/my/PersonalInfo.vue', () => ({
  default: { name: 'PersonalInfo', template: '<div />' }
}))

vi.mock('@/services/matrix/user/MatrixProfileService', () => ({
  profileService: { getProfile: (...args: unknown[]) => getProfileMock(...args) }
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => ({ contactsList: [] })
}))

vi.mock('@/stores/domains/chat/contacts/contactDisplay', () => ({
  getContactDisplayName: (contact: { userId: string }) => contact.userId
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({ allUserInfo: [] })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

const mountPage = () =>
  mount(FriendInfo, {
    global: {
      stubs: {
        PersonalInfo: true,
        HeaderBar: { name: 'HeaderBar', template: '<div />' },
        AutoFixHeightPage: {
          name: 'AutoFixHeightPage',
          template: '<div><slot name="header" /><slot name="container" /></div>'
        }
      }
    }
  })

describe('FriendInfo 资料读取失败不伪装成「未知」', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('读取失败时显示错误提示与重试入口，而不是「未知」', async () => {
    getProfileMock.mockRejectedValueOnce(new Error('boom'))

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('mobile_contact.friend_info.load_failed')
    expect(wrapper.text()).not.toContain('mobile_contact.friend_info.unknown')
    expect(wrapper.find('[data-test="friend-profile-retry"]').exists()).toBe(true)
  })

  it('重试成功后回填昵称并隐藏错误提示', async () => {
    getProfileMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(makeProfile({ displayname: 'Alice' }))

    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('[data-test="friend-profile-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).not.toContain('mobile_contact.friend_info.load_failed')
  })
})
