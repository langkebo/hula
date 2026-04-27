import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { OnlineEnum, UserType } from '@/enums'
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'

type GroupListItem = {
  roomId: string
}

type UserStateItem = {
  id: string
  title?: string
  url?: string
}

export function sortGroupChatList<T extends GroupListItem>(groups: T[]): T[] {
  return [...groups].sort((a, b) => {
    if (a.roomId === '1' && b.roomId !== '1') return -1
    if (a.roomId !== '1' && b.roomId === '1') return 1
    return 0
  })
}

export function sortContactsByOnlineStatus<T extends Pick<MatrixContact, 'activeStatus'>>(contacts: T[]): T[] {
  return [...contacts].sort((a, b) => {
    if (a.activeStatus === OnlineEnum.ONLINE && b.activeStatus !== OnlineEnum.ONLINE) return -1
    if (a.activeStatus !== OnlineEnum.ONLINE && b.activeStatus === OnlineEnum.ONLINE) return 1
    return 0
  })
}

export function sortBlockedContactsByTime<T extends Pick<MatrixContact, 'lastOptTime'>>(contacts: T[]): T[] {
  return [...contacts].sort((a, b) => (b.lastOptTime || 0) - (a.lastOptTime || 0))
}

export function sortNormalContacts(contacts: MatrixContact[], isBotUser: (uid: string) => boolean): MatrixContact[] {
  return [...contacts].sort((a, b) => {
    const aIsBot = isBotUser(a.uid)
    const bIsBot = isBotUser(b.uid)
    if (aIsBot && !bIsBot) return -1
    if (!aIsBot && bIsBot) return 1
    if (a.activeStatus === OnlineEnum.ONLINE && b.activeStatus !== OnlineEnum.ONLINE) return -1
    if (a.activeStatus !== OnlineEnum.ONLINE && b.activeStatus === OnlineEnum.ONLINE) return 1
    return 0
  })
}

export function buildNormalContacts(
  contacts: MatrixContact[],
  specialContacts: MatrixContact[],
  blockedContacts: MatrixContact[],
  isBotUser: (uid: string) => boolean
): MatrixContact[] {
  const specialIds = new Set(specialContacts.map((contact) => contact.uid))
  const blockedIds = new Set(blockedContacts.map((contact) => contact.uid))
  return sortNormalContacts(
    contacts.filter((contact) => !specialIds.has(contact.uid) && !blockedIds.has(contact.uid)),
    isBotUser
  )
}

export function useFriendsList() {
  const contactStore = useContactStore()
  const groupStore = useGroupStore()
  const globalStore = useGlobalStore()
  const userStatusStore = useUserStatusStore()
  const { stateList } = storeToRefs(userStatusStore)

  const isBotUser = (uid: string) => groupStore.getUserInfo(uid)?.account === UserType.BOT

  const groupChatList = computed(() => sortGroupChatList(groupStore.groupDetails))
  const onlineCount = computed(
    () => contactStore.contactsList.filter((item: MatrixContact) => item.activeStatus === OnlineEnum.ONLINE).length
  )
  const specialContacts = computed(() => sortContactsByOnlineStatus(contactStore.favoriteContacts))
  const specialOnlineCount = computed(
    () => specialContacts.value.filter((item: MatrixContact) => item.activeStatus === OnlineEnum.ONLINE).length
  )
  const blockedContacts = computed(() => sortBlockedContactsByTime(contactStore.blockedContacts))
  const normalContacts = computed(() =>
    buildNormalContacts(contactStore.contactsList, specialContacts.value, blockedContacts.value, isBotUser)
  )
  const normalOnlineCount = computed(() => Math.max(onlineCount.value - specialOnlineCount.value, 0))
  const contactUnreadCount = computed(() => globalStore.contactUnreadCount)
  const selectedItem = ref('')

  const getUserState = (uid: string): UserStateItem | null => {
    const userInfo = groupStore.getUserInfo(uid)
    const userStateId = userInfo?.userStateId
    if (userStateId && userStateId !== '1') {
      return (stateList.value.find((state: UserStateItem) => state.id === userStateId) as UserStateItem) || null
    }
    return null
  }

  const setSelectedItem = (id: string) => {
    selectedItem.value = String(id || '')
  }

  const clearSelectedItem = () => {
    selectedItem.value = ''
  }

  const isSelected = (id: string) => selectedItem.value === String(id || '')

  return {
    groupChatList,
    onlineCount,
    specialContacts,
    specialOnlineCount,
    blockedContacts,
    normalContacts,
    normalOnlineCount,
    contactUnreadCount,
    selectedItem,
    isBotUser,
    getUserState,
    setSelectedItem,
    clearSelectedItem,
    isSelected
  }
}
