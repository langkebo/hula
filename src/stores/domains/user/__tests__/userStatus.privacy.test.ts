import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { OnlineEnum } from '@/enums'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'

const { setPresenceMock, updateUserItemMock } = vi.hoisted(() => ({
  setPresenceMock: vi.fn().mockResolvedValue(true),
  updateUserItemMock: vi.fn().mockReturnValue(true)
}))

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: { setPresence: setPresenceMock }
}))

const userInfo = reactive<{
  uid: string
  activeStatus: OnlineEnum
  userStateId: string
  lastOptTime?: number
}>({
  uid: '@alice:matrix.test',
  activeStatus: OnlineEnum.ONLINE,
  userStateId: '1'
})

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({ updateUserItem: updateUserItemMock })
}))

const ONLINE_STATE = { id: '1', title: '在线' }
const AWAY_STATE = { id: '2', title: '忙碌' }
const INVISIBLE_STATE = { id: '3', title: '隐身' }

describe('userStatus.changeCurrentUserState 尊重「显示在线状态」偏好', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    userInfo.activeStatus = OnlineEnum.ONLINE
    userInfo.userStateId = '1'
  })

  it('关闭偏好后选择 online 降级为 offline，并把本地 activeStatus 置为离线', async () => {
    useSettingStore().setShowOnlineStatusEnabled(false)
    const store = useUserStatusStore()

    await store.changeCurrentUserState(ONLINE_STATE)

    expect(setPresenceMock).toHaveBeenCalledWith('offline')
    expect(setPresenceMock).not.toHaveBeenCalledWith('online')
    expect(userInfo.activeStatus).toBe(OnlineEnum.OFFLINE)
    // 用户的选择仍然记录下来，重新打开开关后按该状态上报
    expect(store.stateId).toBe('1')
    expect(userInfo.userStateId).toBe('1')
  })

  it('开启偏好时选择 online 照旧上报 online', async () => {
    useSettingStore().setShowOnlineStatusEnabled(true)
    const store = useUserStatusStore()

    await store.changeCurrentUserState(ONLINE_STATE)

    expect(setPresenceMock).toHaveBeenCalledWith('online')
    expect(store.stateId).toBe('1')
  })

  it('关闭偏好不影响 away/busy/隐身 等非在线状态的上报', async () => {
    useSettingStore().setShowOnlineStatusEnabled(false)
    const store = useUserStatusStore()

    await store.changeCurrentUserState(AWAY_STATE)

    expect(setPresenceMock).toHaveBeenCalledWith('unavailable')
    expect(store.stateId).toBe('2')

    setPresenceMock.mockClear()
    await store.changeCurrentUserState(INVISIBLE_STATE)

    expect(setPresenceMock).toHaveBeenCalledWith('offline')
    expect(store.stateId).toBe('3')
  })
})
