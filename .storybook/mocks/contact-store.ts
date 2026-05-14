import { reactive } from 'vue'

type FriendStatus = 'favorite' | 'normal' | 'blocked' | 'hidden'

type MatrixContact = {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  uid: string
  name: string
  account: string
  avatar: string
  activeStatus: number
  remark: string
  lastOptTime: number
  hideMyPosts: boolean
  hideTheirPosts: boolean
  friendStatus?: FriendStatus
  statusMessage?: string
}

type FriendRequestItem = {
  userId: string
  displayName?: string | null
  avatarUrl?: string | null
  message?: string
  direction?: 'incoming' | 'outgoing'
}

const defaultState = {
  contactsList: [] as MatrixContact[],
  requestFriendsList: [] as FriendRequestItem[],
  frequentContacts: [] as MatrixContact[],
  isLoading: false,
  friendSearchHistory: [] as string[],
  lastFriendError: null as { userMessageKey?: string } | null,
  initialize: () => undefined,
  loadFriendRequests: async () => undefined,
  acceptFriendRequest: async () => null as string | null,
  rejectFriendRequest: async () => undefined,
  cancelFriendRequest: async () => undefined,
  setFriendStatus: () => true,
  removeFromContacts: () => true,
  startDirectRoom: () => '!room:id',
  searchContacts: (query: string) =>
    !query
      ? contactStoreMock.contactsList
      : contactStoreMock.contactsList.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
  rememberSearchQuery: (query: string) => {
    const normalized = query.trim()
    if (!normalized) return
    contactStoreMock.friendSearchHistory = [
      normalized,
      ...contactStoreMock.friendSearchHistory.filter((item) => item !== normalized)
    ].slice(0, 8)
  }
}

export const contactStoreMock = reactive(defaultState)
Object.defineProperty(contactStoreMock, 'incomingRequestsCount', {
  get() {
    return contactStoreMock.requestFriendsList.filter((r: FriendRequestItem) => r.direction === 'incoming').length
  },
  enumerable: true,
  configurable: true
})

export const useContactStore = () => {
  return contactStoreMock as typeof contactStoreMock & { incomingRequestsCount: number }
}

export function resetContactStoreMock() {
  contactStoreMock.contactsList = []
  contactStoreMock.requestFriendsList = []
  contactStoreMock.frequentContacts = []
  contactStoreMock.isLoading = false
  contactStoreMock.friendSearchHistory = []
  contactStoreMock.lastFriendError = null
  contactStoreMock.initialize = defaultState.initialize
  contactStoreMock.loadFriendRequests = defaultState.loadFriendRequests
  contactStoreMock.acceptFriendRequest = defaultState.acceptFriendRequest
  contactStoreMock.rejectFriendRequest = defaultState.rejectFriendRequest
  contactStoreMock.cancelFriendRequest = defaultState.cancelFriendRequest
  contactStoreMock.setFriendStatus = defaultState.setFriendStatus
  contactStoreMock.removeFromContacts = defaultState.removeFromContacts
  contactStoreMock.startDirectRoom = defaultState.startDirectRoom
  contactStoreMock.searchContacts = defaultState.searchContacts
  contactStoreMock.rememberSearchQuery = defaultState.rememberSearchQuery
}

export function configureContactStoreMock(options: Partial<typeof defaultState>) {
  resetContactStoreMock()
  if (options.contactsList) {
    contactStoreMock.contactsList = options.contactsList
  }
  if (options.requestFriendsList) {
    contactStoreMock.requestFriendsList = options.requestFriendsList
  }
  if (options.frequentContacts) {
    contactStoreMock.frequentContacts = options.frequentContacts
  }
  if (typeof options.isLoading === 'boolean') {
    contactStoreMock.isLoading = options.isLoading
  }
  if (options.friendSearchHistory) {
    contactStoreMock.friendSearchHistory = options.friendSearchHistory
  }
  if (options.initialize) {
    contactStoreMock.initialize = options.initialize
  }
  if (options.loadFriendRequests) {
    contactStoreMock.loadFriendRequests = options.loadFriendRequests
  }
  if (options.acceptFriendRequest) {
    contactStoreMock.acceptFriendRequest = options.acceptFriendRequest
  }
  if (options.rejectFriendRequest) {
    contactStoreMock.rejectFriendRequest = options.rejectFriendRequest
  }
  if (options.cancelFriendRequest) {
    contactStoreMock.cancelFriendRequest = options.cancelFriendRequest
  }
  if (options.setFriendStatus) {
    contactStoreMock.setFriendStatus = options.setFriendStatus
  }
  if (options.removeFromContacts) {
    contactStoreMock.removeFromContacts = options.removeFromContacts
  }
  if (options.startDirectRoom) {
    contactStoreMock.startDirectRoom = options.startDirectRoom
  }
}

export type { MatrixContact, FriendRequestItem, FriendStatus }
