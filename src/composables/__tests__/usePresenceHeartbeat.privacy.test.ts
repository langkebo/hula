import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { stopPresenceHeartbeat } from '@/composables/user/usePresenceHeartbeat'
import { OnlineEnum } from '@/enums'
import { useSettingStore } from '@/stores/domains/settings/setting'

const { setPresenceMock, userInfo } = vi.hoisted(() => ({
  setPresenceMock: vi.fn().mockResolvedValue(undefined),
  userInfo: { activeStatus: 1 as number, lastOptTime: 0 }
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { getClient: () => ({}) }
}))
vi.mock('@/services/matrix/user/MatrixPresenceService', () => ({
  matrixPresenceService: { setPresence: setPresenceMock }
}))
vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo })
}))

describe('usePresenceHeartbeat 尊重「显示在线状态」偏好', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // 重置「本会话已下发过 offline 降级」的记账，避免用例之间互相影响
    stopPresenceHeartbeat()
    userInfo.activeStatus = OnlineEnum.ONLINE
    userInfo.lastOptTime = 0
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

  it('关闭偏好后主动降级为 offline，并把本地状态置为离线', async () => {
    useSettingStore().setShowOnlineStatusEnabled(false)
    const { pushOnlineForTest } = await import('@/composables/user/usePresenceHeartbeat')
    await pushOnlineForTest()

    expect(setPresenceMock).toHaveBeenCalledWith('offline')
    expect(userInfo.activeStatus).toBe(OnlineEnum.OFFLINE)
  })

  it('关闭偏好的降级只下发一次，避免每 45s 重复发同一个状态', async () => {
    useSettingStore().setShowOnlineStatusEnabled(false)
    const { pushOnlineForTest } = await import('@/composables/user/usePresenceHeartbeat')
    await pushOnlineForTest()
    await pushOnlineForTest()

    expect(setPresenceMock).toHaveBeenCalledTimes(1)
    expect(setPresenceMock).toHaveBeenCalledWith('offline')
  })

  it('重新打开偏好后恢复上报 online', async () => {
    const settingStore = useSettingStore()
    const { pushOnlineForTest } = await import('@/composables/user/usePresenceHeartbeat')

    settingStore.setShowOnlineStatusEnabled(false)
    await pushOnlineForTest()

    settingStore.setShowOnlineStatusEnabled(true)
    await pushOnlineForTest()

    expect(setPresenceMock).toHaveBeenLastCalledWith('online')
    expect(userInfo.activeStatus).toBe(OnlineEnum.ONLINE)
  })
})
