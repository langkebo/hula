import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18nMock } from '~/tests/i18n-messages'
import SecretChatPage from '../SecretChatPage.vue'

vi.mock('vue-i18n', () => createI18nMock())

const mocks = vi.hoisted(() => ({
  push: vi.fn(async () => {}),
  back: vi.fn(),
  replace: vi.fn(async () => {}),
  openUnlock: vi.fn(),
  isPrivateRoom: vi.fn(),
  loadRegistry: vi.fn(async () => {}),
  migrate: vi.fn(async () => 0),
  unmark: vi.fn(async () => {}),
  // 运行期会被替换成真正的 ref（见 beforeEach），这里只占位
  sessionList: null as unknown
}))

// storeToRefs 直接返回可控 ref，避免拉真 pinia store
vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pinia')>()
  return {
    ...actual,
    storeToRefs: () => ({ sessionList: mocks.sessionList })
  }
})

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.push, back: mocks.back, replace: mocks.replace })
}))

vi.mock('@/stores/domains/chat/chat/session', () => ({
  useSessionStore: () => ({})
}))

vi.mock('@/composables/secretChat/useSecretChatGate', () => ({
  openSecretChatUnlock: mocks.openUnlock
}))

vi.mock('@/services/matrix/privateChat/privateRoomRegistry', () => ({
  isPrivateRoom: mocks.isPrivateRoom,
  loadPrivateRoomRegistry: mocks.loadRegistry,
  migrateFromHiddenSessions: mocks.migrate,
  unmarkRoomPrivate: mocks.unmark
}))

import {
  isSecretChatUnlocked,
  lockSecretChatSession,
  resetSecretChatSessionForTest,
  unlockSecretChatSession
} from '@/stores/domains/settings/secretChatSession'

const PRIVATE_ROOM = '!private:server'
const NORMAL_ROOM = '!normal:server'

const makeSession = (roomId: string, name: string, unreadCount = 0) =>
  ({ roomId, name, avatar: '', text: 'hi', unreadCount, hide: false }) as never

const mountPage = () =>
  mount(SecretChatPage, {
    global: {
      stubs: { EmptyState: { template: '<div data-testid="empty" />' } }
    }
  })

describe('SecretChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSecretChatSessionForTest()
    mocks.sessionList = ref([makeSession(PRIVATE_ROOM, 'Alice'), makeSession(NORMAL_ROOM, 'Bob')])
    mocks.isPrivateRoom.mockImplementation((roomId: string) => roomId === PRIVATE_ROOM)
  })

  afterEach(() => {
    resetSecretChatSessionForTest()
  })

  it('锁定态渲染锁定视图，且完全不泄漏会话名', async () => {
    const wrapper = mountPage()
    await nextTick()

    expect(wrapper.find('[data-testid="secret-chat-locked"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Alice')
    expect(wrapper.text()).not.toContain('Bob')
    expect(wrapper.findAll('.session-item')).toHaveLength(0)
  })

  it('未解锁时 hiddenSessions 恒为空（模板被改坏也不泄漏）', async () => {
    const wrapper = mountPage()
    await nextTick()

    const vm = wrapper.vm as unknown as { hiddenSessions: unknown[] }
    expect(vm.hiddenSessions).toEqual([])
  })

  it('解锁后只展示私密会话，普通会话不出现', async () => {
    unlockSecretChatSession(new Uint8Array(32))
    const wrapper = mountPage()
    await nextTick()

    expect(wrapper.find('[data-testid="secret-chat-locked"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).not.toContain('Bob')
  })

  it('页面停留期间被上锁（自动锁）→ 立刻切锁定态，会话名从 DOM 消失', async () => {
    unlockSecretChatSession(new Uint8Array(32))
    const wrapper = mountPage()
    await nextTick()
    expect(wrapper.text()).toContain('Alice')

    lockSecretChatSession('测试触发自动锁')
    await nextTick()

    expect(wrapper.find('[data-testid="secret-chat-locked"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Alice')
  })

  it('关闭页面即上锁（默认策略）', async () => {
    unlockSecretChatSession(new Uint8Array(32))
    const wrapper = mountPage()
    await nextTick()

    const vm = wrapper.vm as unknown as { handleClose: () => void }
    vm.handleClose()

    expect(isSecretChatUnlocked()).toBe(false)
    expect(mocks.back).toHaveBeenCalled()
  })
})
