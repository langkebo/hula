import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('@/router', () => ({ default: { push: vi.fn(), beforeEach: vi.fn() } }))
vi.mock('vue-router', () => ({ useRoute: () => ({ path: '/' }), useRouter: () => ({ push: vi.fn() }) }))

const stubStore = vi.hoisted(() => () => new Proxy({}, { get: () => vi.fn() }))

vi.mock('@/stores/domains/user/user', () => ({ useUserStore: () => stubStore() }))
vi.mock('@/stores/domains/chat/chat', () => ({ useChatStore: () => stubStore() }))
vi.mock('@/stores/domains/chat/contacts', () => ({ useContactStore: () => stubStore() }))
vi.mock('@/stores/domains/chat/group', () => ({ useGroupStore: () => stubStore() }))
vi.mock('@/stores/domains/chat/initialSync', () => ({ useInitialSyncStore: () => stubStore() }))
vi.mock('@/stores/domains/settings/setting', () => ({ useSettingStore: () => stubStore() }))
vi.mock('@/stores/domains/widget/file', () => ({ useFileStore: () => stubStore() }))
vi.mock('@/stores/domains/widget/global', () => ({ useGlobalStore: () => stubStore() }))

vi.mock('@/composables/common/useActionFeedback', () => ({ useActionFeedback: () => ({ showFeedback: vi.fn() }) }))
vi.mock('@/composables/common/useCheckUpdate', () => ({
  useCheckUpdate: () => ({ checkUpdate: vi.fn(), CHECK_UPDATE_TIME: 60000 })
}))
vi.mock('@/composables/common/useMitt', () => ({ useMitt: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }))
vi.mock('@/composables/common/useOverlayController', () => ({
  useOverlayController: () => ({ overlayVisible: false, markAsyncLoaded: vi.fn() })
}))
vi.mock('@/composables/common/useWindow', () => ({ useWindow: () => ({ ensureNotifyWindow: vi.fn() }) }))
vi.mock('@/composables/search/useSearchShortcut', () => ({ useSearchShortcut: vi.fn() }))
vi.mock('@/composables/user/useLoginFlow', () => ({
  useLoginFlow: () => ({ logout: vi.fn(), init: vi.fn(() => Promise.resolve()) })
}))

vi.mock('@/utils/AppHarness', () => ({ hasTauriRuntime: () => false, shouldBypassAuthForE2E: () => false }))
vi.mock('@/utils/AudioManager', () => ({ audioManager: { play: vi.fn() } }))
vi.mock('@/utils/FileUtil', () => ({ default: { map2PathUploadFile: vi.fn() } }))
vi.mock('@/utils/Logger', () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }) }))
vi.mock('@/utils/PathUtil', () => ({ getFilesMeta: vi.fn() }))
vi.mock('@/utils/PlatformConstants', () => ({ isMobile: () => false, isWindows: () => false }))
vi.mock('@/utils/TauriInvokeHandler', () => ({ invokeSilently: vi.fn() }))

vi.mock('@/enums', () => ({
  MittEnum: {
    SHRINK_WINDOW: 'SHRINK_WINDOW',
    CHAT_SCROLL_BOTTOM: 'CHAT_SCROLL_BOTTOM',
    GLOBAL_FILES_DROP: 'GLOBAL_FILES_DROP'
  },
  MsgEnum: { IMAGE: 'IMAGE', VIDEO: 'VIDEO' },
  NotificationTypeEnum: { NOT_DISTURB: 'NOT_DISTURB' },
  RoomTypeEnum: { GROUP: 'GROUP' },
  TauriCommand: { SAVE_MSG: 'SAVE_MSG' },
  WsResponseMessageType: { RECEIVE_MESSAGE: 'RECEIVE_MESSAGE' }
}))

vi.mock('@tauri-apps/api/event', () => ({ emitTo: vi.fn(), listen: vi.fn() }))
vi.mock('@tauri-apps/api/webviewWindow', () => ({ WebviewWindow: { getCurrent: vi.fn(), getByLabel: vi.fn() } }))
vi.mock('@tauri-apps/api/window', () => ({ UserAttentionType: { Critical: 'Critical' } }))

vi.mock('@/components/atomic/LoadingSpinner.vue', () => ({ default: { name: 'LoadingSpinner', template: '<div />' } }))
vi.mock('@/views/settingsWindow/SettingsDialog.vue', () => ({
  default: { name: 'SettingsDialog', template: '<div />' }
}))

const mountLayout = async () => {
  vi.stubGlobal(
    'Worker',
    class {
      postMessage = vi.fn()
      terminate = vi.fn()
      onerror = null
      onmessage = null
    }
  )
  const Layout = (await import('@/layout/index.vue')).default
  return shallowMount(Layout, {
    global: {
      stubs: {
        RouterView: true,
        GuestModeBanner: { name: 'GuestModeBanner', template: '<div data-testid="guest-banner" />' }
      }
    }
  })
}

describe('GuestModeBanner integration', () => {
  it('renders GuestModeBanner component', async () => {
    const wrapper = await mountLayout()
    expect(wrapper.findComponent({ name: 'GuestModeBanner' }).exists()).toBe(true)
  })
})

// Regression guard: layout/index.vue previously rendered <PrivacyOverlay v-if="isPrivacyMode">,
// where isPrivacyMode was a LOCAL ref from usePrivacyProtection that was NEVER set to true
// (enterPrivateChat was destructured but never called). This made PrivacyOverlay dead code —
// it never rendered. Private mode state is now owned by the usePrivateMode singleton and
// consumed by ChatBanners (ScreenshotWatermark / PrivateModeBanner), not by Layout-level overlays.
// These tests prevent re-introducing similar "declared-but-never-mutated state drives v-if" patterns.
describe('Layout private mode overlay regression', () => {
  it('does not render PrivacyOverlay component', async () => {
    const wrapper = await mountLayout()
    expect(wrapper.findComponent({ name: 'PrivacyOverlay' }).exists()).toBe(false)
  })

  it('does not render any privacy overlay element in layout output', async () => {
    const wrapper = await mountLayout()
    expect(wrapper.find('.privacy-overlay').exists()).toBe(false)
    expect(wrapper.find('[class*="privacy-overlay"]').exists()).toBe(false)
  })
})
