import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { stopPresenceHeartbeat } from '@/composables/user/usePresenceHeartbeat'
import { OnlineEnum } from '@/enums'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'

const { setPresenceMock, updateUserItemMock, userInfo } = vi.hoisted(() => ({
  setPresenceMock: vi.fn().mockResolvedValue(undefined),
  updateUserItemMock: vi.fn(),
  userInfo: { uid: '@alice:matrix.test', activeStatus: 1 as number, lastOptTime: 0 }
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { getClient: () => ({}) }
}))
vi.mock('@/services/matrix/user/MatrixPresenceService', () => ({
  matrixPresenceService: { setPresence: setPresenceMock }
}))
vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: { setPresence: setPresenceMock }
}))
vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo })
}))
vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({ updateUserItem: updateUserItemMock })
}))

const ONLINE_STATE = { id: '1', title: '在线' }

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

  // 回归：降级不能是一次性布尔量（offlineDowngradeSent），否则「关→开→关」在同一个
  // 心跳周期内完成时，开关会被永久抑制，用户一直保持 online 直服务端 presence 超时。
  it('关→开（选择器直报 online，同一周期内）→关，心跳必须重新降级为 offline', async () => {
    const settingStore = useSettingStore()
    const { pushOnlineForTest } = await import('@/composables/user/usePresenceHeartbeat')

    // 1. 关闭开关 → 一个心跳周期内降级为 offline，且只发一次
    settingStore.setShowOnlineStatusEnabled(false)
    await pushOnlineForTest()
    expect(setPresenceMock).toHaveBeenCalledTimes(1)
    expect(setPresenceMock).toHaveBeenCalledWith('offline')

    // 2. 重新打开开关，并在状态选择器里选「在线」——该路径直报 online，不经过心跳
    //    （用户完全可能在下一个 45s tick 到来之前就再次关闭开关）
    settingStore.setShowOnlineStatusEnabled(true)
    setPresenceMock.mockClear()
    await useUserStatusStore().changeCurrentUserState(ONLINE_STATE)
    expect(setPresenceMock).toHaveBeenCalledWith('online')

    // 3. 同一个心跳周期内再次关闭开关 → 必须重新降级，不能被一次性标记永久抑制
    settingStore.setShowOnlineStatusEnabled(false)
    setPresenceMock.mockClear()
    await pushOnlineForTest()
    expect(setPresenceMock).toHaveBeenCalledWith('offline')
  })

  it('开关打开期间的心跳照旧上报 online，不会降级', async () => {
    const settingStore = useSettingStore()
    const { pushOnlineForTest } = await import('@/composables/user/usePresenceHeartbeat')

    settingStore.setShowOnlineStatusEnabled(true)
    setPresenceMock.mockClear()
    await pushOnlineForTest()

    expect(setPresenceMock).toHaveBeenCalledWith('online')
    expect(setPresenceMock).not.toHaveBeenCalledWith('offline')
  })

  it('关闭开关后用户显式选择 away/busy（unavailable）不会被心跳改写成 offline', async () => {
    const settingStore = useSettingStore()
    const { pushOnlineForTest } = await import('@/composables/user/usePresenceHeartbeat')

    settingStore.setShowOnlineStatusEnabled(false)
    await pushOnlineForTest() // 先完成一次降级
    setPresenceMock.mockClear()

    await useUserStatusStore().changeCurrentUserState({ id: '2', title: '忙碌' })
    expect(setPresenceMock).toHaveBeenCalledWith('unavailable')

    setPresenceMock.mockClear()
    await pushOnlineForTest()
    expect(setPresenceMock).not.toHaveBeenCalledWith('offline')
  })
})
