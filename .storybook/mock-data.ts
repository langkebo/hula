import type { MockAnnouncement } from './mocks/announcement-store'
import type { GroupDetail, GroupMember } from './mocks/group-store'
import type { MockSpaceRoom } from './mocks/space-rooms'

export const GROUP_DETAIL_MOCKS: Record<'private', GroupDetail> = {
  private: {
    roomId: '!design:example.com',
    name: 'Design Collaboration',
    avatar: '',
    topic: 'Sync designs, announcements, and member collaboration.',
    memberCount: 12,
    memberNum: 12,
    onlineNum: 5,
    isPublic: false,
    isEncrypted: true
  }
}

export const GROUP_MEMBER_MOCKS: GroupMember[] = [
  {
    userId: '@alice:example.com',
    uid: '@alice:example.com',
    displayName: 'Alice',
    name: 'Alice',
    avatar: '',
    avatarUrl: '',
    membership: 'join',
    activeStatus: true
  },
  {
    userId: '@bob:example.com',
    uid: '@bob:example.com',
    displayName: 'Bob',
    name: 'Bob',
    avatar: '',
    avatarUrl: '',
    membership: 'join',
    activeStatus: true
  },
  {
    userId: '@carol:example.com',
    uid: '@carol:example.com',
    displayName: 'Carol',
    name: 'Carol',
    avatar: '',
    avatarUrl: '',
    membership: 'join',
    activeStatus: false
  },
  {
    userId: '@dave:example.com',
    uid: '@dave:example.com',
    displayName: 'Dave',
    name: 'Dave',
    avatar: '',
    avatarUrl: '',
    membership: 'invite',
    activeStatus: false
  },
  {
    userId: '@erin:example.com',
    uid: '@erin:example.com',
    displayName: 'Erin',
    name: 'Erin',
    avatar: '',
    avatarUrl: '',
    membership: 'join',
    activeStatus: true
  }
]

export const ANNOUNCEMENT_MOCKS: MockAnnouncement[] = [
  {
    id: 'topic',
    content: 'Pinned announcement with https://hula.example.com',
    top: true,
    author: '@alice:example.com',
    timestamp: Date.now()
  },
  {
    id: 'follow-up',
    content: 'Follow-up announcement for this week.',
    top: false,
    author: '@bob:example.com',
    timestamp: Date.now() - 60_000
  },
  {
    id: 'retro',
    content: 'Retro notes are available in the shared folder.',
    top: false,
    author: '@carol:example.com',
    timestamp: Date.now() - 120_000
  }
]

export const SPACE_ROOM_MOCKS: MockSpaceRoom[] = [
  { roomId: '!space-room-1:example.com', name: 'Design Review' },
  { roomId: '!space-room-2:example.com', name: 'Brand Updates' },
  { roomId: '!space-room-3:example.com', name: 'Prototype Collaboration' }
]
