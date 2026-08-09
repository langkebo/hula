import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { OnlineEnum } from '@/enums'
import type { MatrixRoomMember } from '@/stores/domains/chat/group/types'
import RoomDetailMembers from '../RoomDetailMembers.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const baseMember = (overrides: Partial<MatrixRoomMember> = {}): MatrixRoomMember => {
  const name = overrides.name ?? 'User'
  const merged = {
    userId: '@user:server',
    avatarUrl: null,
    membership: 'join' as const,
    powerLevel: 0,
    isModerator: false,
    isCreator: false,
    name,
    uid: '@user:server',
    account: 'user',
    avatar: '',
    activeStatus: OnlineEnum.ONLINE,
    roleId: 2,
    lastOptTime: 0,
    ...overrides
  }
  // 若调用方未单独覆盖 displayName，则与 name 保持一致（与真实 store 行为一致）
  return { ...merged, displayName: overrides.displayName ?? name }
}

describe('RoomDetailMembers', () => {
  it('renders empty hint when no members', () => {
    const wrapper = mount(RoomDetailMembers, {
      props: { members: [], loading: false }
    })
    expect(wrapper.find('[data-testid="room-detail-members-empty"]').exists()).toBe(true)
  })

  it('renders loading spinner when loading', () => {
    const wrapper = mount(RoomDetailMembers, {
      props: { members: [], loading: true }
    })
    expect(wrapper.find('[data-testid="room-detail-members-loading"]').exists()).toBe(true)
  })

  it('renders up to 6 core members sorted by power level desc', () => {
    const members: MatrixRoomMember[] = [
      baseMember({ userId: '@a:1', name: 'A', powerLevel: 0, isCreator: false }),
      baseMember({ userId: '@creator:1', name: 'Creator', powerLevel: 100, isCreator: true }),
      baseMember({ userId: '@mod:1', name: 'Mod', powerLevel: 50, isModerator: true }),
      baseMember({ userId: '@b:1', name: 'B', powerLevel: 0 }),
      baseMember({ userId: '@c:1', name: 'C', powerLevel: 0 }),
      baseMember({ userId: '@d:1', name: 'D', powerLevel: 0 }),
      baseMember({ userId: '@e:1', name: 'E', powerLevel: 0 }),
      baseMember({ userId: '@f:1', name: 'F', powerLevel: 0 })
    ]
    const wrapper = mount(RoomDetailMembers, {
      props: { members, loading: false }
    })
    const items = wrapper.findAll('[data-testid="room-detail-member-item"]')
    expect(items).toHaveLength(6)
    // creator 排第一
    expect(items[0].text()).toContain('Creator')
    // mod 排第二
    expect(items[1].text()).toContain('Mod')
  })

  it('renders creator role tag for creator', () => {
    const members: MatrixRoomMember[] = [
      baseMember({ userId: '@creator:1', name: 'Creator', powerLevel: 100, isCreator: true })
    ]
    const wrapper = mount(RoomDetailMembers, {
      props: { members, loading: false }
    })
    expect(wrapper.find('[data-testid="room-detail-member-role-creator"]').exists()).toBe(true)
  })

  it('renders moderator role tag for moderator', () => {
    const members: MatrixRoomMember[] = [
      baseMember({ userId: '@mod:1', name: 'Mod', powerLevel: 50, isModerator: true })
    ]
    const wrapper = mount(RoomDetailMembers, {
      props: { members, loading: false }
    })
    expect(wrapper.find('[data-testid="room-detail-member-role-moderator"]').exists()).toBe(true)
  })

  it('renders online status dot for online member', () => {
    const members: MatrixRoomMember[] = [
      baseMember({ userId: '@online:1', name: 'Online', activeStatus: 1 }),
      baseMember({ userId: '@offline:1', name: 'Offline', activeStatus: OnlineEnum.OFFLINE })
    ]
    const wrapper = mount(RoomDetailMembers, {
      props: { members, loading: false }
    })
    const items = wrapper.findAll('[data-testid="room-detail-member-item"]')
    expect(items[0].find('[data-testid="room-detail-member-status-online"]').exists()).toBe(true)
    expect(items[1].find('[data-testid="room-detail-member-status-online"]').exists()).toBe(false)
  })

  it('renders avatar image when avatar url provided', () => {
    const members: MatrixRoomMember[] = [baseMember({ userId: '@a:1', name: 'A', avatar: 'mxc://server/avatar' })]
    const wrapper = mount(RoomDetailMembers, {
      props: { members, loading: false }
    })
    expect(wrapper.find('[data-testid="room-detail-member-avatar-img"]').exists()).toBe(true)
  })

  it('renders avatar placeholder with first character when no avatar', () => {
    const members: MatrixRoomMember[] = [baseMember({ userId: '@a:1', name: 'Alice', avatar: '' })]
    const wrapper = mount(RoomDetailMembers, {
      props: { members, loading: false }
    })
    const placeholder = wrapper.find('[data-testid="room-detail-member-avatar-placeholder"]')
    expect(placeholder.exists()).toBe(true)
    expect(placeholder.text()).toBe('A')
  })
})
