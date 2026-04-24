import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FriendsSettings from '../FriendsSettings.vue'

const { mockManager, messageSuccessMock, messageWarningMock, messageErrorMock } = vi.hoisted(() => ({
  mockManager: {
    getFriendGroups: vi.fn(),
    getIncomingRequests: vi.fn(),
    getOutgoingRequests: vi.fn(),
    createFriendGroup: vi.fn(),
    renameFriendGroup: vi.fn(),
    deleteFriendGroup: vi.fn(),
    acceptFriendRequest: vi.fn(),
    rejectFriendRequest: vi.fn(),
    cancelFriendRequest: vi.fn()
  },
  messageSuccessMock: vi.fn(),
  messageWarningMock: vi.fn(),
  messageErrorMock: vi.fn()
}))

vi.mock('naive-ui', () => ({
  NSwitch: { name: 'NSwitch', template: '<div class="n-switch" />', props: ['value'] },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NButton: { name: 'NButton', template: '<button><slot /></button>', props: ['size', 'type'] },
  NSpin: { name: 'NSpin', template: '<div><slot /></div>', props: ['show'] },
  NModal: { name: 'NModal', template: '<div v-if="show"><slot /></div>', props: ['show'] },
  NForm: { name: 'NForm', template: '<form><slot /></form>' },
  NFormItem: { name: 'NFormItem', template: '<div><slot /></div>', props: ['label'] },
  NInput: { name: 'NInput', template: '<input />', props: ['value', 'placeholder'] },
  useMessage: () => ({ success: messageSuccessMock, warning: messageWarningMock, error: messageErrorMock }),
  useDialog: () => ({ warning: vi.fn() })
}))

vi.mock('@/services/matrix', () => ({
  matrixFriendService: mockManager
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => ({ error: vi.fn() }))
}))

describe('FriendsSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockManager.getFriendGroups.mockResolvedValue([])
    mockManager.getIncomingRequests.mockResolvedValue([])
    mockManager.getOutgoingRequests.mockResolvedValue([])
  })

  it('renders correctly', () => {
    const wrapper = mount(FriendsSettings)
    expect(wrapper.find('.friends-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('好友请求')
    expect(wrapper.text()).toContain('好友分组')
    expect(wrapper.text()).toContain('待处理请求')
  })

  it('shows friend request toggles', () => {
    const wrapper = mount(FriendsSettings)
    expect(wrapper.text()).toContain('允许接收好友请求')
    expect(wrapper.text()).toContain('自动接受好友请求')
    expect(wrapper.text()).toContain('好友请求需要附言')
  })

  it('loads settings from localStorage', () => {
    localStorage.setItem(
      'hula-friend-settings',
      JSON.stringify({
        allowFriendRequests: false,
        autoAcceptFriends: true,
        friendRequestMessage: false
      })
    )
    const wrapper = mount(FriendsSettings)
    expect((wrapper.vm as any).allowFriendRequests).toBe(false)
    expect((wrapper.vm as any).autoAcceptFriends).toBe(true)
    expect((wrapper.vm as any).friendRequestMessage).toBe(false)
  })

  it('saves settings to localStorage', () => {
    const wrapper = mount(FriendsSettings)
    const vm = wrapper.vm as any
    vm.allowFriendRequests = false
    vm.saveSettings()
    const saved = JSON.parse(localStorage.getItem('hula-friend-settings')!)
    expect(saved.allowFriendRequests).toBe(false)
  })

  it('creates friend group', async () => {
    mockManager.createFriendGroup.mockResolvedValue({ group_id: 'g3', name: '朋友' })
    const wrapper = mount(FriendsSettings)
    const vm = wrapper.vm as any
    vm.newGroupName = '朋友'
    await vm.handleCreateGroup()
    expect(mockManager.createFriendGroup).toHaveBeenCalledWith('朋友')
    expect(messageSuccessMock).toHaveBeenCalledWith('分组创建成功')
  })

  it('validates group name on create', async () => {
    const wrapper = mount(FriendsSettings)
    const vm = wrapper.vm as any
    vm.newGroupName = ''
    const result = await vm.handleCreateGroup()
    expect(result).toBe(false)
    expect(messageWarningMock).toHaveBeenCalledWith('请输入分组名称')
  })

  it('accepts friend request', async () => {
    mockManager.acceptFriendRequest.mockResolvedValue({})
    const wrapper = mount(FriendsSettings)
    const vm = wrapper.vm as any
    await vm.handleAcceptRequest({ user_id: '@alice:example.com' })
    expect(mockManager.acceptFriendRequest).toHaveBeenCalledWith('@alice:example.com')
    expect(messageSuccessMock).toHaveBeenCalledWith('已接受好友请求')
  })

  it('rejects friend request', async () => {
    mockManager.rejectFriendRequest.mockResolvedValue({})
    const wrapper = mount(FriendsSettings)
    const vm = wrapper.vm as any
    await vm.handleRejectRequest({ user_id: '@bob:example.com' })
    expect(mockManager.rejectFriendRequest).toHaveBeenCalledWith('@bob:example.com')
    expect(messageSuccessMock).toHaveBeenCalledWith('已拒绝好友请求')
  })

  it('handles service errors gracefully', async () => {
    mockManager.createFriendGroup.mockRejectedValue(new Error('network error'))
    const wrapper = mount(FriendsSettings)
    const vm = wrapper.vm as any
    vm.newGroupName = 'test'
    await vm.handleCreateGroup()
    expect(messageErrorMock).toHaveBeenCalledWith('创建分组失败')
  })
})
