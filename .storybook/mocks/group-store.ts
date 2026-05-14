import { ref } from 'vue'

export type GroupDetail = {
  roomId?: string
  name?: string
  avatar?: string
  topic?: string
  memberCount?: number
  memberNum?: number
  onlineNum?: number
  isPublic?: boolean
  isEncrypted?: boolean
}

export type GroupMember = {
  userId: string
  uid?: string
  displayName?: string
  name?: string
  avatar?: string
  avatarUrl?: string
  powerLevel?: number
  membership?: string
  activeStatus?: boolean
  account?: string
  roleId?: number
  myName?: string
  locPlace?: string
  userStateId?: string
  wearingItemId?: string
  itemIds?: string[]
  lastOptTime?: number
}

type GroupStoreMock = {
  getGroupDetailByRoomId: (roomId: string) => GroupDetail | null
  getMembersByRoomId: (roomId: string) => GroupMember[]
  loadGroupInfo: (roomId: string) => Promise<GroupDetail | null>
  loadRoomMembers: (roomId: string, force?: boolean) => Promise<GroupMember[]>
  userList: GroupMember[]
  userListOptions: {
    isLast: boolean
    loading: boolean
    cursor: string
  }
  countInfo: GroupDetail | null
  onlineCountMap: Record<string, number>
  updateUserItem: (uid: string, updates: Partial<GroupMember>) => boolean
  updateMemberCache: (roomId: string, members: GroupMember[]) => void
  cleanupSession: () => void
  loadMoreGroupMembers: () => Promise<void>
}

const detailState = ref<GroupDetail | null>(null)
const membersState = ref<GroupMember[]>([])
const memberCacheState = ref<Record<string, GroupMember[]>>({})

const cloneDetail = () => (detailState.value ? { ...detailState.value } : null)
const cloneMembers = () => membersState.value.map((member) => ({ ...member }))

export const resetGroupStoreMock = () => {
  detailState.value = null
  membersState.value = []
  memberCacheState.value = {}
  groupStoreMock.userList = []
  groupStoreMock.countInfo = null
  groupStoreMock.onlineCountMap = {}
  groupStoreMock.userListOptions.cursor = ''
  groupStoreMock.userListOptions.isLast = false
  groupStoreMock.userListOptions.loading = false
}

export const configureGroupStoreMock = (options: {
  detail?: GroupDetail | null
  members?: GroupMember[]
}) => {
  detailState.value = options.detail ? { ...options.detail } : null
  membersState.value = options.members ? options.members.map((member) => ({ ...member })) : []
  groupStoreMock.userList = cloneMembers()
  groupStoreMock.countInfo = cloneDetail()
  if (groupStoreMock.countInfo?.roomId) {
    groupStoreMock.onlineCountMap = {
      [groupStoreMock.countInfo.roomId]:
        groupStoreMock.countInfo.onlineNum ??
        membersState.value.filter((member) => Boolean(member.activeStatus)).length
    }
  } else {
    groupStoreMock.onlineCountMap = {}
  }
}

export const groupStoreMock: GroupStoreMock = {
  userList: [],
  userListOptions: {
    isLast: false,
    loading: false,
    cursor: ''
  },
  countInfo: null,
  onlineCountMap: {},
  getGroupDetailByRoomId() {
    return cloneDetail()
  },
  getMembersByRoomId() {
    return cloneMembers()
  },
  async loadGroupInfo() {
    return cloneDetail()
  },
  async loadRoomMembers() {
    return cloneMembers()
  },
  updateUserItem(uid, updates) {
    const index = membersState.value.findIndex((member) => member.uid === uid || member.userId === uid)
    if (index < 0) return false
    membersState.value[index] = {
      ...membersState.value[index],
      ...updates
    }
    groupStoreMock.userList = cloneMembers()
    return true
  },
  updateMemberCache(roomId, members) {
    memberCacheState.value = {
      ...memberCacheState.value,
      [roomId]: members.map((member) => ({ ...member }))
    }
  },
  cleanupSession() {
    groupStoreMock.userListOptions.cursor = ''
    groupStoreMock.userListOptions.isLast = false
    groupStoreMock.userListOptions.loading = false
  },
  async loadMoreGroupMembers() {
    groupStoreMock.userListOptions.isLast = true
  }
}

export const useGroupStore = () => groupStoreMock
