import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OnlineEnum } from '@/enums'
import { useSettingStore } from '@/stores/domains/settings/setting'
import UserMenuHeader from '../UserMenuHeader.vue'

const { setPresenceMock, showFeedbackMock, userInfo, userStatusStoreMock } = vi.hoisted(() => ({
  setPresenceMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  userInfo: { uid: '@alice:matrix.test', activeStatus: 1 },
  userStatusStoreMock: { stateId: 'online' }
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />' }
}))

vi.mock('naive-ui', () => ({
  NAvatar: { name: 'NAvatar', template: '<span><slot /></span>' },
  NButton: { name: 'NButton', template: '<button><slot name="icon" /><slot /></button>' },
  NPopover: { name: 'NPopover', template: '<div><slot name="trigger" /><slot /></div>' }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

// 组件经 useAccount 委托给唯一门控写入点；这里断言传出的「意图」，
// 以及对服务返回「生效值」的本地镜像（门控本身在 MatrixPresenceService 测试里覆盖）。
vi.mock('@/composables/user/useAccount', () => ({
  useAccount: () => ({ setPresence: setPresenceMock })
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => ({ userId: '@alice:matrix.test' })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo, currentUserDisplayName: 'Alice', currentUserAvatarUrl: '' })
}))

vi.mock('@/stores/domains/user/userStatus', () => ({
  useUserStatusStore: () => userStatusStoreMock
}))

type HeaderVm = { handleStatusChange: (statusId: string) => Promise<void> }

const changeStatus = async (statusId: string) => {
  const wrapper = mount(UserMenuHeader)
  await (wrapper.vm as unknown as HeaderVm).handleStatusChange(statusId)
  return wrapper
}

describe('UserMenuHeader 状态菜单把门控交给 presence 服务', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    userInfo.activeStatus = OnlineEnum.ONLINE
    userStatusStoreMock.stateId = 'online'
  })

  it('把 online 意图原样交给服务，并按返回的 offline 把本地 activeStatus 置为离线', async () => {
    // 桌面关闭「显示在线状态」时服务会返回 offline
    useSettingStore().setShowOnlineStatusEnabled(false)
    setPresenceMock.mockResolvedValue('offline')

    await changeStatus('online')

    expect(setPresenceMock).toHaveBeenCalledWith('online')
    expect(userInfo.activeStatus).toBe(OnlineEnum.OFFLINE)
    expect(showFeedbackMock).toHaveBeenCalledWith('menu.user_menu.status.updated', 'success')
  })

  it('服务返回 online（开关开启）时照旧上报 online 且不降级本地状态', async () => {
    useSettingStore().setShowOnlineStatusEnabled(true)
    setPresenceMock.mockResolvedValue('online')

    await changeStatus('online')

    expect(setPresenceMock).toHaveBeenCalledWith('online')
    expect(userInfo.activeStatus).toBe(OnlineEnum.ONLINE)
  })

  it('away/busy/offline 的映射意图原样交给服务', async () => {
    useSettingStore().setShowOnlineStatusEnabled(false)
    setPresenceMock.mockImplementation((presence: string) => Promise.resolve(presence))

    await changeStatus('away')
    expect(setPresenceMock).toHaveBeenLastCalledWith('unavailable')

    await changeStatus('busy')
    expect(setPresenceMock).toHaveBeenLastCalledWith('unavailable')

    await changeStatus('offline')
    expect(setPresenceMock).toHaveBeenLastCalledWith('offline')
  })
})
