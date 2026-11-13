import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OnlineEnum } from '@/enums'
import StatusSettings from '../StatusSettings.vue'

const { setPresenceMock, getCurrentPresenceMock, showToastMock, routerBackMock, userStatusStoreMock, userInfo } =
  vi.hoisted(() => ({
    setPresenceMock: vi.fn(),
    getCurrentPresenceMock: vi.fn(),
    showToastMock: vi.fn(),
    routerBackMock: vi.fn(),
    userStatusStoreMock: { stateId: 'online', currentState: { title: '在线' } } as {
      stateId: string
      currentState?: { title: string }
    },
    userInfo: { uid: '@alice:matrix.test', activeStatus: 1, userStateId: '1' }
  }))

vi.mock('vant', () => ({
  showToast: (...args: unknown[]) => showToastMock(...args)
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'color'] }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ back: routerBackMock })
}))

// 唯一 presence 写入点：移动端必须经它上报，不能再自己门控或直连 SDK。
vi.mock('@/services/matrix/user/MatrixPresenceService', () => ({
  matrixPresenceService: {
    setPresence: setPresenceMock,
    getCurrentPresence: getCurrentPresenceMock
  }
}))

vi.mock('@/stores/domains/user/userStatus', () => ({
  useUserStatusStore: () => userStatusStoreMock
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo })
}))

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: {
    name: 'AutoFixHeightPage',
    template: '<div><slot name="header" /><slot name="container" /></div>',
    props: ['showFooter']
  }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: {
    name: 'HeaderBar',
    template: '<div />',
    props: ['border', 'isOfficial', 'hiddenRight', 'roomName']
  }
}))

function mountComponent() {
  return mount(StatusSettings, {
    global: {
      stubs: {
        'van-cell-group': { template: '<div><slot /></div>' },
        'van-cell': {
          template: '<div><slot name="icon" /><slot name="right-icon" /></div>',
          props: ['title', 'isLink']
        },
        'van-icon': { template: '<i />', props: ['name', 'color'] },
        'van-field': { template: '<textarea />', props: ['modelValue', 'label', 'placeholder'] },
        'van-button': { template: '<button><slot /></button>', props: ['type', 'block', 'loading'] }
      }
    }
  })
}

type StatusSettingsVm = {
  currentStatusId: string
  statusMessage: string
  handleSave: () => Promise<void>
}

describe('StatusSettings 经由唯一门控 presence 服务上报', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userStatusStoreMock.stateId = 'online'
    userStatusStoreMock.currentState = { title: '在线' }
    userInfo.activeStatus = OnlineEnum.ONLINE
    userInfo.userStateId = '1'
    getCurrentPresenceMock.mockResolvedValue({
      user_id: '@alice:matrix.test',
      presence: 'online',
      status_msg: null
    })
  })

  it('切「在线」时把 online 意图交给 presence 服务，并按生效值把本地 activeStatus 同步为离线', async () => {
    // 桌面关闭「显示在线状态」后服务返回 offline；移动端必须照此镜像本地状态
    setPresenceMock.mockResolvedValue('offline')

    const wrapper = mountComponent()
    await (wrapper.vm as unknown as StatusSettingsVm).handleSave()

    expect(setPresenceMock).toHaveBeenCalledWith('online', undefined)
    expect(userStatusStoreMock.stateId).toBe('online')
    expect(userInfo.activeStatus).toBe(OnlineEnum.OFFLINE)
  })

  it('生效值为 online 时不改写本地 activeStatus', async () => {
    setPresenceMock.mockResolvedValue('online')

    const wrapper = mountComponent()
    await (wrapper.vm as unknown as StatusSettingsVm).handleSave()

    expect(setPresenceMock).toHaveBeenCalledWith('online', undefined)
    expect(userInfo.activeStatus).toBe(OnlineEnum.ONLINE)
  })

  it('away 映射为 unavailable 且不触发本地降级', async () => {
    setPresenceMock.mockResolvedValue('unavailable')

    const wrapper = mountComponent()
    const vm = wrapper.vm as unknown as StatusSettingsVm
    vm.currentStatusId = 'away'
    await vm.handleSave()

    expect(setPresenceMock).toHaveBeenCalledWith('unavailable', undefined)
    expect(userInfo.activeStatus).toBe(OnlineEnum.ONLINE)
  })

  it('状态消息透传给 presence 服务', async () => {
    setPresenceMock.mockResolvedValue('online')

    const wrapper = mountComponent()
    const vm = wrapper.vm as unknown as StatusSettingsVm
    vm.statusMessage = '工作中'
    await vm.handleSave()

    expect(setPresenceMock).toHaveBeenCalledWith('online', '工作中')
  })

  it('进入页面回填服务端 presence 与状态文案', async () => {
    getCurrentPresenceMock.mockResolvedValue({
      user_id: '@alice:matrix.test',
      presence: 'unavailable',
      status_msg: '会议中'
    })

    const wrapper = mountComponent()
    await flushPromises()

    const vm = wrapper.vm as unknown as StatusSettingsVm
    expect(getCurrentPresenceMock).toHaveBeenCalled()
    expect(vm.statusMessage).toBe('会议中')
    // 协议只有 unavailable，本地无法区分 away/busy 时回落到「离开」
    expect(vm.currentStatusId).toBe('away')
  })

  it('unavailable 回填时沿用本地已保存的「忙碌」语义', async () => {
    userStatusStoreMock.currentState = { title: '忙碌' }
    getCurrentPresenceMock.mockResolvedValue({
      user_id: '@alice:matrix.test',
      presence: 'unavailable',
      status_msg: null
    })

    const wrapper = mountComponent()
    await flushPromises()

    expect((wrapper.vm as unknown as StatusSettingsVm).currentStatusId).toBe('busy')
  })

  it('未修改文案时不清空服务端已有状态消息', async () => {
    getCurrentPresenceMock.mockResolvedValue({
      user_id: '@alice:matrix.test',
      presence: 'online',
      status_msg: '会议中'
    })
    setPresenceMock.mockResolvedValue('online')

    const wrapper = mountComponent()
    await flushPromises()

    await (wrapper.vm as unknown as StatusSettingsVm).handleSave()

    expect(setPresenceMock).toHaveBeenCalledWith('online', undefined)
  })

  it('主动清空文案时传空串（明确清除）', async () => {
    getCurrentPresenceMock.mockResolvedValue({
      user_id: '@alice:matrix.test',
      presence: 'online',
      status_msg: '会议中'
    })
    setPresenceMock.mockResolvedValue('online')

    const wrapper = mountComponent()
    await flushPromises()
    const vm = wrapper.vm as unknown as StatusSettingsVm
    vm.statusMessage = ''
    await vm.handleSave()

    expect(setPresenceMock).toHaveBeenCalledWith('online', '')
  })

  it('界面标注 away/busy 的协议能力限制', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.text()).toContain('mobile_status.away_busy_limited')
  })
})
