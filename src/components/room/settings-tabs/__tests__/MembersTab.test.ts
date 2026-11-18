import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { getUserId: () => '@me:hs' }
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomActionFacade: {
    inviteUser: vi.fn(),
    kickUser: vi.fn(),
    banUser: vi.fn()
  }
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    loadRoomMembers: vi.fn().mockResolvedValue(undefined),
    getMembersByRoomId: () => [],
    getMembersLoadError: () => null
  })
}))

vi.mock('../RecentMemberChangesSection.vue', () => ({
  default: {
    name: 'RecentMemberChangesSection',
    props: { roomId: { type: String, required: true } },
    template: '<div data-testid="recent-members-stub" :data-room-id="roomId" />'
  }
}))

import MembersTab from '../MembersTab.vue'

const naiveStubs = {
  NInput: true,
  NButton: true,
  NSpin: true,
  NAvatar: true,
  NTag: true,
  NPopconfirm: true,
  EmptyState: true,
  PartialStateBanner: true
}

describe('MembersTab — 最近成员变更挂载', () => {
  it('渲染最近成员变更区块并透传 roomId', async () => {
    const wrapper = mount(MembersTab, {
      props: { roomId: '!room:hs' },
      global: { stubs: naiveStubs }
    })
    await flushPromises()

    const section = wrapper.find('[data-testid="recent-members-stub"]')
    expect(section.exists()).toBe(true)
    expect(section.attributes('data-room-id')).toBe('!room:hs')
  })

  it('既有成员列表空态不受新区块影响', async () => {
    const wrapper = mount(MembersTab, {
      props: { roomId: '!room:hs' },
      global: { stubs: naiveStubs }
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="members-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="members-row"]').exists()).toBe(false)
  })
})
