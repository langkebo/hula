import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { RoomCardModel } from '@/mobile/views/rooms/roomListModel'
import MobileRoomCard from '../MobileRoomCard.vue'

const baseItem: RoomCardModel = {
  roomId: '!room:matrix.test',
  name: '产品讨论组',
  avatarUrl: '',
  memberCount: 8,
  joinRule: 'invite',
  isEncrypted: false,
  creatorId: '@alice:matrix.test',
  memberNames: ['Alice', 'Bob'],
  isPublic: false,
  isOwned: false,
  unreadCount: 3,
  summary: '最后一条消息',
  activeTime: new Date(2026, 10, 13, 8, 7).getTime()
}

const mountCard = (item: Partial<RoomCardModel> = {}) =>
  mount(MobileRoomCard, {
    props: {
      item: { ...baseItem, ...item },
      summaryText: item.summary ?? baseItem.summary,
      timeLabel: '08:07',
      membersLabel: '人',
      encryptedLabel: '已加密'
    },
    global: {
      stubs: {
        'van-badge': {
          props: ['content', 'max'],
          template: '<span class="stub-badge" :data-content="content"><slot /></span>'
        }
      }
    }
  })

describe('MobileRoomCard', () => {
  it('展示未读角标，超过 99 显示 99+', async () => {
    const wrapper = mountCard({ unreadCount: 120 })

    expect(wrapper.find('.stub-badge').attributes('data-content')).toBe('99+')

    await wrapper.setProps({ item: { ...baseItem, unreadCount: 0 } })
    expect(wrapper.find('.stub-badge').attributes('data-content')).toBe('')
  })

  it('单行展示最后消息摘要', () => {
    const wrapper = mountCard()

    const summary = wrapper.find('[data-testid="room-summary"]')
    expect(summary.text()).toBe('最后一条消息')
    expect(summary.classes()).toContain('truncate')
  })

  it('展示相对活跃时间标签', () => {
    const wrapper = mountCard()

    expect(wrapper.find('[data-testid="room-active-time"]').text()).toBe('08:07')
  })

  it('点击卡片向父级抛出 click 事件', async () => {
    const wrapper = mountCard()

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
