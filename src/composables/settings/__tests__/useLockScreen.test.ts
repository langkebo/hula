import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingStore } from '@/stores/domains/settings/setting'

const handlers = new Map<string, (event: unknown) => void>()
const routeState = vi.hoisted(() => ({ path: '/message' }))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((name: string, cb: (event: unknown) => void) => {
    handlers.set(name, cb)
    return Promise.resolve(() => handlers.delete(name))
  })
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getCurrent: () => ({ label: 'test', onCloseRequested: () => Promise.resolve(() => {}) })
  }
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => true
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState
}))

import { useLockScreen } from '../useLockScreen'

describe('useLockScreen', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    handlers.clear()
    routeState.path = '/message'
  })

  it('收到 LOCK_SCREEN 置 enable=true，收到 UNLOCK_SCREEN 置 false', async () => {
    useLockScreen()
    await Promise.resolve()

    const store = useSettingStore()

    handlers.get('lockScreen')?.({})
    expect(store.lockScreen.enable).toBe(true)

    handlers.get('unlockScreen')?.({})
    expect(store.lockScreen.enable).toBe(false)
  })

  it('无密码凭据时不进入锁定层（历史数据自锁死防护）', () => {
    const store = useSettingStore()
    store.lockScreen.enable = true
    store.lockScreen.passwordHash = ''

    expect(useLockScreen().isLock.value).toBe(false)
  })

  it('有凭据且 enable 时锁定，排除路由不锁定', () => {
    const store = useSettingStore()
    store.lockScreen.enable = true
    store.lockScreen.passwordHash = 'lock-screen:verifier'

    expect(useLockScreen().isLock.value).toBe(true)

    routeState.path = '/login'
    expect(useLockScreen().isLock.value).toBe(false)
  })
})
