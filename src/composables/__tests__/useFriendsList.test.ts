import { describe, expect, it, vi } from 'vitest'
import { OnlineEnum } from '@/enums'

vi.mock('pinia', () => ({
  storeToRefs: (store: { stateList: unknown }) => ({ stateList: store.stateList })
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => ({
    contactsList: [
      { uid: 'u1', activeStatus: 1, lastOptTime: 0 },
      { uid: 'u2', activeStatus: 0, lastOptTime: 0 },
      { uid: 'u3', activeStatus: 0, lastOptTime: 30 }
    ],
    favoriteContacts: [{ uid: 'u1', activeStatus: 1, lastOptTime: 0 }],
    blockedContacts: [{ uid: 'u3', activeStatus: 0, lastOptTime: 30 }]
  })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    groupDetails: [
      { roomId: '2', groupName: 'Two' },
      { roomId: '1', groupName: 'Top' }
    ],
    getUserInfo: (uid: string) => {
      if (uid === 'u2') return { account: 'BOT', userStateId: '2' }
      if (uid === 'u1') return { account: 'USER', userStateId: '1' }
      return { account: 'USER', userStateId: '3' }
    }
  })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    unReadMark: {
      newFriendUnreadCount: 2,
      newGroupUnreadCount: 3
    }
  })
}))

vi.mock('@/stores/domains/user/userStatus', () => ({
  useUserStatusStore: () => ({
    stateList: {
      value: [
        { id: '2', title: 'busy', url: '/busy.png' },
        { id: '3', title: 'leave', url: '/leave.png' }
      ]
    }
  })
}))

const {
  buildNormalContacts,
  sortBlockedContactsByTime,
  sortContactsByOnlineStatus,
  sortGroupChatList,
  useFriendsList
} = await import('../useFriendsList')

describe('useFriendsList helpers', () => {
  it('sorts group chats and contact lists in shared order', () => {
    expect(sortGroupChatList([{ roomId: '2' }, { roomId: '1' }]).map((item) => item.roomId)).toEqual(['1', '2'])
    expect(
      sortContactsByOnlineStatus([{ activeStatus: OnlineEnum.OFFLINE }, { activeStatus: OnlineEnum.ONLINE }]).map(
        (item) => item.activeStatus
      )
    ).toEqual([OnlineEnum.ONLINE, OnlineEnum.OFFLINE])
    expect(sortBlockedContactsByTime([{ lastOptTime: 1 }, { lastOptTime: 3 }]).map((item) => item.lastOptTime)).toEqual(
      [3, 1]
    )
  })

  it('builds normal contacts excluding favorite and blocked entries', () => {
    const contacts = [
      { uid: 'u1', activeStatus: 1, lastOptTime: 0 },
      { uid: 'u2', activeStatus: 0, lastOptTime: 0 },
      { uid: 'u3', activeStatus: 0, lastOptTime: 30 }
    ]

    const result = buildNormalContacts(
      contacts as never[],
      [{ uid: 'u1', activeStatus: 1, lastOptTime: 0 }] as never[],
      [{ uid: 'u3', activeStatus: 0, lastOptTime: 30 }] as never[],
      (uid) => uid === 'u2'
    )

    expect(result.map((item) => item.uid)).toEqual(['u2'])
  })

  it('exposes shared derived state and selected item helpers', () => {
    const state = useFriendsList()

    expect(state.groupChatList.value.map((item) => item.roomId)).toEqual(['1', '2'])
    expect(state.specialOnlineCount.value).toBe(1)
    expect(state.normalContacts.value.map((item) => item.uid)).toEqual(['u2'])
    expect(state.normalOnlineCount.value).toBe(0)
    expect(state.contactUnreadCount.value).toBe(5)
    expect(state.getUserState('u2')).toEqual({ id: '2', title: 'busy', url: '/busy.png' })

    state.setSelectedItem('u2')
    expect(state.isSelected('u2')).toBe(true)
    state.clearSelectedItem()
    expect(state.selectedItem.value).toBe('')
  })
})
