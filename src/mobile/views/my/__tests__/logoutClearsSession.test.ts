import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { patchMatrixSessionSnapshot } from '@/services/matrix/matrixSessionState'
import { DND_MIRROR_STORAGE_KEYS } from '@/services/matrix/notifications/dndMirror'
import { INVITE_POLICY_ACCOUNT_DATA_TYPE } from '@/services/matrix/user/invitePolicy'
import { pinia } from '@/stores'
import MobileSettings from '../MobileSettings.vue'

/**
 * 整分支评审 I3：移动端登出原先直接调 `matrixClientService.logout()`，
 * 绕过了 `SessionLogoutService.resetLocalSessionState`，于是 sessionUnread、DND 镜像与
 * 邀请策略缓存都不会在移动端登出时清理——文档声称的「显式登出清理」契约在真实路径上不成立。
 *
 * 这里从**移动端页面本身**驱动登出（不是直接调 orchestrator），证明该路径确实会清掉本地会话状态。
 *
 * 2026-11-11 迁移：登出按钮从「我的」首屏移到设置页底部（首屏不再放危险操作），
 * 且两条分叉的登出实现（`useSessionActions` / `useLoginFlow`）合并为
 * `useMobileLogout`。因此用例改为挂载 `MobileSettings.vue`。
 */

const showDialogMock = vi.fn().mockResolvedValue(undefined)
const showToastMock = vi.fn()
const showFailToastMock = vi.fn()
const routerPushMock = vi.fn().mockResolvedValue(undefined)

vi.mock('vant', () => ({
  showDialog: (...args: unknown[]) => showDialogMock(...args),
  showToast: (...args: unknown[]) => showToastMock(...args),
  showFailToast: (...args: unknown[]) => showFailToastMock(...args)
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
  useRoute: () => ({ path: '/mobile/mobileMy/settings', params: {}, query: {} })
}))

// 登出只验证本地状态清理，SDK 客户端生命周期用桩；真实清理链路（SessionLogoutService）保持不 mock。
const matrixClientServiceMock = vi.hoisted(() => ({
  logout: vi.fn().mockResolvedValue(undefined),
  getClient: vi.fn().mockReturnValue(null),
  on: vi.fn(),
  off: vi.fn()
}))
vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: matrixClientServiceMock,
  matrixClientService: matrixClientServiceMock
}))

vi.mock('@/services/matrix/MatrixWorkerHost', () => ({
  matrixWorkerHost: {
    resetSearchIndex: vi.fn().mockResolvedValue(undefined),
    clearStores: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn()
  }
}))

vi.mock('@/services/matrix/MatrixWsBridge', () => ({ matrixWsBridge: { stop: vi.fn() } }))
vi.mock('@/composables/user/usePresenceHeartbeat', () => ({ stopPresenceHeartbeat: vi.fn() }))
vi.mock('@/services/matrix/user/MatrixPresenceService', () => ({
  matrixPresenceService: { setPresence: vi.fn().mockResolvedValue(undefined) }
}))
vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeWithErrorHandler: vi.fn().mockResolvedValue(undefined),
  invokeSilently: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('@tauri-apps/api/event', () => ({ emit: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({ resizeWindow: vi.fn(), createWebviewWindow: vi.fn().mockResolvedValue(null) })
}))
vi.mock('@/utils/PlatformConstants', () => ({ isDesktop: () => false, isMac: () => false }))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

// 页面骨架（自动注册的布局组件）与登出无关；真实实现会经 useSafeBack 拉起 `@/router`
// 单例，而本用例把 vue-router 整体桩掉了，必须在模块边界截断。
vi.mock('#/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: { name: 'AutoFixHeightPage', template: '<div><slot name="header" /><slot name="container" /></div>' }
}))
vi.mock('#/components/chat-room/HeaderBar.vue', () => ({
  default: { name: 'HeaderBar', template: '<div />' }
}))

const INVITE_POLICY_KEY = `${INVITE_POLICY_ACCOUNT_DATA_TYPE}:@me:test`

// shallow：页面模板里的 vant 组件与图标壳跟登出无关，stub 掉只执行 setup。
// 显式列 vant 组件名，避免「Failed to resolve component: van-*」噪声淹没真实告警。
const mountPage = () =>
  mount(MobileSettings, {
    global: {
      plugins: [pinia],
      stubs: {
        VanCell: true,
        VanCellGroup: true,
        VanRadioGroup: true,
        VanRadio: true,
        VanSwitch: true,
        VanButton: true
      }
    },
    shallow: true
  })

describe('移动端设置页登出', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    showDialogMock.mockResolvedValue(undefined)
    patchMatrixSessionSnapshot({ userId: '@me:test', deviceId: 'DEV1' })
  })

  it('走显式登出清理：清掉持久化的 sessionUnread、DND 镜像与邀请策略缓存', async () => {
    localStorage.setItem(
      'sessionUnread',
      JSON.stringify({
        cacheStore: { '@me:test': { '!room:test': { count: 3, updatedAt: 1, settledServerCount: 0 } } },
        lastReadActiveTimeStore: { '@me:test': { '!room:test': 100 } }
      })
    )
    localStorage.setItem(DND_MIRROR_STORAGE_KEYS.enabled, 'true')
    localStorage.setItem(DND_MIRROR_STORAGE_KEYS.updatedAt, String(Date.now()))
    localStorage.setItem(DND_MIRROR_STORAGE_KEYS.owner, '@me:test')
    localStorage.setItem(INVITE_POLICY_KEY, JSON.stringify({ policy: 'all' }))

    const wrapper = mountPage()
    await (wrapper.vm as unknown as { handleLogout: () => Promise<void> }).handleLogout()

    expect(localStorage.getItem('sessionUnread')).toBeNull()
    expect(localStorage.getItem(DND_MIRROR_STORAGE_KEYS.enabled)).toBeNull()
    expect(localStorage.getItem(DND_MIRROR_STORAGE_KEYS.updatedAt)).toBeNull()
    expect(localStorage.getItem(DND_MIRROR_STORAGE_KEYS.owner)).toBeNull()
    expect(localStorage.getItem(INVITE_POLICY_KEY)).toBeNull()
    expect(showFailToastMock).not.toHaveBeenCalled()
    expect(routerPushMock).toHaveBeenCalledWith('/mobile/login')
  })
})
