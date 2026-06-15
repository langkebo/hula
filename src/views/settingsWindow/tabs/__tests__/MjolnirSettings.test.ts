import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MjolnirSettings from '../MjolnirSettings.vue'

const messageSuccessMock = vi.fn()
const messageWarningMock = vi.fn()
const translationMap: Record<string, string> = {
  'setting.mjolnir.alert_info': 'Mjolnir 是一个 Matrix 审核机器人，用于管理房间、用户和服务器的屏蔽规则。',
  'setting.mjolnir.room_bans': '房间屏蔽列表',
  'setting.mjolnir.user_bans': '用户屏蔽列表',
  'setting.mjolnir.server_bans': '服务器屏蔽列表',
  'setting.mjolnir.no_room_bans': '暂无房间屏蔽规则',
  'setting.mjolnir.no_user_bans': '暂无用户屏蔽规则',
  'setting.mjolnir.no_server_bans': '暂无服务器屏蔽规则',
  'setting.mjolnir.enter_room_id': '请输入房间 ID',
  'setting.mjolnir.enter_user_id': '请输入用户 ID',
  'setting.mjolnir.enter_server_name': '请输入服务器名称',
  'setting.mjolnir.added_room_rule': '已添加房间屏蔽规则',
  'setting.mjolnir.added_user_rule': '已添加用户屏蔽规则',
  'setting.mjolnir.added_server_rule': '已添加服务器屏蔽规则'
}

vi.mock('naive-ui', () => ({
  NButton: { name: 'NButton', template: '<button><slot /></button>', props: ['size', 'type'] },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NSpin: { name: 'NSpin', template: '<div><slot /></div>', props: ['show'] },
  NModal: { name: 'NModal', template: '<div v-if="show"><slot /></div>', props: ['show'] },
  NForm: { name: 'NForm', template: '<form><slot /></form>' },
  NFormItem: { name: 'NFormItem', template: '<div><slot /></div>', props: ['label'] },
  NInput: { name: 'NInput', template: '<input />', props: ['value', 'placeholder'] },
  NAlert: { name: 'NAlert', template: '<div><slot /></div>', props: ['type'] },
  useMessage: () => ({ success: messageSuccessMock, warning: messageWarningMock }),
  useDialog: () => ({ warning: vi.fn() })
}))

vi.mock('@/services/matrix', () => ({
  matrixAccountService: {}
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }))
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => translationMap[key] ?? key
  })
}))

describe('MjolnirSettings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    ;(window as any).$message = { success: messageSuccessMock, warning: messageWarningMock }
    localStorage.clear()
  })

  it('renders correctly', () => {
    const wrapper = mount(MjolnirSettings)
    expect(wrapper.find('.mjolnir-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('房间屏蔽列表')
    expect(wrapper.text()).toContain('用户屏蔽列表')
    expect(wrapper.text()).toContain('服务器屏蔽列表')
  })

  it('shows empty state when no bans', () => {
    const wrapper = mount(MjolnirSettings)
    expect(wrapper.text()).toContain('暂无房间屏蔽规则')
    expect(wrapper.text()).toContain('暂无用户屏蔽规则')
    expect(wrapper.text()).toContain('暂无服务器屏蔽规则')
  })

  it('loads ban lists from localStorage', () => {
    localStorage.setItem(
      'hula-mjolnir-ban-lists',
      JSON.stringify({
        rooms: [{ entity: '#room:example.com', reason: 'spam', type: 'room_id' }],
        users: [{ entity: '@user:example.com', reason: 'abuse', type: 'user_id' }],
        servers: [{ entity: 'bad.server.com', reason: 'federation abuse', type: 'server_name' }]
      })
    )
    const wrapper = mount(MjolnirSettings)
    expect((wrapper.vm as any).roomBanList).toHaveLength(1)
    expect((wrapper.vm as any).roomBanList[0].entity).toBe('#room:example.com')
    expect((wrapper.vm as any).userBanList).toHaveLength(1)
    expect((wrapper.vm as any).serverBanList).toHaveLength(1)
  })

  it('saves ban lists to localStorage', () => {
    const wrapper = mount(MjolnirSettings)
    const vm = wrapper.vm as any
    vm.roomBanList = [{ entity: '#room:example.com', reason: 'spam', type: 'room_id' as const }]
    vm.saveBanLists()
    const saved = JSON.parse(localStorage.getItem('hula-mjolnir-ban-lists')!)
    expect(saved.rooms).toHaveLength(1)
  })

  it('adds room ban with validation', () => {
    const wrapper = mount(MjolnirSettings)
    const vm = wrapper.vm as any
    vm.newRoomBan = { entity: '', reason: '' }
    const result = (wrapper.vm as any).handleAddRoomBan()
    expect(result).toBe(false)
    expect(messageWarningMock).toHaveBeenCalledWith('请输入房间 ID')
  })

  it('adds user ban with validation', () => {
    const wrapper = mount(MjolnirSettings)
    const vm = wrapper.vm as any
    vm.newUserBan = { entity: '', reason: '' }
    const result = (wrapper.vm as any).handleAddUserBan()
    expect(result).toBe(false)
    expect(messageWarningMock).toHaveBeenCalledWith('请输入用户 ID')
  })

  it('adds server ban with validation', () => {
    const wrapper = mount(MjolnirSettings)
    const vm = wrapper.vm as any
    vm.newServerBan = { entity: '', reason: '' }
    const result = (wrapper.vm as any).handleAddServerBan()
    expect(result).toBe(false)
    expect(messageWarningMock).toHaveBeenCalledWith('请输入服务器名称')
  })

  it('successfully adds room ban', () => {
    const wrapper = mount(MjolnirSettings)
    const vm = wrapper.vm as any
    vm.newRoomBan.entity = '#spam:example.com'
    vm.newRoomBan.reason = 'spam room'
    vm.handleAddRoomBan()
    expect((wrapper.vm as any).roomBanList).toHaveLength(1)
    expect((wrapper.vm as any).roomBanList[0].entity).toBe('#spam:example.com')
    expect(messageSuccessMock).toHaveBeenCalledWith('已添加房间屏蔽规则')
  })

  it('successfully adds user ban', () => {
    const wrapper = mount(MjolnirSettings)
    const vm = wrapper.vm as any
    vm.newUserBan.entity = '@abuser:example.com'
    vm.newUserBan.reason = 'harassment'
    vm.handleAddUserBan()
    expect((wrapper.vm as any).userBanList).toHaveLength(1)
    expect(messageSuccessMock).toHaveBeenCalledWith('已添加用户屏蔽规则')
  })

  it('successfully adds server ban', () => {
    const wrapper = mount(MjolnirSettings)
    const vm = wrapper.vm as any
    vm.newServerBan.entity = 'bad.server.com'
    vm.newServerBan.reason = 'federation abuse'
    vm.handleAddServerBan()
    expect((wrapper.vm as any).serverBanList).toHaveLength(1)
    expect(messageSuccessMock).toHaveBeenCalledWith('已添加服务器屏蔽规则')
  })
})
