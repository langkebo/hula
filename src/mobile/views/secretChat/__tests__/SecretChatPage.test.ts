import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { MOBILE_SETTINGS_SECURITY_PRIVACY_PATH } from '@/mobile/views/my/settingsRoutes'
import SecretChatPage from '../SecretChatPage.vue'

/**
 * D19：移动端私密会话页。
 *
 * 私密房会被普通会话列表整体过滤，本页是唯一入口，因此两条底线必须锁死：
 * 1. 锁定态不渲染任何会话名（遮罩能被读屏/截图绕过，只能 v-if）；
 * 2. 离开本页要上锁，但进入私密会话本身不算「关闭」（否则聊天页门禁会拦下）。
 */

const sessionList = ref([
  { roomId: '!private:test', name: '私密联系人', text: '昨晚的事', avatar: '', unreadCount: 2, hide: false },
  { roomId: '!normal:test', name: '普通联系人', text: '你好', avatar: '', unreadCount: 0, hide: false }
])

const isUnlocked = ref(true)
const configured = ref(true)
const isPrivateRoomMock = vi.fn((roomId: string) => roomId === '!private:test')
const openUnlockMock = vi.fn()
const lockMock = vi.fn()
const pushMock = vi.fn().mockResolvedValue(undefined)
const replaceMock = vi.fn().mockResolvedValue(undefined)
const loadRegistryMock = vi.fn().mockResolvedValue(undefined)
const migrateMock = vi.fn().mockResolvedValue(undefined)
const unmarkMock = vi.fn().mockResolvedValue(undefined)
const showConfirmDialogMock = vi.fn().mockResolvedValue(undefined)
const leaveGuard = vi.hoisted(() => ({ current: undefined as undefined | ((to: { name?: string }) => void) }))

vi.mock('vant', () => ({
  showConfirmDialog: (...args: unknown[]) => showConfirmDialogMock(...args),
  showToast: vi.fn()
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  onBeforeRouteLeave: (cb: (to: { name?: string }) => void) => {
    leaveGuard.current = cb
  }
}))

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: { name: 'AutoFixHeightPage', template: '<div><slot name="header" /><slot name="container" /></div>' }
}))
vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: { name: 'HeaderBar', template: '<div />' }
}))

vi.mock('@/composables/secretChat/useSecretChatGate', () => ({
  openSecretChatUnlock: (...args: unknown[]) => openUnlockMock(...args)
}))

vi.mock('@/services/matrix/privateChat/privateRoomRegistry', () => ({
  isPrivateRoom: (roomId: string) => isPrivateRoomMock(roomId),
  loadPrivateRoomRegistry: () => loadRegistryMock(),
  migrateFromHiddenSessions: (...args: unknown[]) => migrateMock(...args),
  unmarkRoomPrivate: (...args: unknown[]) => unmarkMock(...args)
}))

vi.mock('@/stores/domains/chat/chat/session', () => ({
  useSessionStore: () => ({})
}))

// 列表视图模型（`useSecretChatSessions`）用 storeToRefs 读会话列表；
// 这里给出同一个 ref，让页面与用例共享一份数据。
const storeRefs = vi.hoisted(() => ({ sessionList: null as unknown }))
vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pinia')>()
  return { ...actual, storeToRefs: () => ({ sessionList: storeRefs.sessionList }) }
})

vi.mock('@/stores/domains/settings/secretChatSession', () => ({
  useSecretChatSession: () => ({ isUnlocked }),
  isSecretChatUnlocked: () => isUnlocked.value,
  lockSecretChatSession: (...args: unknown[]) => lockMock(...args)
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({ isSecretChatConfigured: () => configured.value })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

const mountPage = () =>
  mount(SecretChatPage, {
    global: {
      stubs: {
        // 渲染默认插槽，才能断言按钮文案与命中区尺寸
        VanButton: { template: '<button v-bind="$attrs"><slot /></button>' },
        VanEmpty: true,
        VanBadge: true,
        VanCellGroup: { template: '<div><slot /></div>' },
        VanCell: {
          props: ['title', 'label'],
          template:
            '<div class="cell" @click="$emit(\'click\')"><slot name="title">{{ title }}</slot><slot name="icon" /><slot name="value" /><slot name="right-icon" /></div>'
        }
      }
    }
  })

describe('移动端私密会话页', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeRefs.sessionList = sessionList
    isUnlocked.value = true
    configured.value = true
    showConfirmDialogMock.mockResolvedValue(undefined)
  })

  it('锁定态：不渲染任何会话名/预览', () => {
    isUnlocked.value = false
    const wrapper = mountPage()

    expect(wrapper.find('[data-testid="mobile-secret-chat-locked"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('私密联系人')
    expect(wrapper.text()).not.toContain('昨晚的事')
    // 锁定态不拉取登记表
    expect(loadRegistryMock).not.toHaveBeenCalled()
  })

  it('解锁态：只展示私密会话，点击进入移动端聊天页', async () => {
    const wrapper = mountPage()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('私密联系人')
    expect(wrapper.text()).not.toContain('普通联系人')
    expect(loadRegistryMock).toHaveBeenCalled()

    await wrapper.find('.cell').trigger('click')
    expect(pushMock).toHaveBeenCalledWith({ name: 'mobileChatMain', params: { roomId: '!private:test' } })
  })

  it('离开本页上锁；进入私密会话本身不上锁', () => {
    mountPage()
    expect(leaveGuard.current).toBeTypeOf('function')

    leaveGuard.current?.({ name: 'mobileChatMain' })
    expect(lockMock).not.toHaveBeenCalled()

    leaveGuard.current?.({ name: 'mobileMessage' })
    expect(lockMock).toHaveBeenCalled()
  })

  it('未设置密码时锁定态显示「去设置密码」并跳转安全设置页', async () => {
    isUnlocked.value = false
    configured.value = false
    const wrapper = mountPage()

    const cta = wrapper.get('[data-testid="mobile-secret-chat-setup-password"]')
    expect(cta.text()).toBe('mobile_security.secret_chat.go_settings')
    await cta.trigger('click')
    expect(pushMock).toHaveBeenCalledWith(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
  })

  it('未解锁且未配置密码：直接跳安全设置页，不弹解锁框', () => {
    isUnlocked.value = false
    configured.value = false
    mountPage()

    expect(replaceMock).toHaveBeenCalledWith(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
    expect(openUnlockMock).not.toHaveBeenCalled()
  })

  it('未解锁但已配置密码：打开解锁框并回跳本页', () => {
    isUnlocked.value = false
    configured.value = true
    mountPage()

    expect(openUnlockMock).toHaveBeenCalledWith('/mobile/secretChat')
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('移出私密按钮命中区 44px 且带无障碍标签', () => {
    const wrapper = mountPage()
    const unmark = wrapper.get('[aria-label="home.secret_chat.unmark_private"]')

    expect(unmark.classes()).toContain('w-44px')
    // Vant 的 .van-button--mini 会设置 24px 高且后置生效，必须用 important 尺寸类压过
    expect(unmark.classes()).toContain('!h-44px')
  })
})
