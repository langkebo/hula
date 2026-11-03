import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingStore } from '@/stores/domains/settings/setting'

const handlers = new Map<string, (event: unknown) => void>()

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

import { useLockScreenSync } from '../useLockScreenSync'

describe('useLockScreenSync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    handlers.clear()
  })

  it('收到 LOCK_SCREEN 置 enable=true，收到 UNLOCK_SCREEN 置 false', async () => {
    useLockScreenSync()
    await Promise.resolve()

    const store = useSettingStore()

    handlers.get('lockScreen')?.({})
    expect(store.lockScreen.enable).toBe(true)

    handlers.get('unlockScreen')?.({})
    expect(store.lockScreen.enable).toBe(false)
  })
})
