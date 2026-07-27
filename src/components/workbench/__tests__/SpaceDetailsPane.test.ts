import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { SpaceChildRoom } from '@/composables/space/useSpaceRooms'
import type { SpaceMember } from '@/services/matrix/room/MatrixSpaceService'
import SpaceDetailsPane from '../SpaceDetailsPane.vue'
import type { SpaceListItem } from '../SpaceListPane.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent } = await import('vue')
  return {
    NAvatar: defineComponent({ name: 'NAvatar', template: '<div class="n-avatar"><slot /></div>' }),
    NButton: defineComponent({
      name: 'NButton',
      props: ['type', 'size', 'loading', 'block', 'secondary'],
      template: '<button type="button"><slot /><slot name="icon" /></button>'
    }),
    NCheckbox: defineComponent({
      name: 'NCheckbox',
      props: ['checked'],
      emits: ['update:checked'],
      template:
        '<input type="checkbox" :checked="checked" @change="$emit(\'update:checked\', $event.target.checked)" />'
    }),
    NEmpty: defineComponent({
      name: 'NEmpty',
      props: ['description', 'size'],
      template: '<div class="n-empty"><slot name="icon" /><slot name="extra" />{{ description }}</div>'
    }),
    NFlex: defineComponent({ name: 'NFlex', template: '<div class="n-flex"><slot /></div>' }),
    NForm: defineComponent({ name: 'NForm', template: '<form><slot /></form>' }),
    NFormItem: defineComponent({
      name: 'NFormItem',
      props: ['label'],
      template: '<div class="n-form-item"><label>{{ label }}</label><slot /></div>'
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: ['value', 'placeholder', 'type', 'rows'],
      emits: ['update:value'],
      template:
        '<input :value="value" :placeholder="placeholder" @input="$emit(\'update:value\', $event.target.value)" />'
    }),
    NSpin: defineComponent({ name: 'NSpin', template: '<div class="n-spin" />' }),
    NTooltip: defineComponent({
      name: 'NTooltip',
      template: '<div class="n-tooltip"><slot name="trigger" /><slot /></div>'
    })
  }
})

const baseSpace: SpaceListItem = {
  spaceId: '!space-1:server',
  name: 'Design Team',
  topic: 'Design collaboration space',
  childCount: 5,
  memberCount: 12,
  avatarUrl: undefined,
  isPinned: false,
  isPublic: false
}

const baseMembers: SpaceMember[] = [
  { space_id: '!space-1:server', user_id: '@alice:server', membership: 'join' },
  { space_id: '!space-1:server', user_id: '@bob:server', membership: 'join' }
]

const baseRooms: SpaceChildRoom[] = [
  { roomId: '!room-1:server', name: 'General', avatarUrl: undefined },
  { roomId: '!room-2:server', name: 'Random', avatarUrl: undefined }
]

describe('SpaceDetailsPane', () => {
  it('renders empty state when activeSpace is null', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: null,
        members: [],
        rooms: []
      }
    })

    expect(wrapper.find('[data-test="space-overview"]').exists()).toBe(false)
    expect(wrapper.find('.space-details-pane__empty').exists()).toBe(true)
    expect(wrapper.text()).toContain('space.details_empty_description')
  })

  it('renders space overview with name and topic', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: []
      }
    })

    expect(wrapper.find('[data-test="space-overview"]').exists()).toBe(true)
    expect(wrapper.find('.space-details-pane__name').text()).toBe('Design Team')
    expect(wrapper.find('.space-details-pane__topic').text()).toBe('Design collaboration space')
    expect(wrapper.find('.space-details-pane__avatar-fallback').exists()).toBe(true)
    expect(wrapper.find('.space-details-pane__avatar-fallback').text()).toBe('DE')
  })

  it('renders empty topic placeholder when topic is missing', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: { ...baseSpace, topic: undefined },
        members: [],
        rooms: []
      }
    })

    expect(wrapper.find('.space-details-pane__topic--empty').exists()).toBe(true)
    expect(wrapper.text()).toContain('space.detail_space_topic_empty')
  })

  it('renders InlineEdit for name and topic when canManage is true', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: [],
        canManage: true
      }
    })

    // canManage 时不再渲染静态 name/topic，而是渲染 InlineEdit 组件
    expect(wrapper.find('.space-details-pane__name').exists()).toBe(false)
    expect(wrapper.find('.space-details-pane__topic').exists()).toBe(false)
    expect(wrapper.find('.space-details-pane__name-edit').exists()).toBe(true)
    expect(wrapper.find('.space-details-pane__topic-edit').exists()).toBe(true)
    // InlineEdit 查看态展示编辑按钮
    expect(wrapper.findAll('.inline-edit__toggle').length).toBeGreaterThanOrEqual(2)
  })

  it('emits saveSpaceName when InlineEdit for name submits', async () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: [],
        canManage: true
      }
    })

    // 点击 name InlineEdit 的编辑按钮进入编辑态
    const nameEdit = wrapper.find('.space-details-pane__name-edit')
    const toggleBtn = nameEdit.find('.inline-edit__toggle')
    await toggleBtn.trigger('click')

    // 修改输入值并提交
    const input = nameEdit.find('.inline-edit__input')
    await input.setValue('New Space Name')
    const confirmBtn = nameEdit.find('.inline-edit__confirm')
    await confirmBtn.trigger('click')

    expect(wrapper.emitted('saveSpaceName')).toEqual([['New Space Name']])
  })

  it('emits saveSpaceTopic when InlineEdit for topic submits', async () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: [],
        canManage: true
      }
    })

    const topicEdit = wrapper.find('.space-details-pane__topic-edit')
    const toggleBtn = topicEdit.find('.inline-edit__toggle')
    await toggleBtn.trigger('click')

    // topic 使用 textarea
    const textarea = topicEdit.find('textarea')
    await textarea.setValue('Updated topic content')
    const confirmBtn = topicEdit.find('.inline-edit__confirm')
    await confirmBtn.trigger('click')

    expect(wrapper.emitted('saveSpaceTopic')).toEqual([['Updated topic content']])
  })

  it('renders avatar image when avatarUrl is provided', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: { ...baseSpace, avatarUrl: 'mxc://example.com/avatar' },
        members: [],
        rooms: []
      }
    })

    expect(wrapper.find('.n-avatar').exists()).toBe(true)
    expect(wrapper.find('.space-details-pane__avatar-fallback').exists()).toBe(false)
  })

  it('renders member and room stats', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: []
      }
    })

    const stats = wrapper.findAll('.space-details-pane__stat')
    expect(stats).toHaveLength(2)
    expect(stats[0].text()).toContain('space.member_count_value')
    expect(stats[0].text()).toContain('"count":12')
    expect(stats[1].text()).toContain('space.room_count_value')
    expect(stats[1].text()).toContain('"count":5')
  })

  it('emits enterSpace when clicking primary action', async () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: []
      }
    })

    const actions = wrapper.findAll('[data-test="space-actions"] .space-details-pane__action')
    expect(actions.length).toBeGreaterThanOrEqual(1)

    await actions[0].trigger('click')
    expect(wrapper.emitted('enterSpace')).toHaveLength(1)
  })

  it('shows management actions only when canManage is true', () => {
    const wrapperNoManage = mount(SpaceDetailsPane, {
      props: { activeSpace: baseSpace, members: [], rooms: [], canManage: false }
    })

    expect(wrapperNoManage.findAll('[data-test="space-actions"] .space-details-pane__action')).toHaveLength(1)

    const wrapperCanManage = mount(SpaceDetailsPane, {
      props: { activeSpace: baseSpace, members: [], rooms: [], canManage: true }
    })

    // canManage 时展示 enterSpace + inviteMember + addRoom 共 3 个操作按钮
    expect(wrapperCanManage.findAll('[data-test="space-actions"] .space-details-pane__action')).toHaveLength(3)
  })

  it('emits inviteMember and addRoom when canManage actions clicked', async () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: [],
        canManage: true
      }
    })

    const actions = wrapper.findAll('[data-test="space-actions"] .space-details-pane__action')
    await actions[1].trigger('click') // inviteMember
    await actions[2].trigger('click') // addRoom

    expect(wrapper.emitted('inviteMember')).toHaveLength(1)
    expect(wrapper.emitted('addRoom')).toHaveLength(1)
  })

  it('renders manage pane when manageMode is set', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: [],
        canManage: true,
        manageMode: 'invite',
        inviteUserId: ''
      }
    })

    expect(wrapper.find('[data-test="space-manage-pane"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('space.invite_title')
  })

  it('emits update:inviteUserId and submitManagePane for invite flow', async () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: [],
        canManage: true,
        manageMode: 'invite',
        inviteUserId: ''
      }
    })

    const input = wrapper.find('.n-form-item input')
    await input.setValue('@new-user:server')
    expect(wrapper.emitted('update:inviteUserId')).toEqual([['@new-user:server']])

    const buttons = wrapper.findAll('[data-test="space-manage-pane"] button')
    const submitBtn = buttons[buttons.length - 1]
    await submitBtn.trigger('click')
    expect(wrapper.emitted('submitManagePane')).toHaveLength(1)
  })

  it('emits closeManagePane when clicking cancel button', async () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: [],
        canManage: true,
        manageMode: 'invite',
        inviteUserId: ''
      }
    })

    const buttons = wrapper.findAll('[data-test="space-manage-pane"] button')
    const cancelBtn = buttons[0]
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('closeManagePane')).toHaveLength(1)
  })

  it('renders add-room manage pane with suggested checkbox', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: [],
        canManage: true,
        manageMode: 'add-room',
        addRoomId: '',
        addRoomSuggested: false
      }
    })

    expect(wrapper.find('[data-test="space-manage-pane"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('space.add_room_title')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
  })

  it('renders members preview with view all link', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: baseMembers,
        rooms: []
      }
    })

    expect(wrapper.find('[data-test="space-members-preview"]').exists()).toBe(true)
    expect(wrapper.findAll('.space-details-pane__member')).toHaveLength(2)
    expect(wrapper.find('.space-details-pane__link-btn').text()).toBe('space.view_all_members')
  })

  it('shows loading spinner for members when membersLoading is true', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: [],
        membersLoading: true
      }
    })

    expect(wrapper.find('[data-test="space-members-preview"] .n-spin').exists()).toBe(true)
  })

  it('shows empty hint when members list is empty', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: []
      }
    })

    expect(wrapper.find('[data-test="space-members-preview"] .space-details-pane__hint').exists()).toBe(true)
    expect(wrapper.text()).toContain('space.detail_members_empty')
  })

  it('emits update:subView=members when clicking view all members link', async () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: baseMembers,
        rooms: []
      }
    })

    const link = wrapper.find('[data-test="view-all-members"]')
    await link.trigger('click')
    expect(wrapper.emitted('update:subView')).toEqual([['members']])
  })

  it('emits enterRoom when clicking a room item', async () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: baseRooms
      }
    })

    const rooms = wrapper.findAll('.space-details-pane__room')
    expect(rooms).toHaveLength(2)
    await rooms[0].trigger('click')
    expect(wrapper.emitted('enterRoom')).toEqual([['!room-1:server']])
  })

  it('renders room remove button when canManage is true', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: baseRooms,
        canManage: true
      }
    })

    // canManage 时每个房间项展示移除按钮
    const removeBtns = wrapper.findAll('.space-details-pane__room-remove')
    expect(removeBtns).toHaveLength(baseRooms.length)
    // 不展示箭头
    expect(wrapper.find('.space-details-pane__room-arrow').exists()).toBe(false)
  })

  it('renders room arrow instead of remove button when canManage is false', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: baseRooms,
        canManage: false
      }
    })

    expect(wrapper.find('.space-details-pane__room-remove').exists()).toBe(false)
    const arrows = wrapper.findAll('.space-details-pane__room-arrow')
    expect(arrows).toHaveLength(baseRooms.length)
  })

  it('emits removeRoom when clicking room remove button', async () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: baseRooms,
        canManage: true
      }
    })

    const removeBtns = wrapper.findAll('.space-details-pane__room-remove')
    await removeBtns[0].trigger('click')
    expect(wrapper.emitted('removeRoom')).toEqual([['!room-1:server']])
    // 点击移除按钮不应触发 enterRoom（stop 修饰符）
    expect(wrapper.emitted('enterRoom')).toBeUndefined()
  })

  it('emits update:subView=rooms when clicking view all rooms link', async () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: baseRooms
      }
    })

    const link = wrapper.find('[data-test="view-all-rooms"]')
    await link.trigger('click')
    expect(wrapper.emitted('update:subView')).toEqual([['rooms']])
  })

  it('emits update:subView=hierarchy when clicking view hierarchy link', async () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: []
      }
    })

    const link = wrapper.find('[data-test="view-hierarchy"]')
    await link.trigger('click')
    expect(wrapper.emitted('update:subView')).toEqual([['hierarchy']])
  })

  it('shows join space button when isMember=false', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: [],
        isMember: false
      }
    })

    const joinBtn = wrapper.find('[data-test="join-space-action"]')
    expect(joinBtn.exists()).toBe(true)
    expect(joinBtn.text()).toContain('space.join_space')
  })

  it('emits joinSpace when clicking join space button', async () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: [],
        isMember: false
      }
    })

    const joinBtn = wrapper.find('[data-test="join-space-action"]')
    await joinBtn.trigger('click')
    expect(wrapper.emitted('joinSpace')).toHaveLength(1)
  })

  it('renders danger zone with leave and delete buttons', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: [],
        canManage: true
      }
    })

    expect(wrapper.find('[data-test="space-danger-zone"]').exists()).toBe(true)
    const buttons = wrapper.findAll('[data-test="space-danger-zone"] button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].text()).toBe('space.leave_space')
    expect(buttons[1].text()).toBe('space.delete_space')
  })

  it('hides delete button when canManage is false', () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: [],
        canManage: false
      }
    })

    const buttons = wrapper.findAll('[data-test="space-danger-zone"] button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].text()).toBe('space.leave_space')
  })

  it('emits leaveSpace and deleteSpace from danger zone', async () => {
    const wrapper = mount(SpaceDetailsPane, {
      props: {
        activeSpace: baseSpace,
        members: [],
        rooms: [],
        canManage: true
      }
    })

    const buttons = wrapper.findAll('[data-test="space-danger-zone"] button')
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')

    expect(wrapper.emitted('leaveSpace')).toHaveLength(1)
    expect(wrapper.emitted('deleteSpace')).toHaveLength(1)
  })
})
