import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { OnlineEnum } from '@/enums'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'

const { setPresenceMock, updateUserItemMock } = vi.hoisted(() => ({
  setPresenceMock: vi.fn(),
  updateUserItemMock: vi.fn().mockReturnValue(true)
}))

// 门控已收敛到 MatrixPresenceService.setPresence（见该服务的门控测试）。
// 这里不再 mock resolveOutgoingPresence：store 的职责只有两个——
//   1) 把用户的「期望状态」作为意图传给唯一写入点；
//   2) 用服务返回的「生效值」决定本地 activeStatus 是否降级。
vi.mock('@/services/matrix/user/MatrixPresenceService', () => ({
  matrixPresenceService: { setPresence: setPresenceMock }
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

describe('userStatus.changeCurrentUserState 把门控交给 presence 服务', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    userInfo.activeStatus = OnlineEnum.ONLINE
    userInfo.userStateId = '1'
  })

  it('把 online 意图原样交给服务，并按服务返回的 offline 把本地 activeStatus 置为离线', async () => {
    // 桌面关闭「显示在线状态」时服务会返回 offline
    setPresenceMock.mockResolvedValue('offline')
    const store = useUserStatusStore()

    await store.changeCurrentUserState(ONLINE_STATE)

    expect(setPresenceMock).toHaveBeenCalledWith('online')
    expect(userInfo.activeStatus).toBe(OnlineEnum.OFFLINE)
    // 用户的选择仍然记录下来，重新打开开关后按该状态上报
    expect(store.stateId).toBe('1')
    expect(userInfo.userStateId).toBe('1')
  })

  it('服务返回 online（开关开启）时不降级本地 activeStatus', async () => {
    setPresenceMock.mockResolvedValue('online')
    const store = useUserStatusStore()

    await store.changeCurrentUserState(ONLINE_STATE)

    expect(setPresenceMock).toHaveBeenCalledWith('online')
    expect(userInfo.activeStatus).toBe(OnlineEnum.ONLINE)
    expect(store.stateId).toBe('1')
  })

  it('away/隐身 等非在线状态原样上报，服务返回同值时不降级', async () => {
    setPresenceMock.mockResolvedValue('unavailable')
    const store = useUserStatusStore()

    await store.changeCurrentUserState(AWAY_STATE)

    expect(setPresenceMock).toHaveBeenCalledWith('unavailable')
    expect(store.stateId).toBe('2')
    expect(userInfo.activeStatus).toBe(OnlineEnum.ONLINE)

    setPresenceMock.mockClear()
    setPresenceMock.mockResolvedValue('offline')
    await store.changeCurrentUserState(INVISIBLE_STATE)

    expect(setPresenceMock).toHaveBeenCalledWith('offline')
    expect(store.stateId).toBe('3')
  })
})
