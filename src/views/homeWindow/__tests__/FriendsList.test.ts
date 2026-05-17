import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FriendsList from '../FriendsList.vue'

const routerPushMock = vi.hoisted(() => vi.fn())
const secretChatConfiguredMock = vi.hoisted(() => vi.fn(() => true))
const announceMock = vi.hoisted(() => vi.fn())
const showFeedbackMock = vi.hoisted(() => vi.fn())

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
  useRouter: () => ({ push: routerPushMock }),
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

vi.mock('@/composables/common/useAriaLive', () => ({
  useAriaLive: () => ({
    announce: announceMock
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light',
    isSecretChatConfigured: secretChatConfiguredMock
  })
}))

vi.mock('@/components/friend/FriendListView.vue', () => ({
  default: {
    name: 'FriendListView',
    template: '<div class="friend-list-view-stub">friend-list-view</div>'
  }
}))

describe('FriendsList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    secretChatConfiguredMock.mockReturnValue(true)
  })

  it('承载 FriendListView 主入口并保留好友页壳层 shortcut', async () => {
    const wrapper = mount(FriendsList, {
      global: {
        plugins: [createPinia()]
      }
    })

    expect(wrapper.find('.friend-list-view-stub').exists()).toBe(true)
    expect(wrapper.find('.friends-list-shell__shortcut').exists()).toBe(true)
  })

  it('点击私密聊天入口时在已配置密码情况下跳转到 secretChat', async () => {
    const wrapper = mount(FriendsList, {
      global: {
        plugins: [createPinia()]
      }
    })

    await wrapper.find('.friends-list-shell__shortcut').trigger('click')

    expect(routerPushMock).toHaveBeenCalledWith('/secretChat')
  })

  it('未配置私密聊天密码时提示而不是跳转', async () => {
    secretChatConfiguredMock.mockReturnValue(false)
    const wrapper = mount(FriendsList, {
      global: {
        plugins: [createPinia()]
      }
    })

    await wrapper.find('.friends-list-shell__shortcut').trigger('click')

    expect(showFeedbackMock).toHaveBeenCalledWith('home.secret_chat.no_password', 'warning')
    expect(routerPushMock).not.toHaveBeenCalled()
  })
})
