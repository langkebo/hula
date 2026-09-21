import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingStore } from '@/stores/domains/settings/setting'

const { setPresenceMock } = vi.hoisted(() => ({ setPresenceMock: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { getClient: () => ({}) }
}))
vi.mock('@/services/matrix/user/MatrixPresenceService', () => ({
  matrixPresenceService: { setPresence: setPresenceMock }
}))
vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: null })
}))

describe('usePresenceHeartbeat 尊重「显示在线状态」偏好', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('关闭偏好后不再上报 online', async () => {
    useSettingStore().setShowOnlineStatusEnabled(false)
    const { pushOnlineForTest } = await import('@/composables/user/usePresenceHeartbeat')
    await pushOnlineForTest()
    expect(setPresenceMock).not.toHaveBeenCalledWith('online')
  })

  it('偏好开启时正常上报', async () => {
    useSettingStore().setShowOnlineStatusEnabled(true)
    const { pushOnlineForTest } = await import('@/composables/user/usePresenceHeartbeat')
    await pushOnlineForTest()
    expect(setPresenceMock).toHaveBeenCalledWith('online')
  })
})
