import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import SpaceMembersPane from '../SpaceMembersPane.vue'

const { showFeedbackMock, loadMembersMock, inviteMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  loadMembersMock: vi.fn(async () => undefined),
  inviteMock: vi.fn(async () => true)
}))

const membersRef = ref([
  { space_id: '!space-1:server', user_id: '@alice:server', membership: 'join' },
  { space_id: '!space-1:server', user_id: '@bob:server', membership: 'join' }
])

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/composables/space/useSpaceMembers', () => ({
  useSpaceMembers: () => ({
    members: membersRef,
    loading: ref(false),
    mutating: ref(false),
    error: ref(null),
    load: loadMembersMock,
    invite: inviteMock
  })
}))

describe('SpaceMembersPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    membersRef.value = [
      { space_id: '!space-1:server', user_id: '@alice:server', membership: 'join' },
      { space_id: '!space-1:server', user_id: '@bob:server', membership: 'join' }
    ]
    inviteMock.mockResolvedValue(true)
  })

  it('loads members on mount', async () => {
    mount(SpaceMembersPane, {
      props: { spaceId: '!space-1:server' }
    })
    await flushPromises()
    expect(loadMembersMock).toHaveBeenCalled()
  })

  it('renders member list from composable', () => {
    const wrapper = mount(SpaceMembersPane, {
      props: { spaceId: '!space-1:server' }
    })
    const items = wrapper.findAll('[data-test="space-member-item"]')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('@alice:server')
    expect(wrapper.text()).toContain('@bob:server')
  })

  it('emits back when clicking back button', async () => {
    const wrapper = mount(SpaceMembersPane, {
      props: { spaceId: '!space-1:server' }
    })
    await wrapper.find('[data-test="space-members-back"]').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('emits memberClick when clicking a member', async () => {
    const wrapper = mount(SpaceMembersPane, {
      props: { spaceId: '!space-1:server' }
    })
    const items = wrapper.findAll('[data-test="space-member-item"]')
    await items[0].trigger('click')
    expect(wrapper.emitted('memberClick')).toEqual([['@alice:server']])
  })

  it('hides invite form when canManage=false', () => {
    const wrapper = mount(SpaceMembersPane, {
      props: { spaceId: '!space-1:server', canManage: false }
    })
    expect(wrapper.find('[data-test="space-invite-form"]').exists()).toBe(false)
  })

  it('shows invite form when canManage=true', () => {
    const wrapper = mount(SpaceMembersPane, {
      props: { spaceId: '!space-1:server', canManage: true }
    })
    expect(wrapper.find('[data-test="space-invite-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="space-invite-input"]').exists()).toBe(true)
  })

  it('warns when inviting with empty userId', async () => {
    const wrapper = mount(SpaceMembersPane, {
      props: { spaceId: '!space-1:server', canManage: true }
    })
    const vm = wrapper.vm as unknown as { handleInvite: () => Promise<void> }
    await vm.handleInvite()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.invite_user_required', 'warning')
    expect(inviteMock).not.toHaveBeenCalled()
  })

  it('calls invite when submitting valid userId', async () => {
    const wrapper = mount(SpaceMembersPane, {
      props: { spaceId: '!space-1:server', canManage: true }
    })
    const vm = wrapper.vm as unknown as {
      inviteUserId: string
      handleInvite: () => Promise<void>
    }
    vm.inviteUserId = '@newuser:server'
    await vm.handleInvite()
    expect(inviteMock).toHaveBeenCalledWith('@newuser:server')
    expect(showFeedbackMock).toHaveBeenCalledWith('space.invite_success', 'success')
    expect(vm.inviteUserId).toBe('')
  })

  it('shows error when invite fails', async () => {
    inviteMock.mockResolvedValueOnce(false)
    const wrapper = mount(SpaceMembersPane, {
      props: { spaceId: '!space-1:server', canManage: true }
    })
    const vm = wrapper.vm as unknown as {
      inviteUserId: string
      handleInvite: () => Promise<void>
    }
    vm.inviteUserId = '@newuser:server'
    await vm.handleInvite()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.invite_failed', 'error')
    // 失败时保留输入以便重试
    expect(vm.inviteUserId).toBe('@newuser:server')
  })

  it('shows empty state when no members', () => {
    membersRef.value = []
    const wrapper = mount(SpaceMembersPane, {
      props: { spaceId: '!space-1:server' }
    })
    expect(wrapper.find('[data-test="space-members-empty"]').exists()).toBe(true)
  })

  it('shows member count in header', () => {
    const wrapper = mount(SpaceMembersPane, {
      props: { spaceId: '!space-1:server' }
    })
    expect(wrapper.find('[data-test="space-members-header"]').text()).toContain('2')
  })
})
