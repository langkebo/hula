import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { OnlineEnum } from '@/enums'
import type { MatrixRoomMember } from '@/stores/domains/chat/group'
import RoomMembersPane from '../RoomMembersPane.vue'

const { showFeedbackMock, inviteUserMock, kickUserMock, banUserMock, unbanUserMock, loadRoomMembersMock } = vi.hoisted(
  () => ({
    showFeedbackMock: vi.fn(),
    inviteUserMock: vi.fn(async () => true),
    kickUserMock: vi.fn(async () => true),
    banUserMock: vi.fn(async () => true),
    unbanUserMock: vi.fn(async () => true),
    loadRoomMembersMock: vi.fn(async () => undefined)
  })
)

const OFFLINE = OnlineEnum.OFFLINE

const membersRef = ref<MatrixRoomMember[]>([
  {
    userId: '@alice:server',
    displayName: 'Alice',
    name: 'Alice',
    uid: '@alice:server',
    avatar: '',
    avatarUrl: null,
    membership: 'join',
    powerLevel: 0,
    isModerator: false,
    isCreator: false,
    account: 'alice',
    activeStatus: OFFLINE,
    roleId: 0,
    lastOptTime: 0
  },
  {
    userId: '@bob:server',
    displayName: 'Bob',
    name: 'Bob',
    uid: '@bob:server',
    avatar: '',
    avatarUrl: null,
    membership: 'join',
    powerLevel: 50,
    isModerator: true,
    isCreator: false,
    account: 'bob',
    activeStatus: OFFLINE,
    roleId: 0,
    lastOptTime: 0
  }
])

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => {
    const store = {
      inviteUser: inviteUserMock,
      kickUser: kickUserMock,
      banUser: banUserMock,
      unbanUser: unbanUserMock,
      loadRoomMembers: loadRoomMembersMock,
      getMembersByRoomId: vi.fn(() => membersRef.value)
    }
    Object.defineProperty(store, 'userList', {
      get: () => membersRef.value,
      enumerable: true,
      configurable: true
    })
    return store
  }
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (url: string) => url || ''
  }
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: false
}))

describe('RoomMembersPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    membersRef.value = [
      {
        userId: '@alice:server',
        displayName: 'Alice',
        name: 'Alice',
        uid: '@alice:server',
        avatar: '',
        avatarUrl: null,
        membership: 'join',
        powerLevel: 0,
        isModerator: false,
        isCreator: false,
        account: 'alice',
        activeStatus: OFFLINE,
        roleId: 0,
        lastOptTime: 0
      },
      {
        userId: '@bob:server',
        displayName: 'Bob',
        name: 'Bob',
        uid: '@bob:server',
        avatar: '',
        avatarUrl: null,
        membership: 'join',
        powerLevel: 50,
        isModerator: true,
        isCreator: false,
        account: 'bob',
        activeStatus: OFFLINE,
        roleId: 0,
        lastOptTime: 0
      }
    ]
    inviteUserMock.mockResolvedValue(true)
    kickUserMock.mockResolvedValue(true)
    banUserMock.mockResolvedValue(true)
    unbanUserMock.mockResolvedValue(true)
    ;(globalThis.window as unknown as { $dialog: unknown }).$dialog = {
      create: vi.fn(({ onPositiveClick }: { onPositiveClick?: () => Promise<void> | void }) => {
        if (onPositiveClick) void onPositiveClick()
      }),
      warning: vi.fn(({ onPositiveClick }: { onPositiveClick?: () => Promise<void> | void }) => {
        if (onPositiveClick) void onPositiveClick()
      })
    }
  })

  it('renders member list from groupStore.userList', () => {
    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: false }
    })

    // 应渲染所有成员
    const memberItems = wrapper.findAll('[data-test="member-item"]')
    expect(memberItems.length).toBe(2)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
  })

  it('hides invite form when canManage=false', () => {
    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: false }
    })

    expect(wrapper.find('[data-test="invite-form"]').exists()).toBe(false)
  })

  it('shows invite form when canManage=true', () => {
    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: true }
    })

    expect(wrapper.find('[data-test="invite-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="invite-input"]').exists()).toBe(true)
  })

  it('hides management buttons when canManage=false', () => {
    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: false }
    })

    expect(wrapper.find('[data-test="kick-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="ban-btn"]').exists()).toBe(false)
  })

  it('shows kick/ban buttons for joined members when canManage=true', () => {
    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: true }
    })

    const kickBtns = wrapper.findAll('[data-test="kick-btn"]')
    const banBtns = wrapper.findAll('[data-test="ban-btn"]')
    // 每个非创建者的成员都应有踢出/封禁按钮（创建者不能被踢出/封禁）
    expect(kickBtns.length).toBeGreaterThan(0)
    expect(banBtns.length).toBeGreaterThan(0)
  })

  it('does not show kick/ban buttons for creator', () => {
    membersRef.value = [
      {
        userId: '@creator:server',
        displayName: 'Creator',
        name: 'Creator',
        uid: '@creator:server',
        avatar: '',
        avatarUrl: null,
        membership: 'join',
        powerLevel: 100,
        isModerator: false,
        isCreator: true,
        account: 'creator',
        activeStatus: OFFLINE,
        roleId: 0,
        lastOptTime: 0
      },
      {
        userId: '@alice:server',
        displayName: 'Alice',
        name: 'Alice',
        uid: '@alice:server',
        avatar: '',
        avatarUrl: null,
        membership: 'join',
        powerLevel: 0,
        isModerator: false,
        isCreator: false,
        account: 'alice',
        activeStatus: OFFLINE,
        roleId: 0,
        lastOptTime: 0
      }
    ]

    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: true }
    })

    const memberItems = wrapper.findAll('[data-test="member-item"]')
    // 创建者项不应有踢出/封禁按钮
    const creatorItem = memberItems[0]
    expect(creatorItem.find('[data-test="kick-btn"]').exists()).toBe(false)
    expect(creatorItem.find('[data-test="ban-btn"]').exists()).toBe(false)
    // 普通成员项应有踢出/封禁按钮
    const aliceItem = memberItems[1]
    expect(aliceItem.find('[data-test="kick-btn"]').exists()).toBe(true)
    expect(aliceItem.find('[data-test="ban-btn"]').exists()).toBe(true)
  })

  it('shows warning when inviting with empty userId', async () => {
    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: true }
    })

    const vm = wrapper.vm as unknown as { handleInvite: () => Promise<void> }
    await vm.handleInvite()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.detail.invite_user_required', 'warning')
    expect(inviteUserMock).not.toHaveBeenCalled()
  })

  it('calls groupStore.inviteUser when submitting invite form', async () => {
    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: true }
    })

    const vm = wrapper.vm as unknown as {
      inviteUserId: string
      handleInvite: () => Promise<void>
    }
    vm.inviteUserId = '@newuser:server'
    await vm.handleInvite()

    expect(inviteUserMock).toHaveBeenCalledWith('!room-1:server', '@newuser:server')
    expect(showFeedbackMock).toHaveBeenCalledWith('room.detail.invite_success', 'success')
    // 成功后清空输入
    expect(vm.inviteUserId).toBe('')
  })

  it('shows error feedback when invite fails', async () => {
    inviteUserMock.mockResolvedValueOnce(false)
    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: true }
    })

    const vm = wrapper.vm as unknown as {
      inviteUserId: string
      handleInvite: () => Promise<void>
    }
    vm.inviteUserId = '@newuser:server'
    await vm.handleInvite()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.detail.invite_failed', 'error')
  })

  it('kicks member with confirm dialog', async () => {
    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: true }
    })

    const vm = wrapper.vm as unknown as { handleKick: (userId: string) => Promise<void> }
    kickUserMock.mockClear()
    await vm.handleKick('@alice:server')
    await flushPromises()

    expect(kickUserMock).toHaveBeenCalledWith('!room-1:server', '@alice:server')
    expect(showFeedbackMock).toHaveBeenCalledWith('room.detail.kick_success', 'success')
  })

  it('bans member with confirm dialog', async () => {
    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: true }
    })

    const vm = wrapper.vm as unknown as { handleBan: (userId: string) => Promise<void> }
    banUserMock.mockClear()
    await vm.handleBan('@alice:server')
    await flushPromises()

    expect(banUserMock).toHaveBeenCalledWith('!room-1:server', '@alice:server')
    expect(showFeedbackMock).toHaveBeenCalledWith('room.detail.ban_success', 'success')
  })

  it('unbans member directly without confirm dialog', async () => {
    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: true }
    })

    const vm = wrapper.vm as unknown as { handleUnban: (userId: string) => Promise<void> }
    unbanUserMock.mockClear()
    await vm.handleUnban('@spammer:server')
    await flushPromises()

    expect(unbanUserMock).toHaveBeenCalledWith('!room-1:server', '@spammer:server')
    expect(showFeedbackMock).toHaveBeenCalledWith('room.detail.unban_success', 'success')
  })

  it('emits member-click when clicking a member', async () => {
    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: false }
    })

    const memberItems = wrapper.findAll('[data-test="member-item"]')
    await memberItems[0].trigger('click')

    expect(wrapper.emitted('memberClick')).toBeTruthy()
    expect(wrapper.emitted('memberClick')![0]).toEqual(['@alice:server'])
  })

  it('shows member count in header', () => {
    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: false }
    })

    expect(wrapper.find('[data-test="members-header"]').text()).toContain('2')
  })

  it('renders empty state when no members', () => {
    membersRef.value = []
    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: false }
    })

    expect(wrapper.find('[data-test="empty-members"]').exists()).toBe(true)
  })

  it('shows banned members section when banned members exist and canManage=true', () => {
    // 添加一个封禁成员到列表
    membersRef.value = [
      ...membersRef.value,
      {
        userId: '@spammer:server',
        displayName: 'Spammer',
        name: 'Spammer',
        uid: '@spammer:server',
        avatar: '',
        avatarUrl: null,
        membership: 'ban',
        powerLevel: 0,
        isModerator: false,
        isCreator: false,
        account: 'spammer',
        activeStatus: OFFLINE,
        roleId: 0,
        lastOptTime: 0
      }
    ]

    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: true }
    })

    // 封禁成员应显示解封按钮
    expect(wrapper.find('[data-test="unban-btn"]').exists()).toBe(true)
  })

  it('invite failure does not clear input', async () => {
    inviteUserMock.mockResolvedValueOnce(false)
    const wrapper = mount(RoomMembersPane, {
      props: { roomId: '!room-1:server', canManage: true }
    })

    const vm = wrapper.vm as unknown as {
      inviteUserId: string
      handleInvite: () => Promise<void>
    }
    vm.inviteUserId = '@newuser:server'
    await vm.handleInvite()

    // 失败时不清空输入，便于用户重试
    expect(vm.inviteUserId).toBe('@newuser:server')
  })
})
