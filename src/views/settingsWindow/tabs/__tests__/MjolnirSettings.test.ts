import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  registerAdminApiAvailabilityResolver,
  registerCapabilityStoreResolver
} from '@/services/matrix/MatrixCapabilityService'
import { useCapabilityStore } from '@/stores/domains/chat/capability'
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
  'setting.mjolnir.added_server_rule': '已添加服务器屏蔽规则',
  'common.load_failed': '加载失败',
  'setting.mjolnir.storage_corrupted': '本地屏蔽规则读取失败，为避免覆盖已损坏的数据，操作区已暂停。',
  'setting.mjolnir.reset_storage': '重置本地规则'
}

vi.mock('naive-ui', () => ({
  NButton: { name: 'NButton', template: '<button><slot /></button>', props: ['size', 'type'] },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NSpin: { name: 'NSpin', template: '<div><slot /></div>', props: ['show'] },
  NModal: { name: 'NModal', template: '<div v-if="show"><slot /></div>', props: ['show'] },
  NDrawer: { name: 'NDrawer', template: '<div><slot /></div>', props: ['show'] },
  NDrawerContent: {
    name: 'NDrawerContent',
    template: '<div><slot /><slot name="footer" /></div>',
    props: ['title']
  },
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

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { getClient: vi.fn(() => null) }
}))

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: { getCapabilities: vi.fn().mockResolvedValue({}) }
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
  let adminApiAvailable = true

  beforeEach(() => {
    setActivePinia(createPinia())
    adminApiAvailable = true
    registerCapabilityStoreResolver(() => useCapabilityStore())
    registerAdminApiAvailabilityResolver(() => adminApiAvailable)
    useCapabilityStore().setCapabilities({ capabilities: { 'io.hula.admin': { enabled: true } } })
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
      'tjg-mjolnir-ban-lists',
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

  it('does not pretend there are no bans when local data is corrupted', async () => {
    localStorage.setItem('tjg-mjolnir-ban-lists', '{broken json')

    const wrapper = mount(MjolnirSettings)
    await nextTick()

    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.text()).not.toContain('暂无房间屏蔽规则')
    expect(wrapper.text()).not.toContain('暂无用户屏蔽规则')
    expect(wrapper.text()).not.toContain('暂无服务器屏蔽规则')
    expect(wrapper.find('[data-testid="error-retry"]').exists()).toBe(true)
  })

  it('resets corrupted local data only after explicit confirmation', async () => {
    const corrupted = JSON.stringify({ rooms: 'not-an-array', users: [], servers: [] })
    localStorage.setItem('tjg-mjolnir-ban-lists', corrupted)

    const wrapper = mount(MjolnirSettings)
    await nextTick()
    await wrapper.find('[data-testid="error-retry"]').trigger('click')

    // 显式重置后才可编辑：损坏数据被清掉，列表回到真实的空态
    expect(localStorage.getItem('tjg-mjolnir-ban-lists')).toBeNull()
    expect(wrapper.text()).toContain('暂无房间屏蔽规则')
  })

  it('saves ban lists to localStorage', () => {
    const wrapper = mount(MjolnirSettings)
    const vm = wrapper.vm as any
    vm.roomBanList = [{ entity: '#room:example.com', reason: 'spam', type: 'room_id' as const }]
    vm.saveBanLists()
    const saved = JSON.parse(localStorage.getItem('tjg-mjolnir-ban-lists')!)
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

  it('does not render the ban operation area when admin-api is unavailable', () => {
    adminApiAvailable = false
    const wrapper = mount(MjolnirSettings)

    expect(wrapper.find('.mjolnir-settings').exists()).toBe(true)
    expect(wrapper.find('.settings-section').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('房间屏蔽列表')
  })
})
