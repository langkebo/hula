import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FriendGroups from '../FriendGroups.vue'

/**
 * 移动端好友分组管理（方案 4.1.2）。
 *
 * 缺口背景：服务层已具备完整的分组 API（get/create/rename/delete/add/remove），
 * 但移动端**没有任何调用方**——桌面端的分组管理在移动端完全缺失。
 */

const getFriendGroupsMock = vi.fn()
const createFriendGroupMock = vi.fn()
const renameFriendGroupMock = vi.fn()
const deleteFriendGroupMock = vi.fn()
const getFriendsInGroupMock = vi.fn()

const showToastMock = vi.fn()
const showConfirmDialogMock = vi.fn().mockResolvedValue(undefined)

vi.mock('vant', async () => {
  const { defineComponent } = await import('vue')
  const passthrough = (name: string, tag = 'div') =>
    defineComponent({ name, inheritAttrs: false, template: `<${tag} v-bind="$attrs"><slot /></${tag}>` })
  return {
    showToast: (...args: any[]) => showToastMock(...args),
    showConfirmDialog: (...args: any[]) => showConfirmDialogMock(...args),
    VanCollapse: passthrough('VanCollapse'),
    VanCollapseItem: passthrough('VanCollapseItem'),
    VanCellGroup: passthrough('VanCellGroup'),
    VanCell: passthrough('VanCell'),
    VanButton: passthrough('VanButton', 'button'),
    VanEmpty: passthrough('VanEmpty'),
    VanLoading: passthrough('VanLoading'),
    VanActionSheet: passthrough('VanActionSheet'),
    VanDialog: passthrough('VanDialog'),
    VanField: defineComponent({
      name: 'VanField',
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
    })
  }
})

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/router', () => ({ default: { push: vi.fn(), replace: vi.fn(), back: vi.fn() } }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }))

vi.mock('@/services/matrix', () => ({
  matrixFriendGroups: {
    getFriendGroups: (...a: any[]) => getFriendGroupsMock(...a),
    createFriendGroup: (...a: any[]) => createFriendGroupMock(...a),
    renameFriendGroup: (...a: any[]) => renameFriendGroupMock(...a),
    deleteFriendGroup: (...a: any[]) => deleteFriendGroupMock(...a),
    getFriendsInGroup: (...a: any[]) => getFriendsInGroupMock(...a)
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: { name: 'HeaderBar', template: '<div />', props: ['border', 'isOfficial', 'hiddenRight', 'roomName'] }
}))

interface FriendGroupsVm {
  groups: Array<{ group_id: string; name: string; member_count?: number }>
  loading: boolean
  loadFailed: boolean
  memberLoadFailed: Record<string, boolean>
  membersByGroup: Record<string, Array<{ user_id: string; displayname?: string }>>
  expandedGroups: string[]
  loadGroups: () => Promise<void>
  handleCreate: () => Promise<void>
  handleRename: () => Promise<void>
  handleDelete: (groupId: string) => Promise<void>
  newGroupName: string
  renameInput: string
  openRename: (group: { group_id: string; name: string }) => void
}

const mountPage = () => mount(FriendGroups)
const vmOf = (w: ReturnType<typeof mount>) => w.vm as unknown as FriendGroupsVm

describe('FriendGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getFriendGroupsMock.mockResolvedValue([])
    createFriendGroupMock.mockResolvedValue({ group_id: 'g1', name: '新分组' })
    renameFriendGroupMock.mockResolvedValue(undefined)
    deleteFriendGroupMock.mockResolvedValue(undefined)
    getFriendsInGroupMock.mockResolvedValue([])
  })

  it('挂载时加载分组列表', async () => {
    mountPage()
    await flushPromises()

    expect(getFriendGroupsMock).toHaveBeenCalled()
  })

  it('加载失败时提示且不崩溃', async () => {
    getFriendGroupsMock.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()

    expect(vmOf(wrapper).loading).toBe(false)
    expect(showToastMock).toHaveBeenCalled()
  })

  it('首屏读取失败时显示错误态而不是空分组', async () => {
    getFriendGroupsMock.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-test="friend-groups-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="friend-groups-empty"]').exists()).toBe(false)
  })

  it('错误态重试成功后恢复分组列表', async () => {
    getFriendGroupsMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([{ group_id: 'g1', name: '家人', member_count: 0 }])
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('[data-test="async-state-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="friend-groups-error"]').exists()).toBe(false)
    expect(vmOf(wrapper).groups).toHaveLength(1)
  })

  it('成员读取失败时显示失败提示并可原地重试', async () => {
    getFriendGroupsMock.mockResolvedValue([{ group_id: 'g1', name: '家人', member_count: 1 }])
    getFriendsInGroupMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([{ user_id: '@bob:matrix.test', displayname: 'Bob' }])
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    vm.expandedGroups = ['g1']
    await flushPromises()

    expect(vm.memberLoadFailed.g1).toBe(true)
    expect(wrapper.find('[title="mobile_friend_groups.members_load_failed"]').exists()).toBe(true)
    expect(wrapper.find('[title="mobile_friend_groups.no_member"]').exists()).toBe(false)

    const retryButton = wrapper.findAll('van-button').find((button) => button.text() === 'common.retry')
    expect(retryButton).toBeTruthy()
    await retryButton!.trigger('click')
    await flushPromises()

    expect(vm.memberLoadFailed.g1).toBeUndefined()
    expect(vm.membersByGroup.g1).toHaveLength(1)
    expect(wrapper.find('[title="mobile_friend_groups.members_load_failed"]').exists()).toBe(false)
  })

  it('创建分组：空名拒绝，合法名调用服务并刷新', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    vm.newGroupName = '   '
    await vm.handleCreate()
    expect(createFriendGroupMock).not.toHaveBeenCalled()

    vm.newGroupName = '家人'
    await vm.handleCreate()
    expect(createFriendGroupMock).toHaveBeenCalledWith('家人')
    expect(vm.newGroupName).toBe('')
  })

  it('创建分组：首尾空格被裁剪', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    vm.newGroupName = '  同事  '
    await vm.handleCreate()

    expect(createFriendGroupMock).toHaveBeenCalledWith('同事')
  })

  it('重命名分组：调用服务并刷新', async () => {
    getFriendGroupsMock
      .mockResolvedValueOnce([{ group_id: 'g1', name: '旧名' }])
      .mockResolvedValueOnce([{ group_id: 'g1', name: '新名' }])
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    vm.openRename({ group_id: 'g1', name: '旧名' })
    vm.renameInput = '新名'
    await vm.handleRename()

    expect(renameFriendGroupMock).toHaveBeenCalledWith('g1', '新名')
  })

  it('重命名：空名拒绝提交', async () => {
    getFriendGroupsMock.mockResolvedValue([{ group_id: 'g1', name: '旧名' }])
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    vm.openRename({ group_id: 'g1', name: '旧名' })
    vm.renameInput = '  '
    await vm.handleRename()

    expect(renameFriendGroupMock).not.toHaveBeenCalled()
  })

  it('删除分组：二次确认后调用服务', async () => {
    getFriendGroupsMock.mockResolvedValue([{ group_id: 'g1', name: '旧名' }])
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    await vm.handleDelete('g1')

    expect(showConfirmDialogMock).toHaveBeenCalled()
    expect(deleteFriendGroupMock).toHaveBeenCalledWith('g1')
  })

  it('删除分组：用户在确认框取消时不调用服务', async () => {
    showConfirmDialogMock.mockRejectedValueOnce('cancel')
    getFriendGroupsMock.mockResolvedValue([{ group_id: 'g1', name: '旧名' }])
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    await vm.handleDelete('g1')

    expect(deleteFriendGroupMock).not.toHaveBeenCalled()
  })

  it('删除失败时提示错误', async () => {
    deleteFriendGroupMock.mockRejectedValueOnce(new Error('nope'))
    getFriendGroupsMock.mockResolvedValue([{ group_id: 'g1', name: '旧名' }])
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    await vm.handleDelete('g1')

    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'fail', message: 'mobile_friend_groups.delete_failed' })
    )
  })
})
