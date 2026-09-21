import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OnlineEnum } from '@/enums'
import { useSettingStore } from '@/stores/domains/settings/setting'
import UserMenuHeader from '../UserMenuHeader.vue'

const { setPresenceMock, showFeedbackMock, userInfo, userStatusStoreMock } = vi.hoisted(() => ({
  setPresenceMock: vi.fn().mockResolvedValue(undefined),
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

describe('UserMenuHeader 状态菜单尊重「显示在线状态」偏好', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    userInfo.activeStatus = OnlineEnum.ONLINE
    userStatusStoreMock.stateId = 'online'
  })

  it('关闭偏好后选择 online 降级为 offline，并把本地 activeStatus 置为离线', async () => {
    useSettingStore().setShowOnlineStatusEnabled(false)

    await changeStatus('online')

    expect(setPresenceMock).toHaveBeenCalledWith('offline')
    expect(setPresenceMock).not.toHaveBeenCalledWith('online')
    expect(userInfo.activeStatus).toBe(OnlineEnum.OFFLINE)
    expect(showFeedbackMock).toHaveBeenCalledWith('menu.user_menu.status.updated', 'success')
  })

  it('开启偏好时选择 online 照旧上报 online', async () => {
    useSettingStore().setShowOnlineStatusEnabled(true)

    await changeStatus('online')

    expect(setPresenceMock).toHaveBeenCalledWith('online')
  })

  it('关闭偏好不影响 away/busy/offline 的上报', async () => {
    useSettingStore().setShowOnlineStatusEnabled(false)

    await changeStatus('away')
    expect(setPresenceMock).toHaveBeenLastCalledWith('unavailable')

    await changeStatus('busy')
    expect(setPresenceMock).toHaveBeenLastCalledWith('unavailable')

    await changeStatus('offline')
    expect(setPresenceMock).toHaveBeenLastCalledWith('offline')
  })
})
